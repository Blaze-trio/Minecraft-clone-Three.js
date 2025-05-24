import { createNoise2D } from 'simplex-noise';
import type { Block, Chunk } from '../types/game';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../types/game';

export class OptimizedWorldGenerator {
  private heightNoise = createNoise2D();
  private caveNoise = createNoise2D();
  private treeNoise = createNoise2D();
  private chunkCache = new Map<string, Chunk>();    // Absolutely minimal geometry limits - emergency mode
  private readonly MAX_BLOCKS_PER_CHUNK = 25; // Emergency reduction from 50
  private readonly CAVE_THRESHOLD = 0.9; // Virtually no caves
  private readonly TREE_THRESHOLD = 0.99; // Essentially no trees
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const cacheKey = this.getChunkKey(chunkX, chunkZ);
    
    // Return cached chunk if available
    if (this.chunkCache.has(cacheKey)) {
      return this.chunkCache.get(cacheKey)!;
    }

    const blockMap = new Map<string, Block>();
    let blockCount = 0; // Track block count for budget management

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;        // Generate height using noise - extremely limited height variation
        const heightValue = this.heightNoise(worldX * 0.02, worldZ * 0.02); // Less frequent variation
        const height = Math.floor((heightValue + 1) * 4) + 40; // Very narrow height range: 40-48        // Generate terrain layers with extreme optimization
        for (let y = Math.max(35, height - 3); y < Math.min(height + 1, WORLD_HEIGHT); y++) { // Very small vertical range
          // Stop generating if we've hit our block limit
          if (blockCount >= this.MAX_BLOCKS_PER_CHUNK) {
            console.warn(`Chunk ${chunkX},${chunkZ} hit block limit of ${this.MAX_BLOCKS_PER_CHUNK}`);
            break;
          }

          let blockType = 0; // Air
            // Extremely limited cave generation - almost none
          let isCave = false;
          if (y < height - 1 && y > height - 2 && Math.random() > 0.95) { // Very narrow range, 5% chance only
            const caveValue = this.caveNoise(
              worldX * 0.05,
              worldZ * 0.05 + y * 0.05
            );
            isCave = caveValue > this.CAVE_THRESHOLD; // Extremely restrictive
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
            blockCount++;
          }
        }        // Virtually no tree generation
        if (height > 48 && blockCount < this.MAX_BLOCKS_PER_CHUNK - 10 && Math.random() > 0.99) { // Only 1% chance
          const treeValue = this.treeNoise(worldX * 0.3, worldZ * 0.3); // Even higher frequency
          if (treeValue > this.TREE_THRESHOLD) { // Extremely restrictive
            const treeSizeBefore = blockMap.size;
            this.generateTree(blockMap, x, height + 1, z);
            blockCount += (blockMap.size - treeSizeBefore);
          }
        }
        
        // Early exit if we're approaching the limit
        if (blockCount >= this.MAX_BLOCKS_PER_CHUNK) {
          break;
        }
      }
      
      // Break outer loop too if limit reached
      if (blockCount >= this.MAX_BLOCKS_PER_CHUNK) {
        break;
      }
    }

    // Convert to array for easier access
    const blocks = Array.from(blockMap.values());
    
    console.log(`Generated chunk ${chunkX},${chunkZ} with ${blocks.length} blocks (limit: ${this.MAX_BLOCKS_PER_CHUNK})`);
    
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
    const treeHeight = 3 + Math.floor(Math.random() * 2); // Shorter trees (3-4 blocks)

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

    // Tree leaves (much smaller and more optimized)
    const leavesY = y + treeHeight;
    const leafRadius = 1; // Reduced from 2 to 1
    
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
      for (let dz = -leafRadius; dz <= leafRadius; dz++) {
        for (let dy = 0; dy <= 1; dy++) { // Only above trunk, not below
          if (dx === 0 && dz === 0 && dy === 0) continue; // Don't place leaves where trunk is
          
          // Much more restrictive leaf placement
          const distance = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (distance <= 2 && Math.random() > 0.4) { // Fewer leaves
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