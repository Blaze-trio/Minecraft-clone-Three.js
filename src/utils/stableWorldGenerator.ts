// Stable World Generator with realistic terrain and proper collision
import type { Chunk, Block } from '../types/game';

const CHUNK_SIZE = 16;
const SEA_LEVEL = 32; // Reduced from 64
const MOUNTAIN_HEIGHT = 8; // Reduced from 20
const MIN_HEIGHT = 20; // Minimum terrain height
const MAX_HEIGHT = 45; // Maximum terrain height

// Enhanced Simplex Noise for realistic terrain
class StableNoise {
  private perm: number[] = [];
  private gradients: number[][] = [];
  
  constructor(seed = 12345) {
    // Initialize gradients
    this.gradients = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    
    // Initialize permutation array
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }
    
    // Shuffle using seed for deterministic results
    let rng = seed;
    for (let i = 255; i > 0; i--) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      const j = Math.floor((rng / 4294967296) * (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
    
    // Extend to 512 for wrapping
    for (let i = 0; i < 256; i++) {
      this.perm[i + 256] = this.perm[i];
    }
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const gradient = this.gradients[hash & 7];
    return gradient[0] * x + gradient[1] * y;
  }
  
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;
    
    return this.lerp(
      this.lerp(
        this.grad(this.perm[A], x, y),
        this.grad(this.perm[B], x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.perm[A + 1], x, y - 1),
        this.grad(this.perm[B + 1], x - 1, y - 1),
        u
      ),
      v
    );
  }
  
  // Fractal noise for more complex terrain
  fractalNoise(x: number, y: number, octaves = 4): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  }
}

export class StableWorldGenerator {
  private heightNoise: StableNoise;
  private caveNoise: StableNoise;
  private oreNoise: StableNoise;
  private chunkCache = new Map<string, Chunk>();
  
  constructor() {
    console.log('🌍 StableWorldGenerator: Initializing realistic terrain generator');
    this.heightNoise = new StableNoise(12345);
    this.caveNoise = new StableNoise(54321);
    this.oreNoise = new StableNoise(98765);
  }
  
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const key = this.getChunkKey(chunkX, chunkZ);
    
    // Return cached chunk if available
    if (this.chunkCache.has(key)) {
      console.log(`🔄 StableWorldGenerator: Using cached chunk (${chunkX}, ${chunkZ})`);
      return this.chunkCache.get(key)!;
    }
    
    console.log(`⛏️  StableWorldGenerator: Generating new chunk (${chunkX}, ${chunkZ})`);
    
    const blocks: Block[] = [];
    const heightMap = this.generateHeightMap(chunkX, chunkZ);
    
    // Generate terrain for each column
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        const height = heightMap[x][z];
        
        // Generate blocks from bedrock to surface
        for (let y = 0; y <= height; y++) {
          const blockType = this.getBlockType(worldX, y, worldZ, height);
          
          if (blockType > 0) {
            blocks.push({
              type: blockType,
              x: worldX,
              y: y,
              z: worldZ
            });
          }
        }
      }
    }
    
    const chunk: Chunk = {
      x: chunkX,
      z: chunkZ,
      blocks,
      isReady: true
    };
    
    // Cache the chunk for stability
    this.chunkCache.set(key, chunk);
    console.log(`✅ StableWorldGenerator: Generated chunk (${chunkX}, ${chunkZ}) with ${blocks.length} blocks`);
    
    return chunk;
  }
    private generateHeightMap(chunkX: number, chunkZ: number): number[][] {
    const heightMap: number[][] = [];
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      heightMap[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = (chunkX * CHUNK_SIZE + x) * 0.01;
        const worldZ = (chunkZ * CHUNK_SIZE + z) * 0.01;
        
        // Generate much simpler terrain with lower height variation
        const baseHeight = this.heightNoise.fractalNoise(worldX, worldZ, 2);
        const detailNoise = this.heightNoise.fractalNoise(worldX * 2, worldZ * 2, 1);
        
        // Much smaller height range for performance
        let height = SEA_LEVEL;
        height += baseHeight * MOUNTAIN_HEIGHT;
        height += detailNoise * 2;
        
        // Clamp to reasonable bounds - much lower max height
        height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.floor(height)));
        heightMap[x][z] = height;
      }
    }
    
    return heightMap;
  }
  private getBlockType(x: number, y: number, z: number, surfaceHeight: number): number {
    // Much simpler block generation for performance
    
    // Don't generate blocks below a certain depth
    if (y < MIN_HEIGHT - 5) return 0; // Air
    
    // Surface layer
    if (y === surfaceHeight) return 1; // Grass
    
    // Sub-surface layers (much thinner)
    if (y >= surfaceHeight - 2 && y < surfaceHeight) return 2; // Dirt
    
    // Stone layer (limited depth)
    if (y >= surfaceHeight - 8 && y < surfaceHeight - 2) return 3; // Stone
    
    // Everything else is air (no deep terrain)
    return 0;
  }
  
  // Check if there's a solid block at the given position
  isBlockAt(x: number, y: number, z: number): boolean {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunkCache.get(this.getChunkKey(chunkX, chunkZ));
    
    if (!chunk) return false;
    
    return chunk.blocks.some(block => 
      block.x === Math.floor(x) && 
      block.y === Math.floor(y) && 
      block.z === Math.floor(z) &&
      block.type > 0
    );
  }
  
  getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }
  
  // Get chunks in radius for stable loading
  getChunksInRadius(centerX: number, centerZ: number, radius: number): Array<{x: number, z: number}> {
    const chunks: Array<{x: number, z: number}> = [];
    
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let z = centerZ - radius; z <= centerZ + radius; z++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        if (distance <= radius) {
          chunks.push({x, z});
        }
      }
    }
    
    return chunks;
  }
  
  clearDistantChunks(centerX: number, centerZ: number, maxDistance: number): void {
    const toRemove: string[] = [];
    
    for (const [key, chunk] of this.chunkCache.entries()) {
      const distance = Math.sqrt(
        (chunk.x - centerX) ** 2 + (chunk.z - centerZ) ** 2
      );
      
      if (distance > maxDistance) {
        toRemove.push(key);
      }
    }
    
    toRemove.forEach(key => {
      this.chunkCache.delete(key);
      console.log(`🗑️  StableWorldGenerator: Removed distant chunk ${key}`);
    });
  }
}

// Singleton instance for stability
export const stableWorldGenerator = new StableWorldGenerator();
