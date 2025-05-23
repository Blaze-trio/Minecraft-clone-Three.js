
// Define message types for worker communication
export type ChunkWorkerMessage = 
  | { type: 'GENERATE_CHUNK', chunkX: number, chunkZ: number, id: string }
  | { type: 'GENERATE_CHUNKS_BATCH', chunks: {chunkX: number, chunkZ: number, id: string}[] };

// Import shared types
import type { Block, Chunk } from '../types/game';

// Constants for terrain generation
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;

// Simplex Noise implementation (simplified for worker)
class SimplexNoise {
  private perm = new Uint8Array(512);
  private grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];
  
  constructor(seed = Math.random()) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    
    // Shuffle based on seed
    let n = 256;
    let t;
    let j;
    seed = seed || Math.random();
    let random = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };
    
    while(n > 0) {
      j = Math.floor(random(seed * n) * n);
      n--;
      t = p[n];
      p[n] = p[j];
      p[j] = t;
      seed = random(seed);
    }
    
    // Extend permutation
    for(let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }
  
  noise2D(x: number, y: number): number {
    // Implementation of 2D simplex noise
    // This is a simplified version for illustration
    // In a real implementation, you would use the actual simplex noise algorithm
    const n0 = Math.sin(x * 0.3 + y * 0.7) * 0.5 + 0.5;
    const n1 = Math.sin(x * 0.5 + y * 0.5) * 0.5 + 0.5;
    const n2 = Math.sin(x * 0.7 + y * 0.3) * 0.5 + 0.5;
    return (n0 + n1 + n2) / 1.5 - 0.5;
  }
}

// Chunk generator for worker
class ChunkGenerator {
  private heightNoise: SimplexNoise;
  private caveNoise: SimplexNoise;
  private treeNoise: SimplexNoise;
  
  constructor() {
    // Create noise generators with different seeds for variety
    this.heightNoise = new SimplexNoise(123);
    this.caveNoise = new SimplexNoise(456);
    this.treeNoise = new SimplexNoise(789);
  }
  
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const blocks: Block[] = [];
    const blockMap = new Map<string, Block>();
    
    // Generate terrain
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        
        // Generate height using noise
        const heightValue = this.heightNoise.noise2D(worldX * 0.01, worldZ * 0.01);
        const height = Math.floor((heightValue + 1) * 16) + 32;
        
        // Generate terrain layers
        for (let y = 0; y < Math.min(height + 1, WORLD_HEIGHT); y++) {
          let blockType = 0; // Air
          
          // Cave generation (simplified)
          let isCave = false;
          if (y < height - 2 && y > 5) {
            const caveValue = this.caveNoise.noise2D(worldX * 0.05, worldZ * 0.05 + y * 0.1);
            isCave = caveValue > 0.4;
          }
          
          if (!isCave && y <= height) {
            if (y === height && height > 40) {
              blockType = 1; // Grass
            } else if (y > height - 4) {
              blockType = 2; // Dirt
            } else {
              blockType = 3; // Stone
            }
          }
          
          if (blockType !== 0) {
            const blockKey = `${x},${y},${z}`;
            blockMap.set(blockKey, {
              type: blockType,
              x,
              y,
              z,
            });
          }
        }
        
        // Generate trees occasionally
        if (height > 40) {
          const treeValue = this.treeNoise.noise2D(worldX * 0.1, worldZ * 0.1);
          if (treeValue > 0.7) {
            this.generateTree(blockMap, x, height + 1, z);
          }
        }
      }
    }
    
    // Convert map to array
    return {
      x: chunkX,
      z: chunkZ,
      blocks: Array.from(blockMap.values()),
      isReady: true
    };
  }
  
  private generateTree(blockMap: Map<string, Block>, x: number, y: number, z: number): void {
    const treeHeight = 4 + Math.floor(Math.random() * 2);
    
    // Tree trunk
    for (let i = 0; i < treeHeight; i++) {
      const blockKey = `${x},${y + i},${z}`;
      blockMap.set(blockKey, {
        type: 4, // Wood
        x,
        y: y + i,
        z,
      });
    }
    
    // Tree leaves
    const leavesY = y + treeHeight;
    const leafRadius = 2;
    
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
      for (let dz = -leafRadius; dz <= leafRadius; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          
          const distance = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (distance <= 3 && Math.random() > 0.2) {
            const leafX = x + dx;
            const leafY = leavesY + dy;
            const leafZ = z + dz;
            
            if (
              leafX >= 0 && leafX < CHUNK_SIZE &&
              leafY >= 0 && leafY < WORLD_HEIGHT &&
              leafZ >= 0 && leafZ < CHUNK_SIZE
            ) {
              const blockKey = `${leafX},${leafY},${leafZ}`;
              if (!blockMap.has(blockKey)) {
                blockMap.set(blockKey, {
                  type: 5, // Leaves
                  x: leafX,
                  y: leafY,
                  z: leafZ,
                });
              }
            }
          }
        }
      }
    }
  }
}

// Worker implementation
const generator = new ChunkGenerator();

// Handle messages from main thread
self.addEventListener('message', (event: MessageEvent<ChunkWorkerMessage>) => {
  try {
    const data = event.data;
    
    switch (data.type) {
      case 'GENERATE_CHUNK': {
        const { chunkX, chunkZ, id } = data;
        const chunk = generator.generateChunk(chunkX, chunkZ);
        self.postMessage({ 
          type: 'CHUNK_GENERATED', 
          chunk, 
          id 
        });
        break;
      }
      
      case 'GENERATE_CHUNKS_BATCH': {
        const { chunks } = data;
        const results = chunks.map(({ chunkX, chunkZ, id }) => ({
          chunk: generator.generateChunk(chunkX, chunkZ),
          id
        }));
        
        self.postMessage({
          type: 'CHUNKS_BATCH_GENERATED',
          results
        });
        break;
      }
    }
  } catch (error) {
    console.error('Error in chunk worker:', error);
    self.postMessage({
      type: 'ERROR',
      error: (error as Error).message
    });
  }
});

// Let main thread know worker is ready
self.postMessage({ type: 'WORKER_READY' });

// TypeScript requires this export
export {};
