// Optimized Stable World Generator - Performance focused
import type { Chunk, Block } from '../types/game';

const CHUNK_SIZE = 16;
const SEA_LEVEL = 32; // Reduced height
const MOUNTAIN_HEIGHT = 6; // Much smaller mountains
const MIN_HEIGHT = 25; // Minimum terrain height
const MAX_HEIGHT = 40; // Maximum terrain height - much lower

// Simple noise generator for performance
class OptimizedNoise {
  private perm: number[] = [];
  
  constructor(seed = 12345) {
    // Initialize permutation array
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }
    
    // Simple shuffle using seed
    let rng = seed;
    for (let i = 255; i > 0; i--) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      const j = Math.floor((rng / 4294967296) * (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
    
    // Extend to 512
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
      this.lerp(this.perm[A] / 255, this.perm[B] / 255, u),
      this.lerp(this.perm[A + 1] / 255, this.perm[B + 1] / 255, u),
      v
    );
  }
  
  // Simplified fractal noise
  fractalNoise(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x, y) * amplitude;
      x *= 2;
      y *= 2;
      amplitude *= 0.5;
    }
    
    return value;
  }
}

class OptimizedStableWorldGenerator {
  private heightNoise: OptimizedNoise;
  private chunkCache = new Map<string, Chunk>();
  
  constructor() {
    console.log('🌍 OptimizedStableWorldGenerator: Initializing performance-focused terrain generator');
    this.heightNoise = new OptimizedNoise(12345);
  }
  
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const key = this.getChunkKey(chunkX, chunkZ);
    
    // Return cached chunk if available
    if (this.chunkCache.has(key)) {
      console.log(`🔄 OptimizedStableWorldGenerator: Using cached chunk (${chunkX}, ${chunkZ})`);
      return this.chunkCache.get(key)!;
    }
    
    console.log(`⛏️  OptimizedStableWorldGenerator: Generating new chunk (${chunkX}, ${chunkZ})`);
    
    const blocks: Block[] = [];
    const heightMap = this.generateHeightMap(chunkX, chunkZ);
    
    // Generate only surface terrain (no deep underground)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        const height = heightMap[x][z];
        
        // Only generate a few layers for performance
        const startY = Math.max(height - 10, MIN_HEIGHT - 5);
        
        for (let y = startY; y <= height; y++) {
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
      isReady: true,
      isEmpty: blocks.length === 0
    };
    
    this.chunkCache.set(key, chunk);
    console.log(`✅ OptimizedStableWorldGenerator: Generated chunk (${chunkX}, ${chunkZ}) with ${blocks.length} blocks`);
    
    return chunk;
  }
  
  private generateHeightMap(chunkX: number, chunkZ: number): number[][] {
    const heightMap: number[][] = [];
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      heightMap[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = (chunkX * CHUNK_SIZE + x) * 0.02;
        const worldZ = (chunkZ * CHUNK_SIZE + z) * 0.02;
        
        // Very simple height generation
        const baseHeight = this.heightNoise.noise(worldX, worldZ);
        const detailNoise = this.heightNoise.noise(worldX * 2, worldZ * 2) * 0.5;
        
        // Much smaller height range
        let height = SEA_LEVEL;
        height += baseHeight * MOUNTAIN_HEIGHT;
        height += detailNoise * 2;
        
        // Clamp to smaller bounds
        height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.floor(height)));
        heightMap[x][z] = height;
      }
    }
    
    return heightMap;
  }
  
  private getBlockType(x: number, y: number, z: number, surfaceHeight: number): number {
    // Super simple block generation
    
    // Surface layer
    if (y === surfaceHeight) return 1; // Grass
    
    // Sub-surface layers (only 2-3 layers)
    if (y >= surfaceHeight - 2 && y < surfaceHeight) return 2; // Dirt
    
    // Stone layer (limited depth)
    if (y >= surfaceHeight - 6 && y < surfaceHeight - 2) return 3; // Stone
    
    // Everything else is air
    return 0;
  }
  
  // Check if there's a solid block at position
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
  
  // Get chunks in radius for loading
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
  
  // Clear distant chunks to prevent memory leaks
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
      console.log(`🗑️  OptimizedStableWorldGenerator: Removed distant chunk ${key}`);
    });
  }
  
  // Get cache size for monitoring
  getCacheSize(): number {
    return this.chunkCache.size;
  }
}

// Export singleton instance
export const optimizedStableWorldGenerator = new OptimizedStableWorldGenerator();
