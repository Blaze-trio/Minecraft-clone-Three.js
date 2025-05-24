import React, { useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls, Sky } from '@react-three/drei';
import { PlayerController } from './PlayerController';
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
      <meshLambertMaterial 
        color={getBlockColor(block.type)}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
};

// Simple world generator - creates a flat world with some blocks
const generateSimpleWorld = (playerPosition: [number, number, number]) => {
  const blocks: Block[] = [];
  const [px, py, pz] = playerPosition;
  
  // Generate a simple 16x16 platform around the player
  const chunkX = Math.floor(px / 16);
  const chunkZ = Math.floor(pz / 16);
  
  for (let x = chunkX * 16; x < (chunkX + 1) * 16; x++) {
    for (let z = chunkZ * 16; z < (chunkZ + 1) * 16; z++) {
      // Ground level
      blocks.push({ type: 1, x, y: 0, z }); // Grass
      blocks.push({ type: 2, x, y: -1, z }); // Dirt
      blocks.push({ type: 3, x, y: -2, z }); // Stone
      
      // Add some random blocks for variety
      if (Math.random() < 0.1) {
        blocks.push({ type: 4, x, y: 1, z }); // Wood
      }
      if (Math.random() < 0.05) {
        blocks.push({ type: 5, x, y: 2, z }); // Leaves
      }
    }
  }
  
  return blocks;
};

// World renderer component
const WorldRenderer: React.FC<{ playerPosition: [number, number, number] }> = ({ playerPosition }) => {
  const blocks = useMemo(() => generateSimpleWorld(playerPosition), [playerPosition]);
  
  console.log(`🌍 Rendering ${blocks.length} blocks around player position`, playerPosition);
  
  return (
    <group>
      {blocks.map((block, index) => (
        <SimpleBlock key={`${block.x}-${block.y}-${block.z}`} block={block} />
      ))}
    </group>
  );
};

// Main component for testing world without texture loading
export const SimpleTestWorld: React.FC = () => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 5, 0]);
  const { hudData } = useHUDState();

  const handlePlayerMove = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 5, 0] }}
        shadows={false}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          precision: 'mediump',
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

          {/* Player Controller */}
          <PlayerController
            position={playerPosition}
            onPositionChange={handlePlayerMove}
          />

          {/* World */}
          <WorldRenderer playerPosition={playerPosition} />

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
          🎮 Simple Test World
        </div>
        <div>✅ No texture loading</div>
        <div>✅ Simple colored blocks</div>
        <div>✅ Basic world generation</div>
        <div>✅ Player controller</div>
        <div style={{marginTop: '10px', fontSize: '12px', color: '#ccc'}}>
          Position: {playerPosition.map(p => p.toFixed(1)).join(', ')}
        </div>
      </div>
    </div>
  );
};

export default SimpleTestWorld;
