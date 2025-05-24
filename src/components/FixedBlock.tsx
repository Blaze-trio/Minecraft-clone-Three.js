import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, NearestFilter, RepeatWrapping } from 'three';
import type { Block as BlockType } from '../types/game';
import { BLOCK_TYPES } from '../types/game';

interface BlockProps {
  block: BlockType;
}

// Simple fallback block component that doesn't use textures
const SimpleFallbackBlock: React.FC<BlockProps> = ({ block }) => {
  const blockType = BLOCK_TYPES[block.type];
  
  // Color mapping for different block types
  const getBlockColor = (type: number) => {
    switch (type) {
      case 1: return '#90EE90'; // Grass - Light green
      case 2: return '#8B4513'; // Dirt - Brown
      case 3: return '#808080'; // Stone - Gray
      case 4: return '#8B4513'; // Wood - Brown
      case 5: return '#228B22'; // Leaves - Dark green
      default: return '#FFFFFF'; // Default white
    }
  };

  return (
    <mesh position={[block.x, block.y, block.z]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial 
        color={getBlockColor(block.type)}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
};

// Improved Block component with proper texture loading
export const Block: React.FC<BlockProps> = ({ block }) => {
  const blockType = BLOCK_TYPES[block.type];
  
  console.log(`🎲 Block component rendering: (${block.x}, ${block.y}, ${block.z}) type:${block.type}`, blockType);
  
  if (block.type === 0) {
    console.log(`⚠️ Block component: Skipping air block at (${block.x}, ${block.y}, ${block.z})`);
    return null; // Don't render air blocks
  }

  if (!blockType) {
    console.error(`❌ Block component: Unknown block type ${block.type} at (${block.x}, ${block.y}, ${block.z})`);
    return null;
  }

  // Use fallback for now to avoid texture loading issues
  return <SimpleFallbackBlock block={block} />;
};

// Texture-based block component (currently disabled due to loading issues)
export const TexturedBlock: React.FC<BlockProps> = ({ block }) => {
  const blockType = BLOCK_TYPES[block.type];
  
  if (block.type === 0 || !blockType) {
    return null;
  }

  let textures;
  try {
    // This is the problematic line - useLoader returns a Promise
    textures = useLoader(TextureLoader, [
      blockType.textureTop,
      blockType.textureSide,
      blockType.textureBottom,
    ]);
    
    console.log(`✅ Block component: Textures loaded for type ${block.type}`, textures);
  } catch (error) {
    console.error(`❌ Block component: Texture loading failed for type ${block.type}:`, error);
    // Fallback to simple colored material
    return <SimpleFallbackBlock block={block} />;
  }

  // Configure textures for pixel art look
  if (Array.isArray(textures)) {
    textures.forEach(texture => {
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    });
  }

  const materials = useMemo(() => [
    <meshLambertMaterial key="right" map={textures[1]} />, // Right
    <meshLambertMaterial key="left" map={textures[1]} />,  // Left
    <meshLambertMaterial key="top" map={textures[0]} />,   // Top
    <meshLambertMaterial key="bottom" map={textures[2]} />, // Bottom
    <meshLambertMaterial key="front" map={textures[1]} />, // Front
    <meshLambertMaterial key="back" map={textures[1]} />,  // Back
  ], [textures]);

  return (
    <mesh position={[block.x, block.y, block.z]}>
      <boxGeometry args={[1, 1, 1]} />
      {materials}
    </mesh>
  );
};

// Chunk component for rendering multiple blocks efficiently
interface ChunkComponentProps {
  blocks: BlockType[];
  chunkKey?: string;
}

export const ChunkComponent: React.FC<ChunkComponentProps> = ({ blocks, chunkKey }) => {
  console.log(`🏗️ Chunk component rendering: ${chunkKey || 'unknown'} with ${blocks.length} blocks`);
  
  // Filter out air blocks for performance
  const solidBlocks = useMemo(() => 
    blocks.filter(block => block.type !== 0), 
    [blocks]
  );

  if (solidBlocks.length === 0) {
    console.log(`⚠️ Chunk component: No solid blocks to render for ${chunkKey}`);
    return null;
  }

  return (
    <group>
      {solidBlocks.map((block, index) => (
        <Block 
          key={`${block.x}-${block.y}-${block.z}`} 
          block={block} 
        />
      ))}
    </group>
  );
};

export default Block;
