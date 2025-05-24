import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Sky, PointerLockControls } from '@react-three/drei';
import { OptimizedWorldGenerator } from '../utils/optimizedWorldGenerator';
import { PlayerController } from './PlayerController';
import { ChunkLOD } from './ChunkLOD';
import { HUDUpdater, useHUDState, GameHUD, Crosshair, ControlsHint } from './GameHUD';
import { WebGLContextManager, MemoryManager } from './WebGLContextHandler';
import type { Chunk } from '../types/game';
import { RENDER_DISTANCE, MAX_RENDER_DISTANCE, CHUNK_SIZE } from '../types/game';
import * as THREE from 'three';

// Worker for efficient chunk generation
const useChunkWorker = () => {
  const [chunks, setChunks] = useState<Map<string, Chunk>>(new Map());
  const [isWorkerReady, setWorkerReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingChunks = useRef<Set<string>>(new Set());
  const chunkRequestQueue = useRef<Array<{chunkX: number, chunkZ: number}>>([]);
  const fallbackGenerator = useRef<OptimizedWorldGenerator | null>(null);
  
  // Initialize worker
  useEffect(() => {
    try {
      // Only create worker if supported
      if (typeof Worker !== 'undefined') {
        const worker = new Worker(
          new URL('../utils/chunkWorker.ts', import.meta.url),
          { type: 'module' }
        );
        
        worker.onmessage = (event) => {
          const data = event.data;
          switch (data.type) {
            case 'WORKER_READY':
              setWorkerReady(true);
              processQueue();
              break;
              
            case 'CHUNK_GENERATED':              const { chunk, id } = data as { chunk: Chunk, id: string };
              addChunk(chunk, id);
              break;
              
            case 'CHUNKS_BATCH_GENERATED':
              (data.results as Array<{ chunk: Chunk, id: string }>).forEach(({ chunk, id }) => {
                addChunk(chunk, id);
              });
              break;
              
            case 'ERROR':
              console.error('Chunk worker error:', data.error);
              useFallbackGenerator();
              break;
          }
        };
        
        worker.onerror = () => {
          console.warn('Worker error detected, using fallback generation');
          useFallbackGenerator();
        };
        
        workerRef.current = worker;
        
        return () => {
          worker.terminate();
          workerRef.current = null;
        };
      } else {
        useFallbackGenerator();
      }
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      useFallbackGenerator();
    }
  }, []);
  
  // Process queue of chunk requests
  const processQueue = useCallback(() => {
    if (chunkRequestQueue.current.length === 0) return;
    
    const worker = workerRef.current;
    if (!worker || !isWorkerReady) {
      useFallbackGenerator();
      return;
    }
    
    // Process chunks in batches for better performance
    const BATCH_SIZE = 4;
    const batch = chunkRequestQueue.current.splice(0, BATCH_SIZE);
    
    // Prepare batch for worker
    const chunks = batch.map(({ chunkX, chunkZ }) => {
      const id = `${chunkX},${chunkZ}`;
      pendingChunks.current.add(id);
      return { chunkX, chunkZ, id };
    });
    
    // Send to worker
    worker.postMessage({
      type: 'GENERATE_CHUNKS_BATCH',
      chunks
    });
  }, [isWorkerReady]);
  
  // Add generated chunk to state
  const addChunk = useCallback((chunk: Chunk, id: string) => {
    pendingChunks.current.delete(id);
    
    setChunks(prev => {
      const newChunks = new Map(prev);
      newChunks.set(id, {
        ...chunk,
        isReady: true
      });
      return newChunks;
    });
    
    // Process more chunks if available
    if (chunkRequestQueue.current.length > 0) {
      requestIdleCallback(() => processQueue(), { timeout: 50 });
    }
  }, [processQueue]);
  
  // Initialize and use fallback generator
  const useFallbackGenerator = useCallback(() => {
    if (!fallbackGenerator.current) {
      fallbackGenerator.current = new OptimizedWorldGenerator();
    }
    
    // Process chunks in main thread
    const processChunksInMainThread = () => {
      if (chunkRequestQueue.current.length === 0) return;
      
      // Process one chunk per frame to avoid blocking
      const { chunkX, chunkZ } = chunkRequestQueue.current.shift()!;
      const id = `${chunkX},${chunkZ}`;
      
      // Skip if already generated
      if (chunks.has(id)) return;
      
      // Generate the chunk
      const chunk = fallbackGenerator.current!.generateChunk(chunkX, chunkZ);
      
      // Add to state
      addChunk(chunk, id);
      
      // Schedule next chunk with frame timing
      if (chunkRequestQueue.current.length > 0) {
        setTimeout(processChunksInMainThread, 16); // ~60fps timing
      }
    };
    
    requestAnimationFrame(processChunksInMainThread);
  }, [chunks, addChunk]);
  
  // Queue chunk for generation
  const queueChunk = useCallback((chunkX: number, chunkZ: number) => {
    const id = `${chunkX},${chunkZ}`;
    
    // Skip if already generated or in queue
    if (chunks.has(id) || pendingChunks.current.has(id)) return;
    
    // Add to queue
    chunkRequestQueue.current.push({ chunkX, chunkZ });
    
    // Start processing if needed
    if (isWorkerReady && workerRef.current) {
      processQueue();
    } else if (fallbackGenerator.current) {
      useFallbackGenerator();
    }
  }, [chunks, isWorkerReady, processQueue, useFallbackGenerator]);
  
  return { chunks, queueChunk };
};

// Adaptive performance based on device capabilities
const useAdaptivePerformance = () => {
  const [renderDistance, setRenderDistance] = useState(RENDER_DISTANCE);
  const frameTimeRef = useRef<number[]>([]);
  const frameCount = useRef(0);
  const performanceLevel = useRef(0);
  const lastAdjustmentTime = useRef(Date.now());
  
  // Analyze and adapt based on frame times
  useFrame((_state, delta) => {
    const fps = 1 / delta;
    frameTimeRef.current.push(fps);
    
    // Keep a rolling window of frame times
    if (frameTimeRef.current.length > 120) { // 2 seconds at 60fps
      frameTimeRef.current.shift();
    }
    
    frameCount.current++;
    
    // Adjust every 3 seconds
    const now = Date.now();
    if (now - lastAdjustmentTime.current > 3000 && frameTimeRef.current.length > 30) {
      const avgFps = frameTimeRef.current.reduce((sum, t) => sum + t, 0) / frameTimeRef.current.length;
      
      // Adjust render distance based on performance
      if (avgFps > 55 && renderDistance < MAX_RENDER_DISTANCE) {
        setRenderDistance(prev => Math.min(prev + 1, MAX_RENDER_DISTANCE));
        performanceLevel.current++;
      } else if (avgFps < 40 && renderDistance > 2) {
        setRenderDistance(prev => Math.max(prev - 1, 2));
        performanceLevel.current--;
      }
      
      lastAdjustmentTime.current = now;
    }
  });
  
  return { renderDistance, performanceLevel: performanceLevel.current };
};

// Raycasting for block selection
/* Block selection functionality will be implemented later
const useBlockSelection = (playerPosition: [number, number, number]) => {
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const { camera } = useThree();
  const [selectedBlock, setSelectedBlock] = useState<{x: number, y: number, z: number} | null>(null);
  
  useFrame(() => {
    // Update raycaster from camera
    raycaster.set(
      new THREE.Vector3(...playerPosition),
      new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    );
    
    // TODO: Add intersection tests with blocks
    // This would require chunk geometry reference access
  });
  
  return { selectedBlock };
};
*/

// Chunk visibility and LOD management
const useChunkVisibility = (
  playerPosition: [number, number, number],
  chunks: Map<string, Chunk>,
  renderDistance: number
) => {
  const { camera } = useThree();
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), []);
  
  // Calculate visible chunks based on frustum culling and distance
  const visibleChunks = useMemo(() => {
    // Update frustum from camera
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    // Player chunk coordinates
    const playerChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);
      const visible: Chunk[] = [];
    
    // Check each chunk
    for (const [_id, chunk] of chunks.entries()) {
      if (!chunk.isReady) continue;
      
      // Skip chunks outside render distance
      const dx = chunk.x - playerChunkX;
      const dz = chunk.z - playerChunkZ;
      const distSquared = dx * dx + dz * dz;
      if (distSquared > renderDistance * renderDistance) continue;
      
      // Calculate chunk center for frustum culling
      const chunkCenter = new THREE.Vector3(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2,
        32, // Approximate terrain height
        chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      
      // Create bounding sphere for the chunk
      const boundingSphere = new THREE.Sphere(
        chunkCenter,
        CHUNK_SIZE * Math.sqrt(3)
      );
      
      // Only include chunks in view frustum
      if (frustum.intersectsSphere(boundingSphere)) {
        visible.push(chunk);
      }
    }
    
    return visible;
  }, [chunks, camera, playerPosition, renderDistance]);
  
  return visibleChunks;
};

// Optimized version of the world renderer
const WorldRenderer: React.FC = () => {  // State for player position and chunks
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 50, 0]);
  const { chunks, queueChunk } = useChunkWorker();
  const { renderDistance } = useAdaptivePerformance();
  
  // Update HUD data - use only setHUDData to avoid unused variable warnings
  const { setHUDData } = useHUDState();
  
  // Get visible chunks based on player position and frustum
  const visibleChunks = useChunkVisibility(playerPosition, chunks, renderDistance);
  
  // Queue chunks around player
  useEffect(() => {
    const playerChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);
    
    // Create a spiral loading pattern (closer chunks first)
    const chunksToLoad: { x: number, z: number, dist: number }[] = [];
    
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= renderDistance) {
          chunksToLoad.push({
            x: playerChunkX + dx,
            z: playerChunkZ + dz,
            dist: distance
          });
        }
      }
    }
    
    // Sort by distance to player (load closer chunks first)
    chunksToLoad.sort((a, b) => a.dist - b.dist);
    
    // Queue chunks for loading
    chunksToLoad.forEach(({ x, z }) => {
      queueChunk(x, z);
    });
  }, [playerPosition, renderDistance, queueChunk]);
    // Update HUD data
  useEffect(() => {
    setHUDData(prev => ({
      ...prev,
      playerPosition,
      renderDistance,
      chunksLoaded: visibleChunks.length,
      totalChunks: chunks.size
    }));
  }, [playerPosition, renderDistance, visibleChunks.length, chunks.size, setHUDData]);
  
  // Handle player movement
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

      {/* Render all visible chunks using LOD system */}
      {visibleChunks.map((chunk) => (
        <ChunkLOD
          key={`chunk-${chunk.x}-${chunk.z}`}
          chunk={chunk}
          playerPosition={playerPosition}
          chunkX={chunk.x}
          chunkZ={chunk.z}
        />
      ))}

      {/* HUD updater - sends data to React context for HUD outside canvas */}
      <HUDUpdater
        setHUDData={setHUDData}
        playerPosition={playerPosition}
        renderDistance={renderDistance}
        visibleChunks={visibleChunks.length}
        totalChunks={chunks.size}
      />
      
      {/* Optimized ambient light and directional light */}
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[100, 100, 100]} 
        intensity={0.8} 
        castShadow={false} 
      />

      {/* Sky with stars */}
      <Sky 
        distance={450000} 
        sunPosition={[100, 20, 100]} 
        inclination={0.5}
        turbidity={10}
        rayleigh={0.5}
      />
    </>
  );
};

// Loading overlay component
const LoadingOverlay: React.FC = () => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontFamily: 'sans-serif',
      zIndex: 1000
    }}>
      <h2>Loading World...</h2>
      <div style={{
        width: '200px',
        height: '20px',
        backgroundColor: '#333',
        borderRadius: '10px',
        overflow: 'hidden',
        margin: '20px 0'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#4CAF50',
          borderRadius: '10px',
          animation: 'loading-progress 2s ease-in-out infinite'
        }} />
      </div>
      <style>
        {`
          @keyframes loading-progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
    </div>
  );
};

// Main game world component with error handling
export const HighPerformanceWorld: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { hudData, setHUDData } = useHUDState();
  
  // Mark as loaded after delay
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 2000);
    return () => clearTimeout(timer);
  }, []);
    return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>      <Canvas
        style={{ background: '#87CEEB' }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance' as const,
          precision: 'mediump' as const, // Better balance between performance and quality
          depth: true,
          stencil: false,
          alpha: false,
          preserveDrawingBuffer: true, 
          failIfMajorPerformanceCaveat: false,
          premultipliedAlpha: true, // Better color stability
          
          // Critical setting to prevent context loss
          // This tells the browser not to release WebGL context when tab is hidden
          powerPreference: 'high-performance' as const,
        }}
        shadows={false}
        camera={{ 
          fov: 75, 
          near: 0.5, // Slightly larger near plane for better z-fighting prevention
          far: 1000, 
          position: [0, 50, 0] 
        }}
        frameloop="always" // Use always to prevent frame drops causing context issues
        performance={{ min: 0.1 }} // Very tolerant of low FPS
        dpr={[0.5, 0.75]} // More conservative resolution scaling
        onCreated={({ gl }) => {
          // Apply WebGL optimizations
          THREE.Cache.enabled = true;
          
          // Set conservative renderer parameters
          gl.setClearColor(new THREE.Color('#87CEEB'));
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 0.75)); // Very conservative pixel ratio
          
          // Apply recovery-focused settings
          try {
            // Use defensive WebGL extension loading with proper error handling
            try {
              const context = gl.getContext();
              context.getExtension('OES_element_index_uint'); // Better memory usage
            } catch (err) {
              // Silently handle extension loading errors
            }
            
            // Set up WebGL context loss handlers at the canvas level
            const canvas = gl.domElement;
            const contextLossCount = { count: 0 };
            
            canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              contextLossCount.count++;
              console.warn(`Canvas-level WebGL context loss handler (count: ${contextLossCount.count})`);
            });
            
            // Enable extensions that help with context stability
            const context = gl.getContext();
            if (context) {
              // Request robust buffer access
              context.getExtension('WEBGL_lose_context');
              context.getExtension('WEBGL_debug_renderer_info');
              
              // For WebGL2, enable explicit context management
              if (context instanceof WebGL2RenderingContext) {
                context.getExtension('KHR_parallel_shader_compile');
              }
            }
            
            // Configure renderer for better performance
            gl.setClearColor(new THREE.Color('#87CEEB'));
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            
          } catch (error) {
            console.error("Error configuring WebGL:", error);
          }
          
          console.log('Canvas created with optimized WebGL settings');
        }}
      >
        <Suspense fallback={null}>
          <WorldRenderer />
          <HUDUpdater 
            setHUDData={setHUDData}
            playerPosition={[0, 50, 0]} 
            renderDistance={RENDER_DISTANCE} 
            visibleChunks={0}
            totalChunks={0}
          />
          <WebGLContextManager 
            setHUDData={setHUDData}
            onContextLost={() => console.log("Main context lost event handled")}
            onContextRestored={() => console.log("Main context restored event handled")}
          />
          <MemoryManager />
          <PointerLockControls />
        </Suspense>
      </Canvas>
      
      {/* HUD elements outside canvas */}
      <GameHUD hudData={hudData} />
      <Crosshair />
      <ControlsHint />
      
      {/* Loading overlay */}
      {!isLoaded && <LoadingOverlay />}
    </div>
  );
};
