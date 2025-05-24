import React, { useMemo, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, NearestFilter, RepeatWrapping } from 'three';
import type { Block as BlockType } from '../types/game';
import { BLOCK_TYPES } from '../types/game';

interface BlockProps {
  block: BlockType;
}

// Fallback block component without textures
const FallbackBlock: React.FC<BlockProps> = ({ block }) => {
  // Define fallback colors for different block types
  const getBlockColor = (type: number) => {
    switch (type) {
      case 1: return '#8B4513'; // Dirt - brown
      case 2: return '#228B22'; // Grass - green  
      case 3: return '#808080'; // Stone - gray
      case 4: return '#654321'; // Wood - brown
      case 5: return '#32CD32'; // Leaves - light green
      default: return '#8B4513'; // Default brown
    }
  };
  
  const color = getBlockColor(block.type);
  
  return (
    <mesh position={[block.x, block.y, block.z]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

// Textured block component
const TexturedBlock: React.FC<BlockProps> = ({ block }) => {
  const blockType = BLOCK_TYPES[block.type];
  
  const textures = useLoader(TextureLoader, [
    blockType.textureTop,
    blockType.textureSide,
    blockType.textureBottom,
  ]);

  // Configure textures for pixel art look
  useMemo(() => {
    textures.forEach(texture => {
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    });
  }, [textures]);

  const materials = useMemo(() => [
    <meshLambertMaterial key="right" map={textures[1]} />, // Right
    <meshLambertMaterial key="left" map={textures[1]} />, // Left
    <meshLambertMaterial key="top" map={textures[0]} />, // Top
    <meshLambertMaterial key="bottom" map={textures[2]} />, // Bottom
    <meshLambertMaterial key="front" map={textures[1]} />, // Front
    <meshLambertMaterial key="back" map={textures[1]} />, // Back
  ], [textures]);

  return (
    <mesh position={[block.x, block.y, block.z]}>
      <boxGeometry args={[1, 1, 1]} />
      {materials}
    </mesh>
  );
};

export const Block: React.FC<BlockProps> = ({ block }) => {
  if (block.type === 0) {
    return null; // Don't render air blocks
  }

  const blockType = BLOCK_TYPES[block.type];
  if (!blockType) {
    console.error(`❌ Block component: Unknown block type ${block.type} at (${block.x}, ${block.y}, ${block.z})`);
    return null;
  }

  return (
    <Suspense fallback={<FallbackBlock block={block} />}>
      <TexturedBlock block={block} />
    </Suspense>
  );
};interface ChunkProps {
  blocks: BlockType[];
  chunkKey?: string;
}

export const ChunkComponent: React.FC<ChunkProps> = ({ blocks, chunkKey = '' }) => {
  const visibleBlocks = useMemo(() => {
    // First, deduplicate blocks by position to prevent key conflicts
    const blockMap = new Map<string, BlockType>();
    blocks.forEach(block => {
      if (block.type === 0) return; // Skip air blocks
      const blockKey = `${block.x}-${block.y}-${block.z}`;
      blockMap.set(blockKey, block);
    });
    
    return Array.from(blockMap.values());
  }, [blocks]);

  return (
    <group>
      {visibleBlocks.map((block) => (
        <Block key={`${chunkKey}-${block.x}-${block.y}-${block.z}`} block={block} />
      ))}
    </group>
  );
};
