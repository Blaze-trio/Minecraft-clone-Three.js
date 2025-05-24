// Simplified version of ImprovedWorldGenerator without type imports
// for testing purposes

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
  
  noise(x: number, y: number): number {
    // Simplified noise function for testing
    return Math.sin(x * 0.1) * Math.cos(y * 0.1);
  }
}

// Simplified local types instead of importing
interface Block {
  type: number;
  x: number;
  y: number;
  z: number;
}

interface Chunk {
  x: number;
  z: number;
  blocks: Block[];
  isReady?: boolean;
}

export class SimplifiedGenerator {
  private noise: ImprovedNoise;
  private chunkCache = new Map<string, Chunk>();
  
  // Debug flag to check module loading
  private static isLoaded = (() => {
    console.log('SimplifiedGenerator module loaded successfully!');
    return true;
  })();
  
  constructor() {
    console.log('SimplifiedGenerator constructor called');
    this.noise = new ImprovedNoise(12345);
  }
  
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    console.log(`Generating chunk ${chunkX},${chunkZ}`);
    
    const blocks: Block[] = [];
    
    // Generate a simple flat chunk with 3 blocks for testing
    blocks.push({ type: 1, x: chunkX * 16, y: 40, z: chunkZ * 16 });
    blocks.push({ type: 2, x: chunkX * 16 + 1, y: 40, z: chunkZ * 16 });
    blocks.push({ type: 3, x: chunkX * 16 + 2, y: 40, z: chunkZ * 16 });
    
    const chunk: Chunk = {
      x: chunkX,
      z: chunkZ,
      blocks,
      isReady: true
    };
    
    return chunk;
  }
  
  getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }
}
