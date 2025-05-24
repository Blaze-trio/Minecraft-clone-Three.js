import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, NearestFilter, RepeatWrapping } from 'three';
import type { Block, Chunk } from '../types/game';
import { BLOCK_TYPES, CHUNK_SIZE } from '../types/game';

// LOD (Level of Detail) settings - Extremely aggressive distance thresholds
const LOD_LEVELS = 4;          // Increased number of detail levels
const LOD_DISTANCES = [        // Extremely aggressive distances for each LOD level
  10,                          // Level 0 (highest detail) up to 10 units away (reduced from 20)
  20,                          // Level 1 (medium detail) up to 20 units away (reduced from 35)
  35,                          // Level 2 (low detail) up to 35 units away (reduced from 70)
  60                           // Level 3 (minimum detail) up to 60 units away (reduced from 120)
];

// Maximum blocks per LOD level to prevent geometry explosion - Extreme reduction
const MAX_BLOCKS_PER_LOD = [
  200,   // Level 0: Extremely reduced from 1200
  100,   // Level 1: Extremely reduced from 600  
  50,    // Level 2: Extremely reduced from 300
  25     // Level 3: Extremely reduced from 150
];

// Texture atlas loader with improved caching
const TextureCache = new Map<string, THREE.Texture>();
const useTextureAtlas = () => {
  const textureUrls = useMemo(() => [
    '/textures/grass_top.svg',
    '/textures/grass_side.svg',
    '/textures/dirt.svg',
    '/textures/stone.svg',
    '/textures/log_top.svg',
    '/textures/log_side.svg',
    '/textures/leaves.svg'
  ], []);

  const textures = useLoader(TextureLoader, textureUrls);

  // Configure textures for pixel art look
  textures.forEach(texture => {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false; // Disable mipmaps for pixel art
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  });

  return textures;
};

// Calculate face visibility efficiently
const calculateVisibleFaces = (
  blocks: Map<string, Block>,
  x: number,
  y: number,
  z: number
): boolean[] => {
  const faces = [false, false, false, false, false, false]; // right, left, top, bottom, front, back
    // Check each face with defensive programming
  const checkNeighbor = (dx: number, dy: number, dz: number, faceIndex: number) => {
    const neighborKey = `${x + dx},${y + dy},${z + dz}`;
    if (!blocks.has(neighborKey)) {
      faces[faceIndex] = true;
      return;
    }
    
    const neighbor = blocks.get(neighborKey);
    if (!neighbor) {
      faces[faceIndex] = true;
      return;
    }
    
    const neighborType = neighbor.type;
    // Safety check for valid block type
    if (neighborType < 0 || neighborType >= BLOCK_TYPES.length || BLOCK_TYPES[neighborType].transparent) {
      faces[faceIndex] = true;
    }
  };
  
  checkNeighbor(1, 0, 0, 0);  // Right face
  checkNeighbor(-1, 0, 0, 1); // Left face
  checkNeighbor(0, 1, 0, 2);  // Top face
  checkNeighbor(0, -1, 0, 3); // Bottom face
  checkNeighbor(0, 0, 1, 4);  // Front face
  checkNeighbor(0, 0, -1, 5); // Back face
  
  return faces;
};

// Create block geometry based on visible faces with aggressive optimization
const createBlockGeometry = (
  blocks: Block[],
  lodLevel: number
): { positions: number[], indices: number[], uvs: number[], blockTypes: number[] } => {
  // Create a map for quick lookups
  const blockMap = new Map<string, Block>();
  blocks.forEach(block => {
    if (block.type === 0) return; // Skip air
    const blockKey = `${block.x},${block.y},${block.z}`;
    blockMap.set(blockKey, block);
  });
  
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const blockTypes: number[] = [];
  
  let vertexCount = 0;
  
  // Limit the number of blocks processed based on LOD level
  const maxBlocks = MAX_BLOCKS_PER_LOD[lodLevel] || 150;
  let processedBlocks = 0;

  // Process blocks based on LOD level with more aggressive culling
  const skipRate = Math.pow(2, lodLevel); // Skip blocks for lower detail
  const heightCulling = lodLevel > 1; // Enable height-based culling for distant chunks
  
  blocks.forEach((block) => {
    // Stop processing if we've hit the limit for this LOD level
    if (processedBlocks >= maxBlocks) return;
    
    // Skip blocks based on LOD level with more aggressive patterns
    if (lodLevel > 0) {
      if (block.x % skipRate !== 0 || 
          block.z % skipRate !== 0 ||
          (lodLevel > 1 && block.y % skipRate !== 0)) return;
    }
    
    // For distant chunks, only show surface and important blocks
    if (heightCulling && lodLevel > 2) {
      // Only show blocks at surface level or high/low extremes
      const isSurface = blocks.some(other => 
        other.x === block.x && other.z === block.z && 
        other.y === block.y + 1 && other.type === 0
      );
      const isExtreme = block.y < 10 || block.y > 50;
      if (!isSurface && !isExtreme) return;
    }

    if (block.type === 0) return; // Skip air blocks

    // Get visible faces
    const visibleFaces = calculateVisibleFaces(blockMap, block.x, block.y, block.z);
    
    // Skip if no visible faces
    if (!visibleFaces.some(face => face)) return;

    // Scale factor for lower LOD levels
    const scale = Math.pow(2, lodLevel);
    
    processedBlocks++;

    // Add vertices for each visible face (same as before)
    if (visibleFaces[0]) { // Right face (+X)
      blockTypes.push(block.type);
      addFaceVertices(positions, indices, uvs, block, 0, scale, vertexCount);
      vertexCount += 4;
    }
    
    if (visibleFaces[1]) { // Left face (-X)
      blockTypes.push(block.type);
      addFaceVertices(positions, indices, uvs, block, 1, scale, vertexCount);
      vertexCount += 4;
    }
    
    if (visibleFaces[2]) { // Top face (+Y)
      blockTypes.push(block.type);
      addFaceVertices(positions, indices, uvs, block, 2, scale, vertexCount);
      vertexCount += 4;
    }
    
    if (visibleFaces[3]) { // Bottom face (-Y)
      blockTypes.push(block.type);
      addFaceVertices(positions, indices, uvs, block, 3, scale, vertexCount);
      vertexCount += 4;
    }
    
    if (visibleFaces[4]) { // Front face (+Z)
      blockTypes.push(block.type);
      addFaceVertices(positions, indices, uvs, block, 4, scale, vertexCount);
      vertexCount += 4;
    }
    
    if (visibleFaces[5]) { // Back face (-Z)
      blockTypes.push(block.type);
      addFaceVertices(positions, indices, uvs, block, 5, scale, vertexCount);
      vertexCount += 4;
    }
  });

  return { positions, indices, uvs, blockTypes };
};

// Add vertices for a single face
const addFaceVertices = (
  positions: number[],
  indices: number[],
  uvs: number[],
  block: Block,
  faceIndex: number,
  scale: number,
  vertexOffset: number
) => {
  const { x, y, z } = block;
  const s = scale / 2; // Half-size for vertex positioning
  
  // Define face vertices based on face index
  switch (faceIndex) {
    case 0: // Right face (+X)
      positions.push(
        x + s, y - s, z - s,
        x + s, y + s, z - s,
        x + s, y + s, z + s,
        x + s, y - s, z + s
      );
      break;
    case 1: // Left face (-X)
      positions.push(
        x - s, y - s, z + s,
        x - s, y + s, z + s,
        x - s, y + s, z - s,
        x - s, y - s, z - s
      );
      break;
    case 2: // Top face (+Y)
      positions.push(
        x - s, y + s, z - s,
        x - s, y + s, z + s,
        x + s, y + s, z + s,
        x + s, y + s, z - s
      );
      break;
    case 3: // Bottom face (-Y)
      positions.push(
        x - s, y - s, z + s,
        x - s, y - s, z - s,
        x + s, y - s, z - s,
        x + s, y - s, z + s
      );
      break;
    case 4: // Front face (+Z)
      positions.push(
        x + s, y - s, z + s,
        x + s, y + s, z + s,
        x - s, y + s, z + s,
        x - s, y - s, z + s
      );
      break;
    case 5: // Back face (-Z)
      positions.push(
        x - s, y - s, z - s,
        x - s, y + s, z - s,
        x + s, y + s, z - s,
        x + s, y - s, z - s
      );
      break;
  }
  
  // Add indices for this face
  indices.push(
    vertexOffset, vertexOffset + 1, vertexOffset + 2,
    vertexOffset, vertexOffset + 2, vertexOffset + 3
  );
  
  // Add UVs for this face
  uvs.push(
    0, 0,
    0, 1,
    1, 1,
    1, 0
  );
};

// Enhanced chunk renderer with LOD support
export const ChunkLOD: React.FC<{ 
  chunk: Chunk, 
  playerPosition: [number, number, number],
  chunkX: number, 
  chunkZ: number 
}> = ({ chunk, playerPosition, chunkX, chunkZ }) => {
  const textures = useTextureAtlas();
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const lastLodLevel = useRef<number>(-1);
  const geometries = useRef<THREE.BufferGeometry[]>([]);
  const materials = useRef<THREE.Material[]>([]);
  
  // Calculate center of chunk
  const chunkCenter = useMemo(() => {
    return new THREE.Vector3(
      chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
      32, // Approximate average height
      chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2
    );
  }, [chunkX, chunkZ]);
  
  // Calculate current LOD level based on distance to player
  const calculateLODLevel = (playerPos: [number, number, number]) => {
    const playerVec = new THREE.Vector3(...playerPos);
    const distance = playerVec.distanceTo(chunkCenter);
    
    for (let i = 0; i < LOD_LEVELS; i++) {
      if (distance < LOD_DISTANCES[i]) {
        return i;
      }
    }
    return LOD_LEVELS - 1; // Furthest LOD level
  };
    // Generate geometry for a specific LOD level
  const generateLODGeometry = (lodLevel: number) => {
    if (geometries.current[lodLevel]) {
      return geometries.current[lodLevel]; // Return cached geometry
    }
    
    // Safety check - if no blocks or chunk not ready, return empty geometry
    if (!chunk || !chunk.blocks || chunk.blocks.length === 0) {
      const emptyGeometry = new THREE.BufferGeometry();
      geometries.current[lodLevel] = emptyGeometry;
      return emptyGeometry;
    }
    
    // Create a map from block array for efficient lookups
    const blockMap = new Map<string, Block>();
    chunk.blocks.forEach(block => {
      if (!block || block.type === 0) return; // Skip air or invalid blocks
      const blockKey = `${block.x},${block.y},${block.z}`;
      blockMap.set(blockKey, block);
    });
      try {
      // Generate the geometry data based on LOD level
      const { positions, indices, uvs, blockTypes } = createBlockGeometry(chunk.blocks, lodLevel);
      
      // Create THREE.js geometry
      const geometry = new THREE.BufferGeometry();
      
      // Add attributes to geometry - with proper error handling
      if (positions.length > 0 && indices.length > 0 && uvs.length > 0) {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        
        // Store block types for shader use (optional)
        if (blockTypes.length > 0) {
          geometry.setAttribute('blockType', new THREE.Float32BufferAttribute(blockTypes, 1));
        }
        
        // Compute bounding info
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
      }
        // Extremely aggressive hard cap: if geometry is too large, replace with empty geometry
      const MAX_VERTICES = 1000; // Drastically reduced from 10000
      const MAX_FACES = 500;      // Drastically reduced from 5000
      const index = geometry.getIndex();
      if (
        geometry.getAttribute('position')?.count > MAX_VERTICES ||
        (index && index.count / 3 > MAX_FACES)
      ) {
        console.warn(`ChunkLOD: Geometry for chunk (${chunkX},${chunkZ}) LOD ${lodLevel} exceeded safe limits (${geometry.getAttribute('position')?.count} vertices, ${index ? index.count / 3 : 0} faces), replacing with empty geometry.`);
        const emptyGeometry = new THREE.BufferGeometry();
        geometries.current[lodLevel] = emptyGeometry;
        return emptyGeometry;
      }
      
      return geometry;
    } catch (error) {
      console.error("Error generating geometry:", error);
      const emptyGeometry = new THREE.BufferGeometry();
      geometries.current[lodLevel] = emptyGeometry;
      return emptyGeometry; // Return empty geometry on error
    }
  };
  
  // Create materials for each block type
  const createMaterials = () => {
    if (materials.current.length > 0) return materials.current;
    
    const blockMaterials = BLOCK_TYPES.map((blockType, index) => {
      if (index === 0) return null; // Air has no material
      
      // Find textures by matching file names
      const topTexIndex = textures.findIndex(tex => 
        tex.image?.src?.includes(blockType.textureTop.split('/').pop() || ''));
      const sideTexIndex = textures.findIndex(tex => 
        tex.image?.src?.includes(blockType.textureSide.split('/').pop() || ''));
      const bottomTexIndex = textures.findIndex(tex => 
        tex.image?.src?.includes(blockType.textureBottom.split('/').pop() || ''));
      
      // Get textures or use fallbacks
      const topTex = topTexIndex >= 0 ? textures[topTexIndex] : textures[0];
      const sideTex = sideTexIndex >= 0 ? textures[sideTexIndex] : textures[0];
      const bottomTex = bottomTexIndex >= 0 ? textures[bottomTexIndex] : textures[0];        // Create material array for the six faces of the cube
      return [
        new THREE.MeshLambertMaterial({ map: sideTex, transparent: blockType.transparent, alphaTest: 0.1 }) as THREE.Material, // right
        new THREE.MeshLambertMaterial({ map: sideTex, transparent: blockType.transparent, alphaTest: 0.1 }) as THREE.Material, // left
        new THREE.MeshLambertMaterial({ map: topTex, transparent: blockType.transparent, alphaTest: 0.1 }) as THREE.Material,  // top
        new THREE.MeshLambertMaterial({ map: bottomTex, transparent: blockType.transparent, alphaTest: 0.1 }) as THREE.Material, // bottom
        new THREE.MeshLambertMaterial({ map: sideTex, transparent: blockType.transparent, alphaTest: 0.1 }) as THREE.Material, // front
        new THREE.MeshLambertMaterial({ map: sideTex, transparent: blockType.transparent, alphaTest: 0.1 }) as THREE.Material  // back
      ];
    });
    
    materials.current = blockMaterials.flat().filter((mat): mat is THREE.Material => Boolean(mat));
    return materials.current;
  };
    // Advanced mesh culling and optimization
  useFrame(({ camera }) => {
    if (!chunk || !chunk.blocks?.length) return;
    
    // Calculate current LOD level
    const currentLODLevel = calculateLODLevel(playerPosition);
    
    // Calculate distance to camera for occlusion culling
    const chunkCenterWorld = new THREE.Vector3(
      chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
      32, // Approximate terrain height
      chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2
    );
    
    const distanceToCamera = chunkCenterWorld.distanceTo(camera.position);
    
    // Skip updates for very distant chunks (beyond frustum)
    if (distanceToCamera > LOD_DISTANCES[LOD_LEVELS-1] * 1.5) {
      // Hide all meshes for distant chunks
      meshRefs.current.forEach(mesh => {
        if (mesh) mesh.visible = false;
      });
      return;
    }
    
    // Optimize update frequency based on distance
    // Update distant chunks less frequently
    if (distanceToCamera > LOD_DISTANCES[1]) {
      // For distant chunks, only update every 10 frames
      if (Math.random() > 0.1) return;
    }
    
    // Only update if LOD level has changed
    if (lastLodLevel.current !== currentLODLevel) {
      lastLodLevel.current = currentLODLevel;
      
      // Hide all meshes first
      meshRefs.current.forEach(mesh => {
        if (mesh) mesh.visible = false;
      });
      
      // Show the correct LOD mesh
      if (meshRefs.current[currentLODLevel]) {
        const mesh = meshRefs.current[currentLODLevel];
        if (mesh) {
          mesh.visible = true;          // Update geometry if needed - with defensive checks
          try {
            if (!mesh.geometry || 
                !mesh.geometry.attributes || 
                typeof mesh.geometry.attributes.position === 'undefined' ||
                (mesh.geometry.attributes.position && mesh.geometry.attributes.position.count === 0)) {
              mesh.geometry = generateLODGeometry(currentLODLevel);
            }
          } catch (error) {
            console.error("Error checking geometry attributes:", error);
            mesh.geometry = generateLODGeometry(currentLODLevel);
          }          // Apply material optimization based on distance
          try {
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              
              materials.forEach(mat => {
                if (mat && mat instanceof THREE.MeshLambertMaterial) {
                  // Toggle material quality based on distance
                  if (currentLODLevel > 1) {
                    mat.precision = "lowp";
                    mat.vertexColors = false;
                  } else {
                    mat.precision = "mediump";
                  }
                }
              });
            }
          } catch (error) {
            console.error("Error optimizing materials:", error);
          }
        }
      }
    }
  });
  
  // Initialize chunk meshes
  useEffect(() => {
    if (!chunk || !chunk.blocks?.length) return;
    
    // Create materials if needed
    createMaterials();
    
    // Generate initial geometry for LOD level 0 (highest detail)
    generateLODGeometry(0);
    
    // Mark the chunk as needing an LOD update
    lastLodLevel.current = -1;
  }, [chunk, textures]);
  
  return (
    <group position={[chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE]}>
      {/* Create a mesh for each LOD level */}
      {Array.from({ length: LOD_LEVELS }).map((_, lodLevel) => (      <mesh
          key={`lod-${lodLevel}`}
          ref={(mesh) => { if (mesh) meshRefs.current[lodLevel] = mesh; }}
          geometry={geometries.current[lodLevel] || new THREE.BufferGeometry()}
          material={materials.current.length > 0 ? materials.current : [new THREE.MeshBasicMaterial()]}
          visible={false}
          castShadow={lodLevel === 0} // Only highest detail casts shadows
          receiveShadow={lodLevel === 0}
          frustumCulled={true}
        />
      ))}
    </group>
  );
};
