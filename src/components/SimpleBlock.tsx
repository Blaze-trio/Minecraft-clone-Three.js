import React, { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { Block as BlockType } from '../types/game';
import * as THREE from 'three';

interface BlockProps {
  block: BlockType;
  onBlockClick?: (block: BlockType, event: 'break' | 'place') => void;
}

export const SimpleBlock: React.FC<BlockProps> = ({ block, onBlockClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  if (block.type === 0) {
    return null; // Don't render air blocks
  }

  // Enhanced color and material mapping
  const getBlockMaterial = (type: number) => {
    switch (type) {
      case 1: return { color: "#7FFF00", roughness: 0.8, metalness: 0.1 }; // Grass - bright green
      case 2: return { color: "#8B4513", roughness: 0.9, metalness: 0.0 }; // Dirt - brown
      case 3: return { color: "#696969", roughness: 0.3, metalness: 0.2 }; // Stone - gray
      case 4: return { color: "#DEB887", roughness: 0.7, metalness: 0.0 }; // Wood - tan
      case 5: return { color: "#228B22", roughness: 0.8, metalness: 0.0 }; // Leaves - green
      default: return { color: "#FF69B4", roughness: 0.5, metalness: 0.0 }; // Unknown - hot pink
    }
  };

  const material = getBlockMaterial(block.type);

  const handleClick = (event: any) => {
    event.stopPropagation();
    if (onBlockClick) {
      const clickEvent = event.nativeEvent?.button === 2 ? 'place' : 'break';
      onBlockClick(block, clickEvent);
    }
  };

  return (
    <mesh 
      ref={meshRef}
      position={[block.x, block.y, block.z]}
      onClick={handleClick}
      onContextMenu={handleClick}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial 
        color={material.color}
        roughness={material.roughness}
        metalness={material.metalness}
      />
    </mesh>
  );
};

interface ChunkProps {
  blocks: BlockType[];
  chunkKey?: string;
  onBlockClick?: (block: BlockType, event: 'break' | 'place') => void;
}

export const SimpleChunkComponent: React.FC<ChunkProps> = ({ blocks, chunkKey = '', onBlockClick }) => {
  // Optimize chunk rendering with memoization
  const renderableBlocks = useMemo(() => {
    // Filter out air blocks and deduplicate
    const blockMap = new Map<string, BlockType>();
    blocks.forEach(block => {
      if (block.type === 0) return; // Skip air blocks
      const blockKey = `${block.x}-${block.y}-${block.z}`;
      blockMap.set(blockKey, block);
    });
    
    return Array.from(blockMap.values());
  }, [blocks]);

  // Cull faces that are adjacent to other blocks for performance
  const optimizedBlocks = useMemo(() => {
    const blockSet = new Set(
      blocks
        .filter(b => b.type !== 0)
        .map(b => `${b.x},${b.y},${b.z}`)
    );

    return renderableBlocks.map(block => ({
      ...block,
      visibleFaces: {
        top: !blockSet.has(`${block.x},${block.y + 1},${block.z}`),
        bottom: !blockSet.has(`${block.x},${block.y - 1},${block.z}`),
        north: !blockSet.has(`${block.x},${block.y},${block.z + 1}`),
        south: !blockSet.has(`${block.x},${block.y},${block.z - 1}`),
        east: !blockSet.has(`${block.x + 1},${block.y},${block.z}`),
        west: !blockSet.has(`${block.x - 1},${block.y},${block.z}`)
      }
    }));
  }, [renderableBlocks, blocks]);  return (
    <group key={chunkKey}>
      {renderableBlocks.map((block) => (
        <SimpleBlock 
          key={`${chunkKey}-${block.x}-${block.y}-${block.z}`}
          block={block}
          onBlockClick={onBlockClick}
        />
      ))}
    </group>
  );
};
