import { createNoise2D } from 'simplex-noise';
import type { Block, Chunk } from '../types/game';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../types/game';

export class OptimizedWorldGenerator {
  private heightNoise = createNoise2D();
  private caveNoise = createNoise2D();
  private treeNoise = createNoise2D();
  private chunkCache = new Map<string, Chunk>();

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const cacheKey = this.getChunkKey(chunkX, chunkZ);
    
    // Return cached chunk if available
    if (this.chunkCache.has(cacheKey)) {
      return this.chunkCache.get(cacheKey)!;
    }

    const blockMap = new Map<string, Block>(); // Use Map to ensure unique positions

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        // Generate height using noise
        const heightValue = this.heightNoise(worldX * 0.01, worldZ * 0.01);
        const height = Math.floor((heightValue + 1) * 16) + 32; // Height between 32-64

        // Generate terrain layers
        for (let y = 0; y < Math.min(height + 1, WORLD_HEIGHT); y++) {
          let blockType = 0; // Air
          
          // Cave generation (optimized)
          // Only calculate cave values where they're needed (not at surface)
          let isCave = false;
          if (y < height - 2 && y > 5) {
            // Use lower resolution for caves
            const caveValue = this.caveNoise(
              worldX * 0.04 + Math.floor(y * 0.1) * 0.1,
              worldZ * 0.04 + Math.floor(y * 0.1) * 0.1
            );
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
            const blockKey = `${x},${y},${z}`; // Use local coordinates
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
          const treeValue = this.treeNoise(worldX * 0.1, worldZ * 0.1);
          if (treeValue > 0.7) { // Reduced tree density
            this.generateTree(blockMap, x, height + 1, z);
          }
        }
      }
    }

    // Convert to array for easier access
    const blocks = Array.from(blockMap.values());
    
    // Store chunk in cache
    const chunk: Chunk = {
      x: chunkX,
      z: chunkZ,
      blocks,
      isReady: true
    };
    
    this.chunkCache.set(cacheKey, chunk);
    
    return chunk;
  }

  private generateTree(blockMap: Map<string, Block>, x: number, y: number, z: number): void {
    const treeHeight = 4 + Math.floor(Math.random() * 2); // Slightly shorter trees

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

    // Tree leaves (with optimization)
    const leavesY = y + treeHeight;
    const leafRadius = 2;
    
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
      for (let dz = -leafRadius; dz <= leafRadius; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue; // Don't place leaves where trunk is
          
          const distance = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          // Reduce random leaves generation to improve performance
          if (distance <= 3 && Math.random() > 0.2) {
            const leafX = x + dx;
            const leafY = leavesY + dy;
            const leafZ = z + dz;
            
            // Only add if coordinates are within chunk
            if (
              leafX >= 0 && leafX < CHUNK_SIZE &&
              leafY >= 0 && leafY < WORLD_HEIGHT &&
              leafZ >= 0 && leafZ < CHUNK_SIZE
            ) {
              const blockKey = `${leafX},${leafY},${leafZ}`;
              
              // Only place leaves if there's no existing block (trunk takes priority)
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

  getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  clearCache() {
    this.chunkCache.clear();
  }
  
  generateChunksInRadius(centerX: number, centerZ: number, radius: number): Map<string, Chunk> {
    const chunks = new Map<string, Chunk>();
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= radius) {
          const x = centerX + dx;
          const z = centerZ + dz;
          const key = this.getChunkKey(x, z);
          
          const chunk = this.generateChunk(x, z);
          chunks.set(key, chunk);
        }
      }
    }
    
    return chunks;
  }
}