// Advanced geometry cleanup system to work around React Three Fiber memory leaks
import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GeometryCleanupSystemProps {
  maxGeometries: number;
  cleanupInterval: number; // frames between cleanup cycles
  aggressiveMode: boolean;
}

export const GeometryCleanupSystem: React.FC<GeometryCleanupSystemProps> = ({
  maxGeometries = 50,
  cleanupInterval = 300, // 5 seconds at 60fps
  aggressiveMode = false
}) => {
  const { gl, scene } = useThree();
  const frameCount = useRef(0);
  const lastCleanup = useRef(0);
  const disposedObjects = useRef(new Set<string>());

  // Aggressive geometry disposal function
  const performCleanup = () => {
    if (!gl?.info?.memory) return 0;

    const currentGeometries = gl.info.memory.geometries || 0;
    
    if (currentGeometries <= maxGeometries && !aggressiveMode) {
      return 0;
    }

    let disposed = 0;
    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];
    const texturesToDispose: THREE.Texture[] = [];

    // Traverse scene and collect disposable objects
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const mesh = object as THREE.Mesh;
        
        // Check if geometry should be disposed
        if (mesh.geometry && mesh.geometry instanceof THREE.BufferGeometry) {
          const geom = mesh.geometry;
          const id = geom.uuid;
          
          // Skip if already disposed
          if (!disposedObjects.current.has(id)) {
            // In aggressive mode, dispose more aggressively
            if (aggressiveMode || currentGeometries > maxGeometries * 2) {
              geometriesToDispose.push(geom);
              disposedObjects.current.add(id);
            }
          }
        }

        // Check materials
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(mat => {
            if (mat && !disposedObjects.current.has(mat.uuid)) {
              if (aggressiveMode || currentGeometries > maxGeometries * 1.5) {
                materialsToDispose.push(mat);
                disposedObjects.current.add(mat.uuid);
                
                // Dispose textures from materials
                ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(prop => {
                  const tex = (mat as any)[prop];
                  if (tex && tex instanceof THREE.Texture && !disposedObjects.current.has(tex.uuid)) {
                    texturesToDispose.push(tex);
                    disposedObjects.current.add(tex.uuid);
                  }
                });
              }
            }
          });
        }
      }
    });

    // Perform disposal with error handling
    geometriesToDispose.forEach(geom => {
      try {
        geom.dispose();
        disposed++;
      } catch (error) {
        console.warn('Error disposing geometry:', error);
      }
    });

    materialsToDispose.forEach(mat => {
      try {
        mat.dispose();
      } catch (error) {
        console.warn('Error disposing material:', error);
      }
    });

    texturesToDispose.forEach(tex => {
      try {
        tex.dispose();
      } catch (error) {
        console.warn('Error disposing texture:', error);
      }
    });

    // Clear disposed object tracking if it gets too large
    if (disposedObjects.current.size > 1000) {
      disposedObjects.current.clear();
    }

    return disposed;
  };

  // Force garbage collection if available
  const forceGarbageCollection = () => {
    try {
      // @ts-ignore - use gc() if available in development
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc();
      }
    } catch (error) {
      // Silently ignore if not available
    }
  };

  useFrame(() => {
    frameCount.current++;
    
    // Perform cleanup at specified intervals
    if (frameCount.current - lastCleanup.current >= cleanupInterval) {
      const disposed = performCleanup();
      
      if (disposed > 0) {
        console.log(`🧹 GeometryCleanupSystem: Disposed ${disposed} objects`);
        
        // Force garbage collection after cleanup
        setTimeout(forceGarbageCollection, 100);
      }
      
      lastCleanup.current = frameCount.current;
    }

    // Emergency cleanup for geometry explosion
    if (gl?.info?.memory) {
      const currentGeometries = gl.info.memory.geometries || 0;
      
      if (currentGeometries > maxGeometries * 3) {
        console.warn(`🚨 Emergency cleanup triggered: ${currentGeometries} geometries`);
        const emergencyDisposed = performCleanup();
        console.log(`🚨 Emergency cleanup disposed: ${emergencyDisposed} objects`);
        
        // Immediate garbage collection
        forceGarbageCollection();
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 GeometryCleanupSystem unmounting, performing final cleanup');
      performCleanup();
      forceGarbageCollection();
    };
  }, []);

  return null;
};

// Simplified version for ultra-minimal scenes
export const MinimalGeometryCleanup: React.FC = () => {
  return (
    <GeometryCleanupSystem
      maxGeometries={10} // Very strict limit
      cleanupInterval={180} // Every 3 seconds
      aggressiveMode={true} // Always aggressive
    />
  );
};

// React Three Fiber context reset utility
export const ContextResetUtility: React.FC<{ 
  resetInterval: number;
  onReset?: () => void;
}> = ({ 
  resetInterval = 1800, // 30 seconds at 60fps
  onReset 
}) => {
  const frameCount = useRef(0);
  const lastReset = useRef(0);

  useFrame(() => {
    frameCount.current++;
    
    // Periodic context reset to prevent leaks
    if (frameCount.current - lastReset.current >= resetInterval) {
      try {
        // Clear Three.js cache
        THREE.Cache.clear();
        
        // Clear any global geometry references
        // @ts-ignore
        if (window._threeGeometryRegistry) {
          // @ts-ignore
          window._threeGeometryRegistry.clear();
        }
        
        console.log('🔄 Context reset performed');
        
        if (onReset) {
          onReset();
        }
        
        lastReset.current = frameCount.current;
      } catch (error) {
        console.warn('Error during context reset:', error);
      }
    }
  });

  return null;
};
