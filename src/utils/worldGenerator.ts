import { createNoise2D } from 'simplex-noise';
import type { Block, Chunk } from '../types/game';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../types/game';

export class WorldGenerator {
  private heightNoise = createNoise2D();
  private caveNoise = createNoise2D();
  private treeNoise = createNoise2D();
  generateChunk(chunkX: number, chunkZ: number): Chunk {
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
          
          // Cave generation
          const caveValue = this.caveNoise(worldX * 0.05 + y * 0.1, worldZ * 0.05 + y * 0.1);
          const isCave = caveValue > 0.4 && y < height - 2 && y > 5;

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
            const blockKey = `${worldX},${y},${worldZ}`;
            blockMap.set(blockKey, {
              type: blockType,
              x: worldX,
              y,
              z: worldZ,
            });
          }
        }

        // Generate trees occasionally
        const treeValue = this.treeNoise(worldX * 0.1, worldZ * 0.1);
        if (treeValue > 0.6 && height > 40) {
          this.generateTree(blockMap, worldX, height + 1, worldZ);
        }
      }
    }

    return {
      x: chunkX,
      z: chunkZ,
      blocks: Array.from(blockMap.values()),
    };
  }
  private generateTree(blockMap: Map<string, Block>, x: number, y: number, z: number): void {
    const treeHeight = 4 + Math.floor(Math.random() * 3);

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
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue; // Don't place leaves where trunk is
          
          const distance = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (distance <= 3 && Math.random() > 0.1) {
            const leafX = x + dx;
            const leafY = leavesY + dy;
            const leafZ = z + dz;
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

  getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }
}
