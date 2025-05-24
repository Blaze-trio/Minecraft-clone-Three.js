import React, { useState, useCallback, useMemo, useRef, Suspense, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls, Sky } from '@react-three/drei';
import { useHUDState, GameHUD, Crosshair, ControlsHint } from './GameHUD';
import type { Block } from '../types/game';
import * as THREE from 'three';

// Simple colored block without textures
const SimpleBlock: React.FC<{ block: Block }> = ({ block }) => {
  if (block.type === 0) return null; // Don't render air
  
  const getBlockColor = (type: number) => {
    switch (type) {
      case 1: return '#90EE90'; // Grass - Light green
      case 2: return '#8B4513'; // Dirt - Brown  
      case 3: return '#808080'; // Stone - Gray
      case 4: return '#654321'; // Wood - Dark brown
      case 5: return '#228B22'; // Leaves - Dark green
      default: return '#FFFFFF';
    }
  };
  return (
    <mesh position={[block.x, block.y, block.z]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={getBlockColor(block.type)} />
    </mesh>
  );
};

// Stable world generator - creates terrain once and stores it
class StableSimpleWorldGenerator {
  private generatedChunks = new Map<string, Block[]>();
  
  generateChunk(chunkX: number, chunkZ: number): Block[] {
    const key = `${chunkX},${chunkZ}`;
    
    if (this.generatedChunks.has(key)) {
      return this.generatedChunks.get(key)!;
    }
    
    const blocks: Block[] = [];
    const CHUNK_SIZE = 16;
      for (let x = chunkX * CHUNK_SIZE; x < (chunkX + 1) * CHUNK_SIZE; x += 2) { // Skip every other block for performance
      for (let z = chunkZ * CHUNK_SIZE; z < (chunkZ + 1) * CHUNK_SIZE; z += 2) { // Skip every other block for performance
        // Generate height using simple noise
        const height = Math.floor(2 + Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2); // Reduced amplitude
        
        // Generate only essential terrain layers
        for (let y = Math.max(-2, height - 2); y <= height; y++) { // Reduced depth
          if (y === height) {
            blocks.push({ type: 1, x, y, z }); // Grass top
          } else if (y >= height - 1) {
            blocks.push({ type: 2, x, y, z }); // Dirt (only 1 layer)
          } else {
            blocks.push({ type: 3, x, y, z }); // Stone
          }
        }
          // Add some random features (prevent overlapping blocks) - reduced frequency
        const featureRand = Math.random();
        if (featureRand < 0.01 && height >= 0) { // Much lower chance
          blocks.push({ type: 4, x, y: height + 1, z }); // Wood (exclusive)
        } else if (featureRand < 0.015 && height >= 0) { // Much lower chance
          blocks.push({ type: 5, x, y: height + 1, z }); // Leaves (exclusive)
        }
      }
    }
      this.generatedChunks.set(key, blocks);
    
    // Deduplicate blocks by position (remove duplicates)
    const blockMap = new Map<string, Block>();
    blocks.forEach(block => {
      const blockKey = `${block.x},${block.y},${block.z}`;
      if (!blockMap.has(blockKey)) {
        blockMap.set(blockKey, block);
      }
    });
    const deduplicatedBlocks = Array.from(blockMap.values());
    
    this.generatedChunks.set(key, deduplicatedBlocks);
    console.log(`🌍 Generated stable chunk (${chunkX}, ${chunkZ}) with ${deduplicatedBlocks.length} blocks (${blocks.length - deduplicatedBlocks.length} duplicates removed)`);
    return deduplicatedBlocks;
  }
  
  getBlockAt(x: number, y: number, z: number): number {
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);
    const blocks = this.generateChunk(chunkX, chunkZ);
    
    const block = blocks.find(b => 
      Math.floor(b.x) === Math.floor(x) && 
      Math.floor(b.y) === Math.floor(y) && 
      Math.floor(b.z) === Math.floor(z)
    );
    
    return block ? block.type : 0; // 0 = air
  }
}

const worldGenerator = new StableSimpleWorldGenerator();

// Enhanced Player Controller with collision detection
interface EnhancedPlayerControllerProps {
  position: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
}

const EnhancedPlayerController: React.FC<EnhancedPlayerControllerProps> = ({
  position,
  onPositionChange
}) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isOnGround = useRef(false);
  const keys = useRef({
    w: false, a: false, s: false, d: false,
    space: false, shift: false
  });

  // Set up keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW': keys.current.w = true; break;
        case 'KeyA': keys.current.a = true; break;
        case 'KeyS': keys.current.s = true; break;
        case 'KeyD': keys.current.d = true; break;
        case 'Space': 
          if (isOnGround.current) {
            velocity.current.y = 8; // Jump
          }
          keys.current.space = true; 
          event.preventDefault(); 
          break;
        case 'ShiftLeft': keys.current.shift = true; break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW': keys.current.w = false; break;
        case 'KeyA': keys.current.a = false; break;
        case 'KeyS': keys.current.s = false; break;
        case 'KeyD': keys.current.d = false; break;
        case 'Space': keys.current.space = false; break;
        case 'ShiftLeft': keys.current.shift = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Check if a position is solid (has a block)
  const isPositionSolid = useCallback((x: number, y: number, z: number): boolean => {
    return worldGenerator.getBlockAt(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;
  }, []);  useFrame((_state, delta) => {
    // Limit delta to prevent large jumps
    delta = Math.min(delta, 1/30); // Cap at 30 FPS minimum
    
    const moveSpeed = 6;
    const gravity = -20;
    
    // Get camera direction for movement
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    // Horizontal movement
    const moveVector = new THREE.Vector3(0, 0, 0);
    if (keys.current.w) moveVector.add(direction);
    if (keys.current.s) moveVector.sub(direction);
    if (keys.current.a) moveVector.sub(right);
    if (keys.current.d) moveVector.add(right);
    
    moveVector.normalize();
    moveVector.multiplyScalar(moveSpeed);

    // Apply gravity
    velocity.current.y += gravity * delta;
    
    // Calculate new position
    let newX = position[0] + moveVector.x * delta;
    let newY = position[1] + velocity.current.y * delta;
    let newZ = position[2] + moveVector.z * delta;

    // Player bounding box (slightly smaller than a full block)
    const playerWidth = 0.6;
    const playerHeight = 1.8;

    // Horizontal collision detection (X axis)
    let canMoveX = true;
    for (let y = 0; y < playerHeight; y += 0.5) {
      if (moveVector.x > 0) { // Moving right
        if (isPositionSolid(newX + playerWidth/2, position[1] + y, position[2])) {
          canMoveX = false;
          break;
        }
      } else if (moveVector.x < 0) { // Moving left
        if (isPositionSolid(newX - playerWidth/2, position[1] + y, position[2])) {
          canMoveX = false;
          break;
        }
      }
    }
    
    if (!canMoveX) newX = position[0];

    // Horizontal collision detection (Z axis)
    let canMoveZ = true;
    for (let y = 0; y < playerHeight; y += 0.5) {
      if (moveVector.z > 0) { // Moving forward
        if (isPositionSolid(newX, position[1] + y, newZ + playerWidth/2)) {
          canMoveZ = false;
          break;
        }
      } else if (moveVector.z < 0) { // Moving backward
        if (isPositionSolid(newX, position[1] + y, newZ - playerWidth/2)) {
          canMoveZ = false;
          break;
        }
      }
    }
    
    if (!canMoveZ) newZ = position[2];

    // Vertical collision detection
    isOnGround.current = false;
    
    if (velocity.current.y <= 0) { // Falling or on ground
      // Check if there's ground beneath the player
      if (isPositionSolid(newX, Math.floor(newY - 0.1), newZ)) {
        newY = Math.floor(newY - 0.1) + 1; // Stand on top of the block
        velocity.current.y = 0;
        isOnGround.current = true;
      }
    } else { // Rising (jumping)
      // Check for ceiling collision
      if (isPositionSolid(newX, Math.ceil(newY + playerHeight), newZ)) {
        velocity.current.y = 0;
        newY = Math.ceil(newY + playerHeight) - playerHeight;
      }
    }

    const finalPosition: [number, number, number] = [newX, newY, newZ];

    // Update camera position
    camera.position.set(...finalPosition);
    
    // Call position change callback
    onPositionChange(finalPosition);
  });

  return null;
};

// Stable world renderer that only loads chunks when needed
const StableWorldRenderer: React.FC<{ playerPosition: [number, number, number] }> = ({ playerPosition }) => {
  const [loadedChunks, setLoadedChunks] = useState<Map<string, Block[]>>(new Map());
  const lastPlayerChunk = useRef({ x: 0, z: 0 });
  
  const RENDER_DISTANCE = 2; // Reduced from 3 for better performance
  
  useEffect(() => {
    const playerChunkX = Math.floor(playerPosition[0] / 16);
    const playerChunkZ = Math.floor(playerPosition[2] / 16);
    
    // Only update chunks if player moved to a different chunk
    if (playerChunkX !== lastPlayerChunk.current.x || playerChunkZ !== lastPlayerChunk.current.z) {
      lastPlayerChunk.current = { x: playerChunkX, z: playerChunkZ };
      
      const newChunks = new Map<string, Block[]>();
      
      // Load chunks around player
      for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
        for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
          const key = `${x},${z}`;
          const blocks = worldGenerator.generateChunk(x, z);
          newChunks.set(key, blocks);
        }
      }
      
      setLoadedChunks(newChunks);
      console.log(`🌍 Loaded ${newChunks.size} chunks around player chunk (${playerChunkX}, ${playerChunkZ})`);
    }
  }, [playerPosition]);
    // Combine all blocks from loaded chunks with chunk-aware keys
  const allBlocks = useMemo(() => {
    const blocks: (Block & { chunkKey: string })[] = [];
    for (const [chunkKey, chunkBlocks] of loadedChunks.entries()) {
      chunkBlocks.forEach(block => {
        blocks.push({ ...block, chunkKey });
      });
    }
    return blocks;
  }, [loadedChunks]);
    
  return (
    <group>
      {allBlocks.map((block) => (
        <SimpleBlock 
          key={`${block.chunkKey}-${block.x}-${block.y}-${block.z}`} 
          block={block} 
        />
      ))}
    </group>
  );
};

// Main component for stable world with collision detection
export const SimpleTestWorld: React.FC = () => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 10, 0]);
  const { hudData } = useHUDState();

  const handlePlayerMove = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200, position: [0, 10, 0] }} // Reduced far distance
        shadows={false}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          precision: 'mediump',
          alpha: false,
          stencil: false,
        }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={1} 
            castShadow={false}
          />

          {/* Sky */}
          <Sky sunPosition={[100, 20, 100]} />

          {/* Enhanced Player Controller with collision */}
          <EnhancedPlayerController
            position={playerPosition}
            onPositionChange={handlePlayerMove}
          />

          {/* Stable World Renderer */}
          <StableWorldRenderer playerPosition={playerPosition} />

          {/* Camera controls */}
          <PointerLockControls />
        </Suspense>
      </Canvas>

      {/* HUD */}
      <GameHUD hudData={hudData} />
      <Crosshair />
      <ControlsHint />
      
      {/* Info overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        zIndex: 1000
      }}>
        <div style={{color: '#4CAF50', fontWeight: 'bold', marginBottom: '10px'}}>
          🎮 Basic 3D World - Enhanced
        </div>
        <div>✅ Stable terrain generation</div>
        <div>✅ Player collision detection</div>
        <div>✅ Gravity and jumping</div>
        <div>✅ Chunk-based loading</div>
        <div style={{marginTop: '10px', fontSize: '12px', color: '#ccc'}}>
          Position: {playerPosition.map(p => p.toFixed(1)).join(', ')}
        </div>
        <div style={{fontSize: '12px', color: '#ccc'}}>
          Controls: WASD + Mouse + Space to jump
        </div>
      </div>
    </div>
  );
};

export default SimpleTestWorld;
