import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import type { HUDData } from './GameHUD';
import { 
  attemptContextRecovery, 
  WebGLMonitor, 
  configureRendererForStability,
  restoreRendererState,
  isLowMemoryEnvironment
} from '../utils/webglUtils';

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
  // Initialize WebGL monitor
  const webglMonitor = useRef<WebGLMonitor | null>(null);
  const memoryPressure = useRef<number>(0);
  const isLowMemory = useRef<boolean>(isLowMemoryEnvironment());
  
  // Setup WebGL monitor on initialization
  useEffect(() => {
    if (!gl) return;
    
    // Create new monitor
    webglMonitor.current = new WebGLMonitor(gl, scene);
    
    // Initial renderer configuration based on device capabilities
    try {
      configureRendererForStability(gl, isLowMemory.current ? 0.5 : 0);
      
      // Display device capability information
      console.log(`Device info: Low memory: ${isLowMemory.current}, WebGL version: ${gl.getContext() instanceof WebGL2RenderingContext ? '2' : '1'}`);
    } catch (err) {
      console.error("Error during initial WebGL configuration:", err);
    }
    
    return () => {
      if (webglMonitor.current) {
        webglMonitor.current.dispose();
        webglMonitor.current = null;
      }
    };
  }, [gl, scene]);
    // Monitor frame rate and update memory pressure
  useFrame((_state, delta) => {
    if (!webglMonitor.current) return;
    
    // Validate delta to prevent invalid FPS calculations
    const validDelta = Math.max(0.001, Math.min(1, delta)); // Clamp between 1ms and 1s
    const fps = 1 / validDelta;
    
    // Only update FPS if it's reasonable (between 1 and 300 FPS)
    if (fps >= 1 && fps <= 300) {
      webglMonitor.current.updateFps(fps);
    }
    
    // Update memory pressure level (0-1 scale) based on FPS
    // Lower FPS = higher memory pressure
    const currentFps = webglMonitor.current.getFps();
    if (currentFps < 20) {
      memoryPressure.current = Math.min(1, memoryPressure.current + 0.1);
    } else if (currentFps > 50) {
      memoryPressure.current = Math.max(0, memoryPressure.current - 0.05);
    }
    
    // Apply renderer optimizations based on current memory pressure
    try {
      configureRendererForStability(gl, memoryPressure.current);
    } catch (e) {
      // Silently handle optimization errors
    }
  });
  
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
      
      // Update HUD status immediately
      setHUDData(prev => ({
        ...prev,
        webglContextStatus: 'lost'
      }));
      
      // Notify parent component if callback provided
      if (onContextLost) {
        onContextLost();
      }
      
      // Prevent rapid context loss cycles
      if (contextLostCount.current > 3 && Date.now() - lastContextLoss.current < 10000) {
        console.error('Too many context losses in a short period. Consider using 2D fallback mode.');
        return;
      }
      
      // Attempt to recover renderer by forcing a memory cleanup
      try {
        // Clear THREE.js cache
        THREE.Cache.clear();
        
        // Release resources from scene
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) {
              object.geometry.dispose();
            }
            
            if (object.material) {
              const materials = Array.isArray(object.material) 
                ? object.material 
                : [object.material];
              
              materials.forEach(material => {
                // Dispose only if it's safe
                if ('map' in material && material.map) material.map.dispose();
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
      
      try {
        // Apply restoration procedures
        restoreRendererState(gl, scene);
        
        // Reset memory pressure to give a clean slate
        memoryPressure.current = 0;
        
        // Configure renderer with optimal settings
        configureRendererForStability(gl, 0);
      } catch (error) {
        console.error("Error during context restoration:", error);
      }
      
      // Notify parent that context was restored
      if (onContextRestored) {
        onContextRestored();
      }
      
      // Attempt to recover WebGL context if needed
      const context = gl.getContext();
      if (context && typeof context.isContextLost === 'function' && context.isContextLost()) {
        console.warn("Context still appears lost after restoration event, trying manual recovery...");
        attemptContextRecovery(context).then(success => {
          console.log(`Manual context recovery ${success ? 'successful' : 'failed'}`);
        });
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

/**
 * Advanced component for managing memory and WebGL resources
 */
export const MemoryManager: React.FC = () => {
  const { gl, scene } = useThree();
  
  // State for tracking resources
  const lastCleanupTime = useRef(Date.now());
  const previousMemStats = useRef({
    geometries: 0,
    textures: 0,
    calls: 0,
    triangles: 0
  });
  const cleanupCycleRef = useRef(0);
  const emergencyCycleRef = useRef(false);
  const resourcesGrowing = useRef(false);
  const startupTime = useRef(Date.now());
    // Memory cleanup levels
  const CLEANUP_INTERVAL_NORMAL = 30000;  // 30 seconds
  const CLEANUP_INTERVAL_AGGRESSIVE = 10000;  // 10 seconds
  const CLEANUP_INTERVAL_EMERGENCY = 5000;  // 5 seconds
  const STARTUP_GRACE_PERIOD = 15000; // 15 seconds to let initial loading complete
  const POST_STARTUP_MONITORING = 30000; // 30 seconds of careful monitoring after startup
  useFrame(() => {
    if (!gl || !gl.info || !scene) return;
    
    const now = Date.now();
    const timeSinceCleaup = now - lastCleanupTime.current;
    const timeSinceStartup = now - startupTime.current;
    
    // Skip memory management during startup grace period
    if (timeSinceStartup < STARTUP_GRACE_PERIOD) {
      return;
    }
    
    // Determine appropriate interval based on system state
    let cleanupInterval = CLEANUP_INTERVAL_NORMAL;
    
    // More frequent checks immediately after startup
    if (timeSinceStartup < STARTUP_GRACE_PERIOD + POST_STARTUP_MONITORING) {
      // During post-startup monitoring, clean up more frequently but less aggressively
      cleanupInterval = CLEANUP_INTERVAL_AGGRESSIVE;
    } else if (emergencyCycleRef.current) {
      cleanupInterval = CLEANUP_INTERVAL_EMERGENCY;
    } else if (resourcesGrowing.current) {
      cleanupInterval = CLEANUP_INTERVAL_AGGRESSIVE;
    }
    
    // Don't perform cleanup too frequently
    if (timeSinceCleaup < cleanupInterval) return;
    
    try {
      // Get current memory stats
      const currentStats = {
        geometries: gl.info.memory?.geometries || 0,
        textures: gl.info.memory?.textures || 0,
        calls: gl.info.render?.calls || 0,
        triangles: gl.info.render?.triangles || 0
      };
        // Compare with previous cycle and detect trends
      const prevStats = previousMemStats.current;
      
      // Check if resources are continuously increasing
      const geoGrowth = currentStats.geometries - prevStats.geometries;
      const texGrowth = currentStats.textures - prevStats.textures;
      const callGrowth = currentStats.calls - prevStats.calls;
      
      // Track significant growth for reporting
      if (geoGrowth > 1000) {
        console.warn(`Geometry growth spike: +${geoGrowth} geometries`);
      }
        
      // Update growth trend detector (more aggressive detection)
      const isEarlyPhase = cleanupCycleRef.current <= 3; // Reduced from 5 to 3
      resourcesGrowing.current = !isEarlyPhase && (
        (geoGrowth > 0 && texGrowth > 0) || 
        (geoGrowth > 50) ||  // Much more aggressive - detect smaller growth
        (cleanupCycleRef.current > 2 && (geoGrowth > 50 || texGrowth > 5)) // Lower thresholds
      );
      
      // Log memory usage at increasing frequency based on cycle
      if (cleanupCycleRef.current % (emergencyCycleRef.current ? 1 : 3) === 0) {
        console.log(`WebGL Memory [Cycle ${cleanupCycleRef.current}]: Geo: ${currentStats.geometries}, Tex: ${currentStats.textures}, Calls: ${currentStats.calls}, Tri: ${currentStats.triangles}`);
      }
      
      // Detect continuous resource growth over multiple cycles
      if (resourcesGrowing.current && cleanupCycleRef.current > 3) {
        console.warn(`Resource growth detected - G:${geoGrowth}, T:${texGrowth}, C:${callGrowth}`);
        performCleanup(cleanupCycleRef.current, resourcesGrowing.current);
      }      // Detect sudden spike in resource usage (respond more quickly)
      const hasBaseline = cleanupCycleRef.current > 2; // Start spike detection earlier (was 3)
      
      // Adaptive thresholds based on the current geometry count
      const baseGeoLimit = Math.max(8000, prevStats.geometries); // Lower base threshold (was 10000)
      const baseTexLimit = Math.max(50, prevStats.textures); // Lower texture threshold (was 100)
      
      // Define more aggressive growth rate thresholds that scale down as counts get larger
      const geoGrowthFactor = prevStats.geometries > 40000 ? 1.15 : // More sensitive at high levels
                             prevStats.geometries > 25000 ? 1.25 :
                             prevStats.geometries > 15000 ? 1.4 : 1.6;
      
      const isGeometrySpike = hasBaseline && 
                             (currentStats.geometries > baseGeoLimit * geoGrowthFactor) &&
                             (geoGrowth > 2500); // Require less absolute growth to trigger (was 5000)
                             
      const isTextureSpike = hasBaseline && 
                            currentStats.textures > baseTexLimit * 1.5 && // More sensitive (was 1.8)
                            texGrowth > 10; // Lower threshold (was 20)
                            
      // More aggressive render call threshold
      const isCallSpike = hasBaseline && currentStats.calls > 3500; // Lower threshold (was 5000)
      
      // Check for severe conditions needing immediate attention
      if (isGeometrySpike || isTextureSpike || isCallSpike) {
        console.warn(`Memory spike detected: Geo: ${isGeometrySpike ? 'YES' : 'no'} (${geoGrowth}), Tex: ${isTextureSpike ? 'YES' : 'no'} (${texGrowth}), Calls: ${isCallSpike ? 'YES' : 'no'} (${currentStats.calls})`);
        emergencyCycleRef.current = true;
        performCleanup(cleanupCycleRef.current, true);
      }        // Much more aggressive absolute limits for geometry counts
      const isAbsolutelyTooManyGeometries = currentStats.geometries > 30000; // Reduced from 50000 to 30000
      const isGrowthTooDangerous = prevStats.geometries > 20000 && geoGrowth > 5000; // Lower thresholds (was 30k/10k)
      const isCriticalGeometryLevel = currentStats.geometries > 25000; // New critical threshold
      
      if ((isAbsolutelyTooManyGeometries || isGrowthTooDangerous) && !emergencyCycleRef.current) {
        console.warn(`Critical geometry threshold reached: ${currentStats.geometries} geometries (growth: ${geoGrowth})`);
        emergencyCycleRef.current = true;
        
        // Perform super-aggressive cleanup when we reach critical levels
        performCleanup(cleanupCycleRef.current, true);
        
        // Force a second cleanup pass for critical conditions
        setTimeout(() => {
          if (gl && scene) {
            console.warn("Performing second emergency cleanup pass");
            performCleanup(cleanupCycleRef.current, true);
          }
          
          // Force a third cleanup for extreme situations
          if (isCriticalGeometryLevel) {
            setTimeout(() => {
              if (gl && scene) {
                console.warn("Performing THIRD emergency cleanup pass - critical geometry levels");
                performCleanup(cleanupCycleRef.current, true);
                
                // After extreme cleanup, notify any external systems that can reduce geometry generation
                try {
                  window.dispatchEvent(new CustomEvent('webgl-memory-critical', {
                    detail: { geometries: currentStats.geometries }
                  }));
                } catch (e) {
                  // Ignore errors in event dispatching
                }
              }
            }, 1000);
          }
        }, 500);
      }
      
      // Regular cycle cleanup (less aggressive)
      if (cleanupCycleRef.current % 5 === 0) {
        performCleanup(cleanupCycleRef.current, false);
      }
      
      // Update tracking variables
      previousMemStats.current = currentStats;
      cleanupCycleRef.current++;
      lastCleanupTime.current = now;
      
      // Reset emergency status after 3 cycles if resources not growing
      if (emergencyCycleRef.current && !resourcesGrowing.current && cleanupCycleRef.current % 3 === 0) {
        emergencyCycleRef.current = false;
      }
      
    } catch (error) {
      console.error("Error in memory management cycle:", error);
    }
  });
  /**
   * Perform targeted memory cleanup
   */
  const performCleanup = (cycle: number, aggressive: boolean) => {
    try {
      // Always clear cache
      THREE.Cache.clear();
        // Add adaptive cleanup thresholds based on current memory stats
      const memInfo = gl.info?.memory || {};
      const currentGeometries = memInfo.geometries || 0; 
      
      // Dynamically adjust cleanup distance thresholds based on geometry count
      // The higher the geometry count, the more aggressive we should be
      let distanceThreshold = 100; // Default threshold
      if (currentGeometries > 30000) distanceThreshold = 75;
      if (currentGeometries > 40000) distanceThreshold = 50; 
      if (currentGeometries > 45000) distanceThreshold = 25;
      if (aggressive) distanceThreshold /= 1.5; // 33% more aggressive in emergency mode
      
      // Log cleanup operation
      console.log(`Performing ${aggressive ? 'aggressive' : 'normal'} scene cleanup, cycle ${cycle}, geometries: ${currentGeometries}, distance threshold: ${distanceThreshold}`);
      
      // Only do full scene cleanup if necessary
      if (aggressive || cycle % 5 === 0 || currentGeometries > 30000) {
        let disposedCount = 0;
        let geometriesDisposed = 0;
        let materialsDisposed = 0;
        let texturesDisposed = 0;
        
        // Use safe three-pass cleanup to avoid errors during traversal
        const objectsToDispose: THREE.Mesh[] = [];
        const objectsToRemove: THREE.Mesh[] = [];
        
        // FIRST PASS: Collect objects safely using a recursive helper
        // This avoids modifying the scene during traversal
        const collectObjects = (parent: THREE.Object3D) => {
          if (!parent || !parent.children) return;
          
          // Use a copy of the children array to avoid modification issues during traversal
          const children = [...parent.children];
          
          for (let i = 0; i < children.length; i++) {
            const object = children[i];
            if (!object) continue; // Skip if undefined (shouldn't happen)
              if (object instanceof THREE.Mesh) {
              // Handle invisible, low-priority or distant objects
              const isLowPriority = object.userData.priority === 'low'; 
              const isInvisible = !object.visible;
              const isDistant = object.userData.distance && object.userData.distance > distanceThreshold;
              
              // More aggressive distance thresholds in extreme situations
              const isExtremelyDistant = object.userData.distance && object.userData.distance > distanceThreshold * 0.5;
              
              // Much more aggressive cleanup thresholds
              const shouldDispose = isInvisible || 
                                   isLowPriority || 
                                   (isDistant && (aggressive || currentGeometries > 25000)) || // Lower threshold from 30k to 25k
                                   (isExtremelyDistant && currentGeometries > 20000); // New emergency threshold at 20k
              
              if (shouldDispose) {
                objectsToDispose.push(object);
                
                // Be more aggressive about removing objects completely from scene
                const shouldRemove = (aggressive || currentGeometries > 30000) && // Lower threshold from 40k to 30k
                                   object.parent && 
                                   (isLowPriority || 
                                    isInvisible || 
                                    (isDistant && currentGeometries > 25000) || // Lower threshold from 45k to 25k
                                    (isExtremelyDistant && aggressive));
                
                if (shouldRemove) {
                  objectsToRemove.push(object);
                }
              }
            }
            
            // Recursively process children
            collectObjects(object);
          }
        };
        
        // Start collection from scene root
        try {
          collectObjects(scene);
          console.log(`Found ${objectsToDispose.length} objects to dispose, ${objectsToRemove.length} to remove`);
        } catch (traverseError) {
          console.warn('Error collecting objects:', traverseError);
        }
        
        // SECOND PASS: Dispose resources safely
        objectsToDispose.forEach((object) => {
          try {
            // Dispose geometry
            if (object.geometry) {
              object.geometry.dispose();
              geometriesDisposed++;
            }
            
            // Dispose materials
            if (object.material) {
              const materials = Array.isArray(object.material) 
                ? object.material 
                : [object.material];
              
              materials.forEach((material) => {
                try {
                  // Dispose textures and other properties safely
                  Object.keys(material).forEach((key) => {
                    const value = (material as any)[key];
                    if (value && typeof value === 'object' && 'dispose' in value && typeof value.dispose === 'function') {
                      value.dispose();
                      if (key.includes('map')) texturesDisposed++;
                    }
                  });
                  
                  material.dispose();
                  materialsDisposed++;
                } catch (materialError) {
                  // Continue despite material disposal errors
                }
              });
            }
          } catch (objectError) {
            console.warn('Error disposing object:', objectError);
          }
        });
        
        // THIRD PASS: Remove objects from scene safely
        objectsToRemove.forEach((object) => {
          try {
            if (object.parent) {
              object.parent.remove(object);
              disposedCount++;
            }
          } catch (removeError) {
            console.warn('Error removing object from scene:', removeError);
          }
        });
        
        // Log detailed cleanup report
        console.log(
          `Cleanup results: Removed ${disposedCount} objects, ` +
          `disposed ${geometriesDisposed} geometries, ` +
          `${materialsDisposed} materials, ${texturesDisposed} textures`
        );
      }
    } catch (cleanupError) {
      console.error('Error during cleanup operation:', cleanupError);
    }    
      // Reset renderer info on aggressive cleanup
    if (aggressive) {
      try {
        // Force garbage collection indirectly using multiple approaches
        // This creates temporary memory pressure that encourages browser GC
        console.log("Forcing aggressive GC - current geometries:", gl.info?.memory?.geometries || 0);
        
        // Multiple phase GC trigger for maximum effectiveness
        const forceGarbageCollection = () => {
          const tempArrays = [];
          for (let i = 0; i < 5; i++) {  // More arrays (was 3)
            const arr = new Array(1000000); // Larger arrays (was 500k)
            arr.fill(Math.random());  // More complex fill to pressure memory
            tempArrays.push(arr);
          }
          
          // Create and release complex objects
          for (let i = 0; i < 10; i++) {
            const complexObj = {};
            for (let j = 0; j < 1000; j++) {
              (complexObj as any)[`key_${j}`] = `value_${Math.random()}`;
            }
            tempArrays.push(complexObj);
          }
          
          // Release all references
          tempArrays.length = 0;
        };
        
        // Reset render info immediately
        if (gl.info) {
          gl.info.reset();
        }
        
        // First GC trigger
        forceGarbageCollection();
        
        // Second trigger after a short delay
        setTimeout(() => {
          forceGarbageCollection();
          THREE.Cache.clear();
          
          // Reset WebGLRenderer state to help release GPU resources
          gl.setRenderTarget(null); 
          gl.clear();
          
          // Request animation frame for final cleanup
          requestAnimationFrame(() => {
            if (gl.info) gl.info.reset();
            THREE.Cache.clear();
            
            // Report results
            console.log("GC completed - current geometries:", gl.info?.memory?.geometries || 0);
          });
        }, 100);
      } catch (gcError) {
        console.warn('Error during garbage collection attempt:', gcError);
      }
    }
  };
  
  // Effect to clean up on unmount
  useEffect(() => {
    return () => {
      // Final cleanup
      THREE.Cache.clear();
      
      if (gl.info) {
        gl.info.reset();
      }
    };
  }, [gl]);
  
  return null;
};
