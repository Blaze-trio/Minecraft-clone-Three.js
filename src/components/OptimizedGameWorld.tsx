import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Sky, PointerLockControls, Stats } from '@react-three/drei';
import { OptimizedWorldGenerator } from '../utils/optimizedWorldGenerator';
import { OptimizedChunk } from './OptimizedBlock';
import { PlayerController } from './PlayerController';
import type { Chunk } from '../types/game';
import { RENDER_DISTANCE, MAX_RENDER_DISTANCE, CHUNK_SIZE } from '../types/game';
import * as THREE from 'three';

// Worker for world generation
const useBackgroundWorldGenerator = () => {
  const [generator] = useState(() => new OptimizedWorldGenerator());
  const [workerChunks, setWorkerChunks] = useState<Map<string, Chunk>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const pendingChunks = useRef<Set<string>>(new Set());
  const generationQueue = useRef<Array<{chunkX: number, chunkZ: number}>>([]);
  const chunkBatchSize = 4; // Process chunks in batches for efficiency
  
  // Create web worker on component mount
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('../utils/chunkWorker.ts', import.meta.url), 
        { type: 'module' }
      );
      
      worker.onmessage = (event) => {
        const data = event.data;
        
        switch (data.type) {
          case 'WORKER_READY':
            console.log('Chunk generator worker ready');
            processQueue();
            break;
            
          case 'CHUNK_GENERATED':
            const { chunk, id } = data;
            addChunk(chunk, id);
            break;
            
          case 'CHUNKS_BATCH_GENERATED':
            data.results.forEach(({ chunk, id }: { chunk: Chunk, id: string }) => {
              addChunk(chunk, id);
            });
            break;
            
          case 'ERROR':
            console.error('Chunk worker error:', data.error);
            // Fallback to main thread generation in case of error
            processPendingChunksInMainThread();
            break;
        }
      };
      
      worker.onerror = (error) => {
        console.error('Error in chunk worker:', error);
        // Fallback to main thread generation
        processPendingChunksInMainThread();
      };
      
      workerRef.current = worker;
      
      return () => {
        worker.terminate();
      };
    } catch (error) {
      console.error('Failed to create worker:', error);
      // Use main thread as fallback
      processPendingChunksInMainThread();
    }
  }, []);
  
  // Add chunk to state
  const addChunk = useCallback((chunk: Chunk, id: string) => {
    pendingChunks.current.delete(id);
    
    setWorkerChunks(prev => {
      const newMap = new Map(prev);
      newMap.set(id, chunk);
      return newMap;
    });
    
    // Process more chunks if available
    requestIdleCallback(() => processQueue(), { timeout: 16 });
  }, []);
  
  // Process chunks in main thread (fallback)
  const processPendingChunksInMainThread = useCallback(() => {
    // Copy the pending chunks to process
    const chunks = Array.from(pendingChunks.current);
    
    // Process one chunk per frame to avoid blocking the main thread
    if (chunks.length > 0) {
      const chunkId = chunks[0];
      pendingChunks.current.delete(chunkId);
      
      // Parse the chunk coordinates from ID
      const [x, z] = chunkId.split(',').map(Number);
      
      // Generate the chunk
      const chunk = generator.generateChunk(x, z);
      
      // Add to state
      setWorkerChunks(prev => {
        const newMap = new Map(prev);
        newMap.set(chunkId, chunk);
        return newMap;
      });
      
      // Schedule next chunk
      if (pendingChunks.current.size > 0) {
        requestIdleCallback(() => processPendingChunksInMainThread(), { timeout: 50 });
      }
    }
  }, [generator]);
  
  // Process chunks from queue
  const processQueue = useCallback(() => {
    if (generationQueue.current.length === 0) return;
    
    // Process chunks in batches for better performance
    const batchSize = Math.min(chunkBatchSize, generationQueue.current.length);
    const batch = generationQueue.current.splice(0, batchSize);
    
    if (workerRef.current) {
      // Prepare batch for worker
      const chunks = batch.map(({ chunkX, chunkZ }) => {
        const id = generator.getChunkKey(chunkX, chunkZ);
        pendingChunks.current.add(id);
        return { chunkX, chunkZ, id };
      });
      
      // Send to worker
      workerRef.current.postMessage({
        type: 'GENERATE_CHUNKS_BATCH',
        chunks
      });
    } else {
      // Fallback to main thread
      batch.forEach(({ chunkX, chunkZ }) => {
        const chunk = generator.generateChunk(chunkX, chunkZ);
        const key = generator.getChunkKey(chunkX, chunkZ);
        
        setWorkerChunks(prev => {
          const newMap = new Map(prev);
          newMap.set(key, chunk);
          return newMap;
        });
      });
      
      // Process more if queue not empty
      if (generationQueue.current.length > 0) {
        requestIdleCallback(() => processQueue(), { timeout: 50 });
      }
    }
  }, [generator]);
  
  // Function to add chunks to generation queue
  const queueChunkGeneration = useCallback((chunkX: number, chunkZ: number) => {
    // Check if chunk is already generated or in queue
    const key = generator.getChunkKey(chunkX, chunkZ);
    if (workerChunks.has(key) || pendingChunks.current.has(key)) return;
    
    // Add to queue
    generationQueue.current.push({chunkX, chunkZ});
    
    // Process queue
    processQueue();
  }, [generator, workerChunks, processQueue]);
  
  return { workerChunks, queueChunkGeneration };
};

// Adaptive render distance based on performance
const useAdaptiveRenderDistance = () => {
  const [renderDistance, setRenderDistance] = useState(RENDER_DISTANCE);
  const fpsHistory = useRef<number[]>([]);
  const frameTime = useRef(0);
  
  useFrame((_state, delta) => {
    frameTime.current = delta;
    
    // Track FPS over time
    const fps = 1 / delta;
    fpsHistory.current.push(fps);
    if (fpsHistory.current.length > 60) { // Track last 60 frames
      fpsHistory.current.shift();
    }
    
    // Only adjust every 60 frames (about 1 second at 60fps)
    if (fpsHistory.current.length === 60) {
      const avgFps = fpsHistory.current.reduce((sum, val) => sum + val, 0) / fpsHistory.current.length;
      
      // Adjust render distance based on FPS
      if (avgFps > 55 && renderDistance < MAX_RENDER_DISTANCE) {
        setRenderDistance(prev => Math.min(prev + 1, MAX_RENDER_DISTANCE));
      } else if (avgFps < 30 && renderDistance > 2) {
        setRenderDistance(prev => Math.max(prev - 1, 2));
      }
    }
  });
  
  return { renderDistance, frameTime };
};

// Optimized world renderer component
const WorldRenderer: React.FC = () => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 50, 0]);
  const [playerChunk, setPlayerChunk] = useState<{ x: number, z: number }>({ x: 0, z: 0 });
  const { workerChunks, queueChunkGeneration } = useBackgroundWorldGenerator();
  const { renderDistance, frameTime } = useAdaptiveRenderDistance();
  const frustumRef = useRef(new THREE.Frustum());
  const { camera } = useThree();
  const [fps, setFps] = useState(0);
  
  // Update FPS counter
  useFrame(() => {
    const currentFps = 1 / (frameTime.current || 0.016);
    setFps(Math.round(currentFps));
  });
  
  // Calculate player chunk
  useEffect(() => {
    const chunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const chunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);
    
    if (chunkX !== playerChunk.x || chunkZ !== playerChunk.z) {
      setPlayerChunk({ x: chunkX, z: chunkZ });
    }
  }, [playerPosition, playerChunk]);
  
  // Queue chunk generation in a spiral pattern from player
  useEffect(() => {
    // Queue chunks in spiral pattern (closer chunks first)
    const spiralOrder: { x: number, z: number, dist: number }[] = [];
    
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        const chunkX = playerChunk.x + dx;
        const chunkZ = playerChunk.z + dz;
        // Calculate Manhattan distance for priority
        const dist = Math.abs(dx) + Math.abs(dz);
        if (dist <= renderDistance) {
          spiralOrder.push({ x: chunkX, z: chunkZ, dist });
        }
      }
    }
    
    // Sort by distance
    spiralOrder.sort((a, b) => a.dist - b.dist);
    
    // Queue chunks in sorted order
    spiralOrder.forEach(({ x, z }) => queueChunkGeneration(x, z));
  }, [playerChunk, renderDistance, queueChunkGeneration]);

  // Calculate visible chunks based on camera frustum
  const visibleChunks = useMemo(() => {
    // Update frustum
    camera.updateMatrix();
    camera.updateMatrixWorld();
    const frustum = frustumRef.current;
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    return Array.from(workerChunks.entries())
      .filter(([_key, chunk]) => {
        if (!chunk || !chunk.isReady) return false;
        
        // Calculate chunk center position
        const centerX = chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2;
        const centerZ = chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2;
        const centerY = 32; // Approximate terrain height
        
        // Create a bounding sphere for the chunk
        const boundingSphere = new THREE.Sphere(
          new THREE.Vector3(centerX, centerY, centerZ),
          Math.sqrt(CHUNK_SIZE * CHUNK_SIZE * 3)
        );
        
        // Check if bounding sphere is in frustum
        return frustum.intersectsSphere(boundingSphere);
      })
      .map(([_key, chunk]) => chunk);
  }, [workerChunks, camera, playerPosition]);

  const handlePlayerMove = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position);
  }, []);

  return (
    <>
      {/* Player Controller */}
      <PlayerController
        position={playerPosition}
        onPositionChange={handlePlayerMove}
      />

      {/* World chunks with optimization */}
      {visibleChunks.map((chunk) => (
        <OptimizedChunk
          key={`chunk-${chunk.x}-${chunk.z}`}
          chunk={chunk}
          chunkX={chunk.x}
          chunkZ={chunk.z}
        />
      ))}

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 1000
      }}>
        <div>FPS: {fps}</div>
        <div>Position: {playerPosition.map(p => p.toFixed(1)).join(', ')}</div>
        <div>Render Distance: {renderDistance}</div>
        <div>Chunks loaded: {visibleChunks.length} / {workerChunks.size}</div>
      </div>

      {/* Performance stats */}
      <Stats />
    </>
  );
};

export const OptimizedGameWorld: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        gl={{ 
          antialias: false,  // Disable antialiasing for better performance
          powerPreference: 'high-performance',
          precision: 'lowp', // Lower precision for better performance
          depth: true,
          stencil: false
        }}
        shadows={false} // Disable shadows for performance
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 50, 0] }}
        performance={{ min: 0.5 }} // Allow frame rate to drop to 30fps
      >
        {/* Lighting (simplified) */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[100, 100, 50]}
          intensity={0.8}
          castShadow={false}
        />

        {/* Sky */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* World renderer */}
        <WorldRenderer />

        {/* Camera controls */}
        <PointerLockControls />
      </Canvas>
    </div>
  );
};
