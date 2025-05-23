import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, NearestFilter, RepeatWrapping } from 'three';
import type { Block as BlockType } from '../types/game';
import { BLOCK_TYPES } from '../types/game';

interface BlockProps {
  block: BlockType;
}

export const Block: React.FC<BlockProps> = ({ block }) => {
  const blockType = BLOCK_TYPES[block.type];
  
  const textures = useLoader(TextureLoader, [
    blockType.textureTop,
    blockType.textureSide,
    blockType.textureBottom,
  ]);

  // Configure textures for pixel art look
  textures.forEach(texture => {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  });

  const materials = useMemo(() => [
    <meshLambertMaterial map={textures[1]} />, // Right
    <meshLambertMaterial map={textures[1]} />, // Left
    <meshLambertMaterial map={textures[0]} />, // Top
    <meshLambertMaterial map={textures[2]} />, // Bottom
    <meshLambertMaterial map={textures[1]} />, // Front
    <meshLambertMaterial map={textures[1]} />, // Back
  ], [textures]);

  if (block.type === 0) return null; // Don't render air blocks

  return (
    <mesh position={[block.x, block.y, block.z]}>
      <boxGeometry args={[1, 1, 1]} />
      {materials}
    </mesh>
  );
};

interface ChunkProps {
  blocks: BlockType[];
  chunkKey?: string; // Add chunk identification for better keys
}

export const ChunkComponent: React.FC<ChunkProps> = ({ blocks, chunkKey = '' }) => {
  const visibleBlocks = useMemo(() => {
    // First, deduplicate blocks by position to prevent key conflicts
    const blockMap = new Map<string, BlockType>();
    blocks.forEach(block => {
      if (block.type === 0) return; // Skip air blocks
      const blockKey = `${block.x}-${block.y}-${block.z}`;
      // Keep the last block at each position (in case of duplicates)
      blockMap.set(blockKey, block);
    });
    
    const uniqueBlocks = Array.from(blockMap.values());
    
    // Then apply occlusion culling - only render blocks that have at least one exposed face
    return uniqueBlocks.filter(block => {
      // Check if any face is exposed (simplified)
      const hasNeighbor = (dx: number, dy: number, dz: number) => {
        return uniqueBlocks.some(other => 
          other.x === block.x + dx && 
          other.y === block.y + dy && 
          other.z === block.z + dz && 
          other.type !== 0
        );
      };

      // If any face is not blocked, render the block
      return !(
        hasNeighbor(1, 0, 0) &&
        hasNeighbor(-1, 0, 0) &&
        hasNeighbor(0, 1, 0) &&
        hasNeighbor(0, -1, 0) &&
        hasNeighbor(0, 0, 1) &&
        hasNeighbor(0, 0, -1)
      );
    });
  }, [blocks]);

  return (
    <group>
      {visibleBlocks.map((block) => (
        <Block key={`${chunkKey}-${block.x}-${block.y}-${block.z}`} block={block} />
      ))}
    </group>
  );
};
