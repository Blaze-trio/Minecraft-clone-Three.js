// Stable Minecraft World with Realistic Terrain and Collision
import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PointerLockControls, Sky } from '@react-three/drei';
import { stableWorldGenerator } from '../utils/stableWorldGenerator';
import { SimpleChunkComponent } from './SimpleBlock';
import { StablePlayerController } from './StablePlayerController';
import { useHUDState, GameHUD, Crosshair, ControlsHint, HUDUpdater } from './GameHUD';
import { MemoryManager } from './WebGLContextManager';
import { EnhancedWebGLMonitor } from './EnhancedWebGLMonitor';
import type { Chunk } from '../types/game';
import { CHUNK_SIZE } from '../types/game';

// Stable Chunk Manager with less aggressive loading/unloading
const StableChunkManager: React.FC<{
  playerPosition: [number, number, number];
  onChunksChange: (chunks: Map<string, Chunk>) => void;
}> = ({ playerPosition, onChunksChange }) => {
  const chunksRef = useRef(new Map<string, Chunk>());
  const loadingChunks = useRef(new Set<string>());
  const lastPlayerChunk = useRef({ x: 0, z: 0 });
  
  // Stable chunk loading parameters
  const RENDER_DISTANCE = 4; // Smaller render distance for stability
  const UNLOAD_DISTANCE = 6; // Don't unload chunks too aggressively
  
  const getPlayerChunk = useCallback(() => {
    return {
      x: Math.floor(playerPosition[0] / CHUNK_SIZE),
      z: Math.floor(playerPosition[2] / CHUNK_SIZE)
    };
  }, [playerPosition]);

  const loadChunk = useCallback(async (chunkX: number, chunkZ: number) => {
    const key = `${chunkX},${chunkZ}`;
    
    if (chunksRef.current.has(key) || loadingChunks.current.has(key)) {
      return;
    }
    
    loadingChunks.current.add(key);
    
    try {
      // Generate chunk synchronously for stability
      const chunk = stableWorldGenerator.generateChunk(chunkX, chunkZ);
      
      chunksRef.current.set(key, chunk);
      onChunksChange(new Map(chunksRef.current));
      
      console.log(`🌍 StableChunkManager: Loaded chunk (${chunkX}, ${chunkZ})`);
    } catch (error) {
      console.error(`❌ Failed to load chunk (${chunkX}, ${chunkZ}):`, error);
    } finally {
      loadingChunks.current.delete(key);
    }
  }, [onChunksChange]);

  const unloadDistantChunks = useCallback(() => {
    const playerChunk = getPlayerChunk();
    const toRemove: string[] = [];
    
    for (const [key, chunk] of chunksRef.current.entries()) {
      const distance = Math.sqrt(
        (chunk.x - playerChunk.x) ** 2 + (chunk.z - playerChunk.z) ** 2
      );
      
      if (distance > UNLOAD_DISTANCE) {
        toRemove.push(key);
      }
    }
    
    // Only unload if we have too many chunks
    if (chunksRef.current.size > 25) {
      toRemove.forEach(key => {
        chunksRef.current.delete(key);
        console.log(`🗑️  StableChunkManager: Unloaded distant chunk ${key}`);
      });
      
      if (toRemove.length > 0) {
        onChunksChange(new Map(chunksRef.current));
      }
    }
  }, [getPlayerChunk, onChunksChange]);

  // Load chunks around player
  useEffect(() => {
    const playerChunk = getPlayerChunk();
    
    // Only update if player moved to a different chunk
    if (playerChunk.x !== lastPlayerChunk.current.x || 
        playerChunk.z !== lastPlayerChunk.current.z) {
      
      lastPlayerChunk.current = playerChunk;
      
      // Load chunks in spiral pattern for smoother loading
      const chunksToLoad = stableWorldGenerator.getChunksInRadius(
        playerChunk.x, 
        playerChunk.z, 
        RENDER_DISTANCE
      );
      
      // Load new chunks
      chunksToLoad.forEach(chunk => {
        loadChunk(chunk.x, chunk.z);
      });
      
      // Unload distant chunks less frequently
      if (Math.random() < 0.1) { // Only 10% chance to unload
        unloadDistantChunks();
      }
    }
  }, [playerPosition, loadChunk, unloadDistantChunks, getPlayerChunk]);

  return null;
};

// Main stable world component
const StableMinecraftWorld: React.FC = () => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([8, 80, 8]);
  const [chunks, setChunks] = useState<Map<string, Chunk>>(new Map());
  const hudState = useHUDState();

  // Render visible chunks
  const visibleChunks = useMemo(() => {
    return Array.from(chunks.values()).filter(chunk => chunk.isReady);
  }, [chunks]);

  const handleChunksChange = useCallback((newChunks: Map<string, Chunk>) => {
    setChunks(newChunks);
  }, []);

  const handlePlayerMove = useCallback((newPosition: [number, number, number]) => {
    setPlayerPosition(newPosition);
  }, []);

  console.log(`🎮 StableMinecraftWorld: Rendering with ${visibleChunks.length} chunks, player at (${playerPosition[0].toFixed(1)}, ${playerPosition[1].toFixed(1)}, ${playerPosition[2].toFixed(1)})`);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ 
          position: playerPosition, 
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        gl={{ 
          antialias: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
      >
        <Suspense fallback={null}>
          {/* Enhanced Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[50, 100, 50]} 
            intensity={0.8}
            castShadow={false}
          />
          
          {/* Beautiful Sky */}
          <Sky
            distance={450000}
            sunPosition={[100, 20, 100]}
            inclination={0}
            azimuth={0.25}
          />

          {/* Stable Player Controller */}
          <StablePlayerController
            position={playerPosition}
            onPositionChange={handlePlayerMove}
          />

          {/* Mouse Controls */}
          <PointerLockControls />

          {/* Render Chunks */}
          <group>
            {visibleChunks.map((chunk) => (
              <SimpleChunkComponent
                key={`chunk-${chunk.x}-${chunk.z}`}
                blocks={chunk.blocks}
                chunkKey={`${chunk.x}-${chunk.z}`}
              />
            ))}
          </group>

          {/* Chunk Manager */}
          <StableChunkManager
            playerPosition={playerPosition}
            onChunksChange={handleChunksChange}
          />          {/* HUD Updater */}
          <HUDUpdater
            setHUDData={hudState.setHUDData}
            playerPosition={playerPosition}
            renderDistance={4}
            visibleChunks={visibleChunks.length}
            totalChunks={chunks.size}
          />

          {/* Memory Management */}
          <MemoryManager />
        </Suspense>
      </Canvas>      {/* UI Overlays */}
      <Crosshair />
      <ControlsHint />
      <GameHUD hudData={hudState.hudData} />
      <EnhancedWebGLMonitor setHUDData={hudState.setHUDData} />

      {/* Game Info */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <div>🌍 Stable Minecraft World</div>
        <div>📍 Position: ({playerPosition[0].toFixed(1)}, {playerPosition[1].toFixed(1)}, {playerPosition[2].toFixed(1)})</div>
        <div>📦 Chunks: {chunks.size}</div>
        <div>🧱 Blocks: {visibleChunks.reduce((total, chunk) => total + chunk.blocks.length, 0)}</div>
        <div>🎮 WASD + Mouse + Space to jump</div>
      </div>
    </div>
  );
};

export default StableMinecraftWorld;
