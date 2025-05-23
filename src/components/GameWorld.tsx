import React, { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, PointerLockControls } from '@react-three/drei';
import { WorldGenerator } from '../utils/worldGenerator';
import { ChunkComponent } from './Block';
import { PlayerController } from './PlayerController';
import type { Chunk } from '../types/game';
import { RENDER_DISTANCE } from '../types/game';

export const GameWorld: React.FC = () => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 50, 0]);
  const [chunks] = useState(() => new Map<string, Chunk>());
  const worldGenerator = useMemo(() => new WorldGenerator(), []);

  const visibleChunks = useMemo(() => {
    const result: Chunk[] = [];
    const playerChunkX = Math.floor(playerPosition[0] / 16);
    const playerChunkZ = Math.floor(playerPosition[2] / 16);

    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const chunkX = playerChunkX + dx;
        const chunkZ = playerChunkZ + dz;
        const key = worldGenerator.getChunkKey(chunkX, chunkZ);

        if (!chunks.has(key)) {
          const chunk = worldGenerator.generateChunk(chunkX, chunkZ);
          chunks.set(key, chunk);
        }

        const chunk = chunks.get(key)!;
        result.push(chunk);
      }
    }

    return result;
  }, [playerPosition, chunks, worldGenerator]);

  const handlePlayerMove = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        onCreated={(state) => {
          state.camera.position.set(...playerPosition);
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />

        {/* Sky */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* Player Controller */}
        <PlayerController
          position={playerPosition}
          onPositionChange={handlePlayerMove}
        />

        {/* World chunks */}
        {visibleChunks.map((chunk) => (
          <ChunkComponent
            key={worldGenerator.getChunkKey(chunk.x, chunk.z)}
            blocks={chunk.blocks}
          />
        ))}

        {/* Camera controls */}
        <PointerLockControls />
      </Canvas>

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <div>Position: {playerPosition.map(p => p.toFixed(1)).join(', ')}</div>
        <div>Chunks loaded: {visibleChunks.length}</div>
        <div>Controls: WASD to move, Space/Shift for up/down, Click to lock mouse</div>
      </div>
    </div>
  );
};
