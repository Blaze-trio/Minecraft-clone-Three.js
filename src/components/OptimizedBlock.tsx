import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useLoader, useFrame } from '@react-three/fiber';
import { TextureLoader, NearestFilter, RepeatWrapping, InstancedMesh, Object3D } from 'three';
import type { Block as BlockType, Chunk } from '../types/game';
import { BLOCK_TYPES } from '../types/game';

// Texture atlas approach for better performance
export const useBlockTextures = () => {
  const textures = useLoader(TextureLoader, [
    '/textures/grass_top.svg',
    '/textures/grass_side.svg',
    '/textures/dirt.svg',
    '/textures/stone.svg',
    '/textures/log_top.svg',
    '/textures/log_side.svg',
    '/textures/leaves.svg',
  ]);

  // Configure textures for pixel art look
  textures.forEach(texture => {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  });

  return textures;
};

// Determine if a block face should be rendered
// This is a crucial optimization - don't render faces that are covered by other blocks
const shouldRenderFace = (
  blocks: Map<string, BlockType>,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number
): boolean => {
  const neighborKey = `${x + dx},${y + dy},${z + dz}`;
  if (!blocks.has(neighborKey)) return true; // Render if no neighbor
  
  const neighborType = blocks.get(neighborKey)!.type;
  return BLOCK_TYPES[neighborType].transparent; // Render if neighbor is transparent
};

// Create a map from block array for efficient lookups
const createBlockMap = (blocks: BlockType[]): Map<string, BlockType> => {
  const blockMap = new Map<string, BlockType>();
  blocks.forEach(block => {
    if (block.type === 0) return; // Skip air blocks
    const blockKey = `${block.x},${block.y},${block.z}`;
    blockMap.set(blockKey, block);
  });
  return blockMap;
};

// Chunk renderer using InstancedMesh for massive performance improvement
export const OptimizedChunk: React.FC<{ chunk: Chunk, chunkX: number, chunkZ: number }> = ({ 
  chunk, 
  chunkX, 
  chunkZ 
}) => {
  // References for each block type instanced mesh
  const meshRefs = useRef<{ [key: number]: THREE.InstancedMesh | null }>({});
  
  // Object used for setting instance positions
  const tempObject = useMemo(() => new Object3D(), []);
  
  // Load all textures
  const textures = useBlockTextures();

  // Create materials for each block type
  const blockMaterials = useMemo(() => {
    return BLOCK_TYPES.map((blockType, index) => {
      if (index === 0) return null; // Air has no material
      
      // Determine which textures to use
      const topTexture = textures[blockType.textureTop ? 
        textures.findIndex((_, i) => blockType.textureTop.includes(textures[i].image?.src?.split('/').pop() || '')) : 0];
      
      const sideTexture = textures[blockType.textureSide ? 
        textures.findIndex((_, i) => blockType.textureSide.includes(textures[i].image?.src?.split('/').pop() || '')) : 0];
      
      const bottomTexture = textures[blockType.textureBottom ? 
        textures.findIndex((_, i) => blockType.textureBottom.includes(textures[i].image?.src?.split('/').pop() || '')) : 0];
      
      // Create six materials for each face of the cube
      return [
        new THREE.MeshLambertMaterial({ map: sideTexture }), // Right
        new THREE.MeshLambertMaterial({ map: sideTexture }), // Left
        new THREE.MeshLambertMaterial({ map: topTexture }),  // Top
        new THREE.MeshLambertMaterial({ map: bottomTexture }), // Bottom
        new THREE.MeshLambertMaterial({ map: sideTexture }), // Front
        new THREE.MeshLambertMaterial({ map: sideTexture }), // Back
      ];
    });
  }, [textures]);

  // Calculate max instances for each block type
  const countByType = useMemo(() => {
    const counts: { [key: number]: number } = {};
    chunk.blocks.forEach(block => {
      if (block.type === 0) return; // Skip air
      counts[block.type] = (counts[block.type] || 0) + 1;
    });
    return counts;
  }, [chunk.blocks]);

  // Update instance positions when chunk data changes
  useEffect(() => {
    if (!chunk || !chunk.blocks?.length) return;
    
    const blockMap = createBlockMap(chunk.blocks);
    const blocksByType: { [key: number]: BlockType[] } = {};
    
    // Group blocks by type to handle them separately
    chunk.blocks.forEach(block => {
      if (block.type === 0) return; // Skip air
      blocksByType[block.type] = blocksByType[block.type] || [];
      blocksByType[block.type].push(block);
    });
    
    // For each block type, update the instanced mesh positions
    Object.entries(blocksByType).forEach(([typeStr, blocks]) => {
      const type = Number(typeStr);
      const mesh = meshRefs.current[type];
      if (!mesh) return;
      
      let instanceIdx = 0;
      
      blocks.forEach(block => {
        const { x, y, z } = block;
        const worldX = x + chunkX * 16;
        const worldZ = z + chunkZ * 16;
        
        // Only render blocks that have at least one visible face
        const hasVisibleFace = 
          shouldRenderFace(blockMap, x, y, z, 1, 0, 0) || 
          shouldRenderFace(blockMap, x, y, z, -1, 0, 0) ||
          shouldRenderFace(blockMap, x, y, z, 0, 1, 0) ||
          shouldRenderFace(blockMap, x, y, z, 0, -1, 0) ||
          shouldRenderFace(blockMap, x, y, z, 0, 0, 1) ||
          shouldRenderFace(blockMap, x, y, z, 0, 0, -1);
          
        if (hasVisibleFace) {
          tempObject.position.set(worldX, y, worldZ);
          tempObject.updateMatrix();
          mesh.setMatrixAt(instanceIdx, tempObject.matrix);
          instanceIdx++;
        }
      });
      
      // Update the instance matrices
      mesh.instanceMatrix.needsUpdate = true;
      // Set the correct count (may be less than max if some blocks don't have visible faces)
      mesh.count = instanceIdx;
    });
  }, [chunk, chunkX, chunkZ]);

  return (
    <group>
      {/* Create an instanced mesh for each block type */}
      {BLOCK_TYPES.map((_, typeId) => {
        if (typeId === 0 || !countByType[typeId]) return null; // Skip air or unused types
        
        return (
          <instancedMesh
            key={typeId}
            ref={(mesh) => { meshRefs.current[typeId] = mesh; }}
            args={[
              undefined, 
              undefined, 
              countByType[typeId] // Max number of instances
            ]}
            frustumCulled={true} // Enable frustum culling for better performance
            material={blockMaterials[typeId]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </instancedMesh>
        );
      })}
    </group>
  );
};