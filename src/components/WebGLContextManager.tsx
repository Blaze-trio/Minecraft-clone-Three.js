import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { HUDData } from './GameHUD';

interface WebGLContextManagerProps {
  setHUDData: React.Dispatch<React.SetStateAction<HUDData>>;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

/**
 * Component to manage WebGL context events and implement recovery strategies
 */
export const WebGLContextManager: React.FC<WebGLContextManagerProps> = ({
  setHUDData,
  onContextLost,
  onContextRestored
}) => {
  const { gl, scene } = useThree();
  const contextLostCount = useRef(0);
  const lastContextLoss = useRef(0);
  const isRecovering = useRef(false);

  useEffect(() => {
    if (!gl || !gl.domElement) return;
    
    const canvas = gl.domElement;
    
    const handleContextLost = (event: Event) => {
      // Prevent default behavior
      event.preventDefault();
      
      // Update statistics
      contextLostCount.current += 1;
      lastContextLoss.current = Date.now();
      
      console.warn(`WebGL context lost (count: ${contextLostCount.current})`);
      
      // Update HUD status
      setHUDData(prev => ({
        ...prev,
        webglContextStatus: 'lost'
      }));
      
      // Notify parent component if callback provided
      if (onContextLost) {
        onContextLost();
      }
      
      // Attempt to recover renderer by forcing a memory cleanup
      try {
        // Clear THREE.js cache
        THREE.Cache.clear();
        
        // Release resources from scene
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry && !object.geometry.isBufferGeometry) {
              object.geometry.dispose();
            }
            
            if (object.material) {
              const materials = Array.isArray(object.material) 
                ? object.material 
                : [object.material];
              
              materials.forEach(material => {
                // Dispose only if it's safe
                if (material.map) material.map.dispose();
                material.dispose();
              });
            }
          }
        });
      } catch (error) {
        console.error("Error during context recovery:", error);
      }
      
      // Mark recovery in progress
      isRecovering.current = true;
      
      // Update HUD with warning
      setHUDData(prev => ({
        ...prev,
        webglContextStatus: 'warning'
      }));
    };
    
    const handleContextRestored = () => {
      console.log("WebGL context restored!");
      
      // Update HUD status
      setHUDData(prev => ({
        ...prev,
        webglContextStatus: 'restored'
      }));
      
      // Reset recovery flag
      isRecovering.current = false;
      
      // Notify parent component if callback provided
      if (onContextRestored) {
        onContextRestored();
      }
      
      // After a delay, update status to stable
      setTimeout(() => {
        setHUDData(prev => ({
          ...prev,
          webglContextStatus: 'stable'
        }));
      }, 3000);
    };
    
    // Add event listeners
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    // Apply optimization settings
    gl.setClearColor(new THREE.Color('#87CEEB'));
    
    console.log("WebGL context manager initialized");
    
    return () => {
      // Remove event listeners on cleanup
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, onContextLost, onContextRestored, setHUDData, scene]);
  
  // Monitor renderer for signs of problems
  useEffect(() => {
    const checkRendererHealth = () => {
      if (!gl || isRecovering.current) return;
      
      try {
        // Check if context is still valid
        const context = gl.getContext();
        if (context && typeof context.isContextLost === 'function' && context.isContextLost()) {
          console.warn("WebGL context appears to be lost but no event was fired");
          setHUDData(prev => ({
            ...prev,
            webglContextStatus: 'warning'
          }));
        }
      } catch (error) {
        console.error("Error checking renderer health:", error);
      }
    };
    
    const intervalId = setInterval(checkRendererHealth, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [gl, setHUDData]);

  return null; // This component doesn't render anything
};

// Memory manager to help prevent WebGL context loss
export const MemoryManager: React.FC = () => {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    // Schedule regular memory cleanups
    const cleanupUnusedResources = () => {
      try {
        // Clean up THREE.js cache
        THREE.Cache.clear();
          // Optionally reduce texture quality if renderer info shows high memory usage
        const memoryInfo = (gl as any).info?.memory;
        if (memoryInfo && (memoryInfo.geometries > 500 || memoryInfo.textures > 100)) {
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              const materials = Array.isArray(object.material) 
                ? object.material 
                : [object.material];
                
              materials.forEach(material => {
                if (material && material.map) {
                  material.map.minFilter = THREE.NearestFilter;
                  material.needsUpdate = true;
                }
              });
            }
          });
        }
      } catch (error) {
        console.error("Error during memory cleanup:", error);
      }
    };
    
    // Run cleanup every 30 seconds
    const intervalId = setInterval(cleanupUnusedResources, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [gl, scene]);
  
  return null;
};
