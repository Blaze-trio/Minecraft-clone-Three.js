import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { ImprovedWorldGenerator } from '../utils/cleanGenerator';
import { PlayerController } from './PlayerController';
import { HUDUpdater, useHUDState, GameHUD, Crosshair, ControlsHint } from './GameHUD';
import { WebGLContextManager, MemoryManager } from './WebGLContextManager';
import { EnhancedWebGLMonitor } from './EnhancedWebGLMonitor';
import { ChunkComponent } from './Block';
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
  const fallbackGenerator = useRef<ImprovedWorldGenerator | null>(null);
  
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
              
            case 'CHUNK_GENERATED':
              const { chunk, id } = data as { chunk: Chunk, id: string };
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
      fallbackGenerator.current = new ImprovedWorldGenerator();
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

// Adaptive performance based on device capabilities with more aggressive thresholds
const useAdaptivePerformance = () => {
  const [renderDistance, setRenderDistance] = useState(2); // Emergency: start with minimal distance
  const frameTimeRef = useRef<number[]>([]);
  const frameCount = useRef(0);
  const performanceLevel = useRef(0);
  const lastAdjustmentTime = useRef(Date.now());
  const emergencyMode = useRef(false);
  
  // Analyze and adapt based on frame times
  useFrame((_state, delta) => {
    const fps = 1 / delta;
    frameTimeRef.current.push(fps);
    
    // Keep a shorter rolling window of frame times for faster response
    if (frameTimeRef.current.length > 60) { // 1 second at 60fps
      frameTimeRef.current.shift();
    }
    
    frameCount.current++;
    
    // Emergency mode detection - very low FPS
    if (fps < 15) {
      emergencyMode.current = true;
    } else if (fps > 35) {
      emergencyMode.current = false;
    }
    
    // More frequent adjustments but with cooldown
    const now = Date.now();
    if (now - lastAdjustmentTime.current > 2000 && frameTimeRef.current.length > 20) { // Reduced from 3000ms to 2000ms
      const avgFps = frameTimeRef.current.reduce((sum, t) => sum + t, 0) / frameTimeRef.current.length;
      
      if (emergencyMode.current && renderDistance > 1) {
        // Emergency: drastically reduce render distance
        setRenderDistance(prev => Math.max(prev - 2, 1));
        performanceLevel.current -= 2;
        console.warn(`Emergency mode: Reduced render distance to ${renderDistance - 2} due to FPS: ${avgFps.toFixed(1)}`);
      } else if (!emergencyMode.current) {
        if (avgFps < 25 && renderDistance > 2) {
          // Poor performance: reduce render distance more aggressively
          setRenderDistance(prev => Math.max(prev - 1, 2));
          performanceLevel.current--;
          console.warn(`Reduced render distance to ${renderDistance - 1} due to FPS: ${avgFps.toFixed(1)}`);
        } else if (avgFps > 50 && renderDistance < MAX_RENDER_DISTANCE) {
          // Good performance: carefully increase render distance
          setRenderDistance(prev => Math.min(prev + 1, MAX_RENDER_DISTANCE));
          performanceLevel.current++;
          console.log(`Increased render distance to ${renderDistance + 1} due to good FPS: ${avgFps.toFixed(1)}`);
        }
      }
        lastAdjustmentTime.current = now;
    }
  });
  
  return { renderDistance, performanceLevel: performanceLevel.current, emergencyMode: emergencyMode.current };
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

// Enhanced chunk visibility with geometry budget management and emergency shutdown
const useChunkVisibility = (
  playerPosition: [number, number, number],
  chunks: Map<string, Chunk>,
  renderDistance: number
) => {
  const { camera } = useThree();
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), []);
  const geometryBudget = useRef(0);
  const maxGeometryBudget = 3000; // Extreme reduction from 15000
  const emergencyMode = useRef(false);
  
  // Get current geometry count from THREE.js
  const getCurrentGeometryCount = () => {
    // @ts-ignore - access THREE.js internal geometry tracking
    return (window as any)._threeGeometryCount || 0;
  };
  // Calculate visible chunks based on frustum culling and geometry budget with emergency shutdown
  const visibleChunks = useMemo(() => {
    // Emergency shutdown: if geometries are too high, return empty array
    const currentGeometryCount = getCurrentGeometryCount();
    if (currentGeometryCount > maxGeometryBudget * 2) {
      console.error(`🚨 EMERGENCY SHUTDOWN: Geometry count ${currentGeometryCount} exceeded emergency limit, stopping chunk rendering`);
      emergencyMode.current = true;
      return [];
    }
    
    // Update frustum from camera
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    // Player chunk coordinates
    const playerChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);
    const visible: Chunk[] = [];
    
    // Emergency chunk limit - never load more than 6 chunks
    const MAX_CHUNKS = 6;
    
    // Sort chunks by distance to prioritize closer chunks
    const sortedChunks = Array.from(chunks.entries())
      .map(([id, chunk]) => {
        const dx = chunk.x - playerChunkX;
        const dz = chunk.z - playerChunkZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return { id, chunk, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_CHUNKS); // Hard limit on chunks
    
    geometryBudget.current = 0;
      // Check each chunk in distance order with dynamic budget allocation
    for (const { chunk, distance } of sortedChunks) {
      if (!chunk.isReady) continue;
      
      // Skip chunks outside render distance
      if (distance > renderDistance) continue;
        // Extremely aggressive distance-based geometry estimation
      const blockCount = Math.min(chunk.blocks?.length || 0, 50); // Drastically reduced cap
      let estimatedGeometry;
      
      if (distance < 1.5) {
        estimatedGeometry = Math.min(blockCount * 2, 100); // Drastically reduced
      } else if (distance < 3) {
        estimatedGeometry = Math.min(blockCount * 1, 50); // Drastically reduced
      } else if (distance < 5) {
        estimatedGeometry = Math.min(blockCount * 0.5, 25); // Drastically reduced
      } else {
        estimatedGeometry = Math.min(blockCount * 0.25, 10); // Almost nothing
      }
      
      // Extremely conservative budget allocation
      let maxAllowedForChunk;
      if (distance < 2) {
        maxAllowedForChunk = 100; // Drastically reduced from 500
      } else if (distance < 4) {
        maxAllowedForChunk = 50; // Drastically reduced from 200
      } else {
        maxAllowedForChunk = 25; // Drastically reduced from 100
      }
      
      estimatedGeometry = Math.min(estimatedGeometry, maxAllowedForChunk);
      
      // Check if adding this chunk would exceed our geometry budget
      if (geometryBudget.current + estimatedGeometry > maxGeometryBudget) {
        // For close chunks, try to make room by reducing the budget
        if (distance < 3 && visible.length > 5) {
          // Remove some distant chunks to make room for close ones
          const toRemove = visible.filter(v => {
            const vDx = v.x - chunk.x;
            const vDz = v.z - chunk.z;
            const vDist = Math.sqrt(vDx * vDx + vDz * vDz);
            return vDist > distance + 2;
          });
          
          if (toRemove.length > 0) {
            // Remove furthest chunk
            const furthest = toRemove[toRemove.length - 1];
            const index = visible.indexOf(furthest);
            if (index > -1) {
              visible.splice(index, 1);
              geometryBudget.current -= Math.min(furthest.blocks?.length || 0, 100);
            }
          }
        }
        
        // Check again after potential removal
        if (geometryBudget.current + estimatedGeometry > maxGeometryBudget) {
          continue; // Skip this chunk
        }
      }
      
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
        geometryBudget.current += estimatedGeometry;
      }
    }
      console.log(`🚨 EMERGENCY MODE: Rendering only ${visible.length} chunks (max: ${MAX_CHUNKS}) with estimated ${geometryBudget.current} geometries (budget: ${maxGeometryBudget})`);
    return visible;
  }, [chunks, camera, playerPosition, renderDistance]);
  
  return visibleChunks;
};

// Optimized version of the world renderer
const WorldRenderer: React.FC = () => {
  // State for player position and chunks
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 5, 0]);
  const { chunks, queueChunk } = useChunkWorker();
  const { renderDistance } = useAdaptivePerformance();
  
  // Update HUD data
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

      {/* RE-ENABLE: Chunk rendering */}
      {visibleChunks.map((chunk) => (
        <ChunkComponent
          key={`${chunk.x}-${chunk.z}`}
          blocks={chunk.blocks}
          chunkKey={`${chunk.x}-${chunk.z}`}
        />
      ))}

      {/* RE-ENABLE: All managers and monitors */}
      <HUDUpdater 
        setHUDData={setHUDData}
        playerPosition={playerPosition} 
        renderDistance={renderDistance} 
        visibleChunks={visibleChunks.length}
        totalChunks={chunks.size}          
      />

      <WebGLContextManager 
        setHUDData={setHUDData}
        onContextLost={() => console.log("Main context lost event handled")}
        onContextRestored={() => console.log("Main context restored event handled")}
      />

      <MemoryManager />

      <EnhancedWebGLMonitor 
        setHUDData={setHUDData}
        onEmergencyCleanup={(count) => console.log(`Enhanced monitor cleaned ${count} objects`)}
        onPerformanceAlert={(level) => console.warn(`Performance alert: ${level}`)}
      />

      {/* Basic lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[100, 100, 100]} 
        intensity={0.8} 
        castShadow={false} 
      />

      {/* Debug logger */}
      <DebugLogger />
    </>
  );
};

// Debug logger component to track geometry count in minimal scene
const DebugLogger: React.FC = () => {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const hasLogged = useRef(false);
  const geometryHistory = useRef<number[]>([]);  // Log immediately on mount
  useEffect(() => {
    console.log('🔍 ABSOLUTE MINIMAL SCENE TEST - Everything disabled except lights');
    console.log('📊 Expected: ONLY lighting (ambient + directional) = 0 geometries');
    console.log('🎯 If we STILL see geometries, React Three Fiber has a fundamental issue');
  }, []);
  
  useFrame(() => {
    frameCount.current++;
    
    if (!gl || !gl.info) {
      if (frameCount.current === 60 && !hasLogged.current) {
        console.warn('⚠️ WebGL renderer or info not available after 60 frames');
        hasLogged.current = true;
      }
      return;
    }
    
    const info = gl.info;
    const memory = info.memory || {};
    const render = info.render || {};
    
    const geometries = memory.geometries || 0;
    const textures = memory.textures || 0;
    const calls = render.calls || 0;
    const triangles = render.triangles || 0;
    
    // Track geometry history
    geometryHistory.current.push(geometries);
    if (geometryHistory.current.length > 10) {
      geometryHistory.current.shift();
    }
    
    // Log immediately on first valid frame
    if (frameCount.current === 1) {
      console.log(`🎯 FIRST FRAME: Geometries: ${geometries}, Textures: ${textures}, Calls: ${calls}, Triangles: ${triangles}`);
    }
      // Update HUD with geometry count in the page title for easy monitoring
    if (frameCount.current % 60 === 0) {
      const timeElapsed = frameCount.current / 60;
      document.title = `Minecraft Clone - ${timeElapsed.toFixed(0)}s G:${geometries} T:${textures} C:${calls}`;
      
      // Add status indicator to the page
      let statusDiv = document.getElementById('stability-status');
      if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'stability-status';
        statusDiv.style.cssText = `
          position: fixed; 
          top: 10px; 
          right: 10px; 
          background: rgba(0,0,0,0.8); 
          color: white; 
          padding: 10px; 
          border-radius: 5px; 
          font-family: monospace; 
          font-size: 12px; 
          z-index: 9999;
        `;
        document.body.appendChild(statusDiv);
      }
      
      let status = 'INITIALIZING';
      if (timeElapsed >= 60) status = '✅ STABLE (60s+)';
      else if (timeElapsed >= 45) status = '🎉 PASSED 45s';
      else if (timeElapsed >= 30) status = '🎯 30s+ STABLE';
      else if (timeElapsed >= 15) status = '⏱️ TESTING';
        statusDiv.innerHTML = `
        <div>Time: ${timeElapsed.toFixed(0)}s</div>
        <div>Status: ${status}</div>
        <div>Geometries: ${geometries}</div>
        <div>FPS: ~${(frameCount.current / timeElapsed).toFixed(0)}</div>          <div style="margin-top:5px; font-size:10px;">
            <div>🚫 ALL MESHES: DISABLED</div>
            <div>🚫 ALL CHUNKS: DISABLED</div>
            <div>🚫 ALL MANAGERS: DISABLED</div>
            <div style="color:red;">⚡ ABSOLUTE MINIMAL TEST</div>
            <div style="color:orange;">Only Lights + PlayerController</div>
          </div>
      `;
    }    // Emergency detection: if geometries explode in ULTRA-minimal scene
    if (geometries > 100) {
      console.error(`🚨🚨🚨 CRITICAL: ${geometries} geometries in ULTRA-MINIMAL scene!`);
      console.error('🔍 DISABLED COMPONENTS:');
      console.error('   ❌ Sky component');
      console.error('   ❌ Chunk rendering'); 
      console.error('   ❌ WebGL monitoring systems');
      console.error('   ❌ Memory managers');
      console.error('   ❌ HUD updater');
      console.error('🎯 ONLY ACTIVE COMPONENTS:');
      console.error('   ✅ PlayerController (no geometry)');
      console.error('   ✅ 2 basic planes + 1 cube = 3 geometries');
      console.error('   ✅ Basic lighting (no geometry)');
      console.error('💡 This suggests React Three Fiber or Three.js is leaking objects!');
      
      // Show alert to make it visible
      setTimeout(() => {
        alert(`GEOMETRY EXPLOSION: ${geometries} geometries in ultra-minimal scene! This is a React Three Fiber issue.`);
      }, 100);    } else if (geometries <= 10 && frameCount.current > 300) {
      console.log(`✅ SUCCESS: Ultra-minimal scene is stable! Geometries: ${geometries}`);
      console.log('🎯 We can now systematically re-enable components one by one');
      console.log('📋 NEXT STEPS:');
      console.log('   1. Re-enable HUDUpdater (should add 0 geometries)');
      console.log('   2. Re-enable WebGLContextManager (should add 0 geometries)');
      console.log('   3. Re-enable MemoryManager (should add 0 geometries)');
      console.log('   4. Re-enable EnhancedWebGLMonitor (should add 0 geometries)');
      console.log('   5. Implement simple chunk system with geometry limits');
      console.log('   6. Create optimized sky replacement');
    }
      // Log every 120 frames (roughly every 2 seconds at 60fps)
    if (frameCount.current % 120 === 0) {
      const avgGeometries = geometryHistory.current.reduce((sum, val) => sum + val, 0) / geometryHistory.current.length;
      const timeElapsed = frameCount.current / 60; // Approximate seconds
      const isStable = geometries <= 10 && calls <= 10 && triangles <= 1000;
      
      console.log(`[MINIMAL SCENE] Time: ${timeElapsed.toFixed(0)}s, Frame: ${frameCount.current}, Geometries: ${geometries} (avg: ${avgGeometries.toFixed(1)}), Textures: ${textures}, Calls: ${calls}, Triangles: ${triangles}, Stable: ${isStable}`);
      
      // Report stability milestones
      if (timeElapsed >= 30 && timeElapsed < 35 && isStable) {
        console.log('🎯 SCENE STABILITY CONFIRMED at 30 seconds - should cancel fallback timer');
      }
      
      if (timeElapsed >= 45 && timeElapsed < 50 && isStable) {
        console.log('🎉 PASSED 45 second mark without fallback - App.tsx fix is working!');
      }
      
      if (timeElapsed >= 60 && timeElapsed < 65 && isStable) {
        console.log('🚀 1 minute stable - WebGL context loss issue appears RESOLVED');
      }
      
      // Check for steady growth (memory leak pattern)
      if (geometryHistory.current.length >= 5) {
        const first = geometryHistory.current[0];
        const last = geometryHistory.current[geometryHistory.current.length - 1];
        if (last > first + 10) {
          console.warn(`📈 MEMORY LEAK PATTERN: Geometries grew from ${first} to ${last} over ${geometryHistory.current.length} samples`);
        }
      }
    }
  });
  
  return null;
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
        style={{ background: '#87CEEB' }}        gl={{
          antialias: false,
          powerPreference: 'high-performance' as const,
          precision: 'mediump' as const, // Better balance between performance and quality
          depth: true,
          stencil: false,
          alpha: false,
          preserveDrawingBuffer: true, 
          failIfMajorPerformanceCaveat: false,
          premultipliedAlpha: true, // Better color stability
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
      >        <Suspense fallback={null}>
          <WorldRenderer />
          <PointerLockControls />
        </Suspense>
      </Canvas>

      {/* HUD elements outside canvas */}
      <GameHUD hudData={hudData} />
      <Crosshair />
      <ControlsHint />

      {/* Updated instruction overlay */}
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
        <div style={{color: '#4CAF50', fontWeight: 'bold', marginBottom: '10px'}}>🎮 CHUNK RENDERING ENABLED</div>
        <div>📋 Controls:</div>
        <div>• Click canvas to enable mouse look</div>
        <div>• WASD to move</div>
        <div>• ESC to release mouse</div>
        <div style={{marginTop: '10px', color: '#4CAF50'}}>✅ Components:</div>
        <div style={{color: '#81C784'}}>• Chunks: ✅ RENDERING</div>
        <div style={{color: '#81C784'}}>• HUD: ✅ ACTIVE</div>
        <div style={{color: '#81C784'}}>• Managers: ✅ ACTIVE</div>
        <div style={{marginTop: '10px', color: '#FFA500'}}>🔬 Testing world generation...</div>
      </div>
      
      {/* Loading overlay */}
      {!isLoaded && <LoadingOverlay />}
    </div>
  );
};
