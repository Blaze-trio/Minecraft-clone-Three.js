// Standard import without extension
import type { Chunk, Block } from '../types/game';

const CHUNK_SIZE = 16;

// Improved Simplex Noise implementation
class ImprovedNoise {
  private perm: number[] = [];
  
  constructor(seed = 123) {
    // Initialize permutation array
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }
    
    // Shuffle using seed
    for (let i = 255; i >= 0; i--) {
      const j = Math.floor((this.seedRandom(seed + i)) * (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
    
    // Extend to 512
    for (let i = 0; i < 256; i++) {
      this.perm[256 + i] = this.perm[i];
    }
  }
  
  private seedRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.perm[X] + Y;
    const AA = this.perm[A];
    const AB = this.perm[A + 1];
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B];
    const BB = this.perm[B + 1];
    
    return this.lerp(
      this.lerp(this.grad(this.perm[AA], x, y), this.grad(this.perm[BA], x - 1, y), u),
      this.lerp(this.grad(this.perm[AB], x, y - 1), this.grad(this.perm[BB], x - 1, y - 1), u),
      v
    );
  }
}

export class ImprovedWorldGenerator {
  // Debug flag to check if the module is loading correctly
  private static isLoaded = (() => {
    console.log('ImprovedWorldGenerator module loaded successfully!');
    return true;
  })();

  private heightNoise: ImprovedNoise;
  private roughnessNoise: ImprovedNoise;
  private caveNoise: ImprovedNoise;
  private vegetationNoise: ImprovedNoise;
  private chunkCache = new Map<string, Chunk>();
  
  // Strict geometry limits for performance
  private readonly MAX_BLOCKS_PER_CHUNK = 80; // Reduced from previous limits
  private readonly MIN_HEIGHT = 35;
  private readonly MAX_HEIGHT = 55;
  
  constructor() {
    this.heightNoise = new ImprovedNoise(12345);
    this.roughnessNoise = new ImprovedNoise(67890);
    this.caveNoise = new ImprovedNoise(24680);
    this.vegetationNoise = new ImprovedNoise(13579);
  }
  
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const cacheKey = `${chunkX},${chunkZ}`;
    
    if (this.chunkCache.has(cacheKey)) {
      return this.chunkCache.get(cacheKey)!;
    }
    
    const blockMap = new Map<string, Block>();
    let blockCount = 0;
    
    // Generate varied terrain with multiple noise layers
    for (let x = 0; x < CHUNK_SIZE && blockCount < this.MAX_BLOCKS_PER_CHUNK; x++) {
      for (let z = 0; z < CHUNK_SIZE && blockCount < this.MAX_BLOCKS_PER_CHUNK; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        
        // Multi-octave height generation for varied terrain
        const baseHeight = this.heightNoise.noise(worldX * 0.01, worldZ * 0.01);
        const roughness = this.roughnessNoise.noise(worldX * 0.03, worldZ * 0.03) * 0.3;
        const detail = this.roughnessNoise.noise(worldX * 0.08, worldZ * 0.08) * 0.1;
        
        const combinedHeight = baseHeight + roughness + detail;
        const height = Math.floor(
          this.MIN_HEIGHT + (combinedHeight + 1) * (this.MAX_HEIGHT - this.MIN_HEIGHT) * 0.5
        );
        
        // Generate terrain layers with varied composition
        const startY = Math.max(this.MIN_HEIGHT - 2, height - 5);
        const endY = Math.min(height + 2, this.MAX_HEIGHT);
        
        for (let y = startY; y <= endY && blockCount < this.MAX_BLOCKS_PER_CHUNK; y++) {
          let blockType = 0; // Air by default
          
          // Simple cave generation (very limited)
          let isCave = false;
          if (y < height - 1 && y > startY + 2) {
            const caveValue = this.caveNoise.noise(worldX * 0.04, worldZ * 0.04 + y * 0.08);
            isCave = caveValue > 0.6; // High threshold for fewer caves
          }
          
          if (!isCave && y <= height) {
            // Surface blocks
            if (y === height) {
              // Varied surface based on height and location
              if (height > this.MIN_HEIGHT + 10) {
                blockType = 1; // Grass on higher terrain
              } else {
                blockType = 2; // Dirt on lower terrain
              }
            }
            // Subsurface layers
            else if (y > height - 3) {
              blockType = 2; // Dirt layer
            } else {
              blockType = 3; // Stone deep layer
            }
          }
          
          if (blockType !== 0) {
            const blockKey = `${x},${y},${z}`;
            blockMap.set(blockKey, {
              type: blockType,
              x: worldX,
              y,
              z: worldZ,
            });
            blockCount++;
          }
        }
        
        // Extremely limited vegetation (trees)
        if (height > this.MIN_HEIGHT + 8 && blockCount < this.MAX_BLOCKS_PER_CHUNK - 5) {
          const vegValue = this.vegetationNoise.noise(worldX * 0.05, worldZ * 0.05);
          if (vegValue > 0.8) { // Very high threshold
            this.generateSimpleTree(blockMap, x, height + 1, z, worldX, worldZ);
            blockCount += 5; // Estimate tree block count
          }
        }
      }
    }
    
    const blocks = Array.from(blockMap.values());
    console.log(`Generated improved chunk ${chunkX},${chunkZ} with ${blocks.length} blocks (limit: ${this.MAX_BLOCKS_PER_CHUNK})`);
    
    const chunk: Chunk = {
      x: chunkX,
      z: chunkZ,
      blocks,
      isReady: true
    };
    
    this.chunkCache.set(cacheKey, chunk);
    return chunk;
  }
  
  private generateSimpleTree(
    blockMap: Map<string, Block>, 
    x: number, 
    y: number, 
    z: number,
    worldX: number,
    worldZ: number
  ): void {
    // Simple tree: 3-block trunk + minimal leaves
    const treeHeight = 3;
    
    // Trunk
    for (let i = 0; i < treeHeight; i++) {
      const blockKey = `${x},${y + i},${z}`;
      blockMap.set(blockKey, {
        type: 4, // Wood
        x: worldX,
        y: y + i,
        z: worldZ,
      });
    }
    
    // Minimal leaves crown (just top and sides)
    const leavesY = y + treeHeight;
    const leafPositions = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    
    leafPositions.forEach(([dx, dz]) => {
      const leafX = x + dx;
      const leafZ = z + dz;
      
      if (leafX >= 0 && leafX < CHUNK_SIZE && leafZ >= 0 && leafZ < CHUNK_SIZE) {
        const blockKey = `${leafX},${leavesY},${leafZ}`;
        if (!blockMap.has(blockKey)) {
          blockMap.set(blockKey, {
            type: 5, // Leaves
            x: worldX + dx,
            y: leavesY,
            z: worldZ + dz,
          });
        }
      }
    });
  }
  
  getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }
  
  clearCache(): void {
    this.chunkCache.clear();
  }
}
