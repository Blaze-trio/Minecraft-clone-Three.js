// Clean version of the ImprovedWorldGenerator
import type { Chunk, Block } from '../types/game';

// Constants
const CHUNK_SIZE = 16;

// Improved Simplex Noise implementation
class ImprovedNoise {
  private perm: number[] = [];
  
  constructor(seed = 123) {
    // Initialize permutation array with deterministic values
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }
    
    // Shuffle using seed
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((seed * i) % (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
      
      // Extend to 512 for wrapping
      this.perm[i + 256] = this.perm[i];
    }
  }
  
  noise(x: number, y: number): number {
    // Simplified noise implementation
    return Math.sin(x * 0.1 + y * 0.2) * 0.5 + 0.5;
  }
}

// Main generator class
export class ImprovedWorldGenerator {
  private heightNoise: ImprovedNoise;
  private detailNoise: ImprovedNoise;
  private chunkCache = new Map<string, Chunk>();
  
  constructor() {
    console.log('ImprovedWorldGenerator initialized');
    this.heightNoise = new ImprovedNoise(12345);
    this.detailNoise = new ImprovedNoise(54321);
  }
  
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    console.log(`Generating chunk at ${chunkX}, ${chunkZ}`);
    
    // Check cache first
    const key = this.getChunkKey(chunkX, chunkZ);
    if (this.chunkCache.has(key)) {
      return this.chunkCache.get(key)!;
    }
    
    // Generate a simple flat chunk for testing
    const blocks: Block[] = [];
    
    // Create a flat surface at y=40
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        
        // Add grass block at the top layer
        blocks.push({
          type: 1, // Grass
          x: worldX,
          y: 40,
          z: worldZ
        });
      }
    }
    
    // Create the chunk object
    const chunk: Chunk = {
      x: chunkX,
      z: chunkZ,
      blocks,
      isReady: true
    };
    
    // Cache the chunk
    this.chunkCache.set(key, chunk);
    
    return chunk;
  }
  
  getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }
  
  clearCache(): void {
    this.chunkCache.clear();
  }
}
