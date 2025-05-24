import * as THREE from 'three';

/**
 * Utility functions for WebGL context management and recovery
 */

/**
 * Check if WebGL is supported and working
 */
export function checkWebGLSupport(): boolean {
  try {
    // Try to create a test canvas and context
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || 
               canvas.getContext('webgl') || 
               canvas.getContext('experimental-webgl');
               
    // If we got a context, WebGL is supported
    return !!gl;
  } catch (e) {
    console.error('Error checking WebGL support:', e);
    return false;
  }
}

/**
 * Configure a renderer with optimized settings for stability
 */
export function optimizeRenderer(renderer: THREE.WebGLRenderer): void {
  if (!renderer) return;
  
  try {
    // Set power preference
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    
    // Set properties for better stability
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    
    // Configure info for memory tracking
    renderer.info.autoReset = true;
    
    // Apply memory-saving settings
    renderer.capabilities.precision = 'lowp';
    
    // Disable features that might consume memory
    renderer.physicallyCorrectLights = false;
    
    // Configure WebGL context attributes if available
    const context = renderer.getContext();
    if (context) {
      // Try to get extensions that help with stability
      context.getExtension('WEBGL_lose_context');
      context.getExtension('WEBGL_debug_renderer_info');
    }
  } catch (e) {
    console.error('Error optimizing renderer:', e);
  }
}

/**
 * Clear WebGL memory by disposing resources
 */
export function clearWebGLMemory(scene: THREE.Scene): void {
  if (!scene) return;
  
  try {
    // Traverse scene and dispose geometries and materials
    scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          const materials = Array.isArray(object.material) 
            ? object.material 
            : [object.material];
            
          materials.forEach((material) => {
            // Dispose textures and other disposable properties
            Object.values(material).forEach((value) => {
              if (value && typeof value === 'object' && 'dispose' in value && typeof value.dispose === 'function') {
                value.dispose();
              }
            });
            
            material.dispose();
          });
        }
      }
    });
    
    // Clear THREE.js cache
    THREE.Cache.clear();
  } catch (e) {
    console.error('Error clearing WebGL memory:', e);
  }
}

/**
 * Attempt to recover a lost WebGL context
 */
export function attemptContextRecovery(gl: WebGLRenderingContext | WebGL2RenderingContext): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!gl) {
      resolve(false);
      return;
    }
    
    try {
      // Try known extensions for recovering context
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) {
        console.log('Attempting to restore context using WEBGL_lose_context extension...');
        
        // Force context restoration
        ext.restoreContext();
        
        // Check if context is restored
        setTimeout(() => {
          try {
            // Try a simple operation to see if context is back
            gl.getParameter(gl.VERSION);
            console.log('Context successfully restored!');
            resolve(true);
          } catch (e) {
            console.error('Context still lost after restoration attempt');
            resolve(false);
          }
        }, 1000);      } else {
        // No extension available, fall back to iframe trick
        console.log('WEBGL_lose_context extension not available, trying iframe reset...');
        
        // Create an invisible iframe with WebGL context to force a GPU reset
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.width = '1';
        iframe.height = '1';
        iframe.src = 'about:blank';
        document.body.appendChild(iframe);
        
        // Try to create a WebGL context in the iframe
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const canvas = iframeDoc.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            iframeDoc.body.appendChild(canvas);
            
            // Create a WebGL context in the iframe
            const iframeGL = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (iframeGL) {
              // Force the iframe context to be lost and restored
              const iframeExt = iframeGL.getExtension('WEBGL_lose_context');
              if (iframeExt) {
                iframeExt.loseContext();
                setTimeout(() => iframeExt.restoreContext(), 100);
              }
            }
          }
        } catch (err) {
          console.warn('Error during iframe WebGL reset:', err);
        }
        
        // Remove the iframe after a longer delay
        setTimeout(() => {
          document.body.removeChild(iframe);
          
          // Check if context is restored with multiple attempts
          let attempts = 0;
          const maxAttempts = 5;
          
          const checkContext = () => {
            attempts++;
            try {
              gl.getParameter(gl.VERSION);
              console.log('Context successfully restored via iframe trick');
              resolve(true);
            } catch (e) {
              if (attempts < maxAttempts) {
                console.log(`Context still lost, attempt ${attempts}/${maxAttempts}...`);
                setTimeout(checkContext, 300);
              } else {
                console.error('Context still lost after multiple recovery attempts');
                resolve(false);
              }
            }
          };
          
          setTimeout(checkContext, 300);
        }, 1000);
      }
    } catch (e) {
      console.error('Error during context recovery attempt:', e);
      resolve(false);
    }
  });
}

/**
 * Class to monitor WebGL memory usage and performance with advanced recovery actions
 */
export class WebGLMonitor {
  private memoryCheckInterval: number | null = null;
  private lastMemoryUsage = 0;
  private smoothedFps = 60;
  private fpsHistory: number[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private memoryPeaks: number[] = [];
  private warningThreshold = 1.5;  // 50% increase triggers warning
  private criticalThreshold = 2.5; // 150% increase triggers critical action
  private isRecoveryInProgress = false;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 3;
  private lastRecoveryTime = 0;
  private readonly RECOVERY_COOLDOWN = 30000; // 30 seconds between recovery attempts
  
  constructor(renderer?: THREE.WebGLRenderer, scene?: THREE.Scene) {
    if (renderer) {
      this.renderer = renderer;
      this.scene = scene || null;
      this.startMonitoring();
    }
  }
  
  public setRenderer(renderer: THREE.WebGLRenderer, scene?: THREE.Scene): void {
    this.renderer = renderer;
    if (scene) this.scene = scene;
    this.startMonitoring();
  }
  /**
   * Start monitoring WebGL usage with progressive frequency
   */
  public startMonitoring(): void {
    if (!this.renderer) return;    // More responsive monitoring, especially for high-geometry voxel worlds
    const STABILIZATION_DELAY = 10000; // 10 seconds to let the app initialize (reduced from 15s)
    const INITIAL_CHECK_DELAY = 5000;  // 5 seconds for first check (reduced from 8s)
    const NORMAL_CHECK_INTERVAL = 4000; // Standard 4 second interval (reduced from 5s)
    const AGGRESSIVE_CHECK_INTERVAL = 1500; // Aggressive 1.5 second interval (reduced from 2s)

    // Track startup phase to be more gentle with new applications
    const startupTime = Date.now();

    // Delayed initial start to allow application to fully stabilize
    setTimeout(() => {
      // First do a very gentle check with no warnings or actions
      if (this.renderer) {
        // Make sure the renderer still exists
        this.checkMemoryUsage(true); // true = initial gentle check
      }
      
      // Then start progressive monitoring with sensible intervals
      this.memoryCheckInterval = window.setInterval(() => {
        // Skip if renderer was destroyed
        if (!this.renderer) {
          this.stopMonitoring();
          return;
        }
        
        // Calculate how long the app has been running
        const runningTime = Date.now() - startupTime;
        const isStartupPhase = runningTime < (STABILIZATION_DELAY + 30000); // First 45 seconds
        
        // Be more gentle during startup phase
        this.checkMemoryUsage(isStartupPhase);
        
        // Adapt check frequency based on memory trends and app phase
        if (this.memoryPeaks.length >= 5 && !isStartupPhase) {
          // Calculate trend - are we growing steadily?
          const isGrowing = this.memoryPeaks.slice(-5).every((val, i, arr) => 
            i === 0 || val >= arr[i-1] * 0.95 // Allow small fluctuations (5%)
          );
          
          // If memory usage is steadily growing, check more frequently
          if (isGrowing && this.memoryCheckInterval) {
            this.stopMonitoring();
            this.memoryCheckInterval = window.setInterval(() => {
              if (this.renderer) {
                this.checkMemoryUsage();
              } else {
                this.stopMonitoring();
              }
            }, AGGRESSIVE_CHECK_INTERVAL);
          }
        }
      }, NORMAL_CHECK_INTERVAL);
    }, INITIAL_CHECK_DELAY);
  }
  
  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }    /**
   * Check memory usage from renderer and take actions if needed
   * @param gentleCheck If true, perform a gentle check with higher thresholds and fewer actions
   */
  private checkMemoryUsage(gentleCheck: boolean = false): void {
    if (!this.renderer) return;
    
    try {
      // Use safe access pattern for renderer info
      const info = this.renderer.info || {};
      const memory = info.memory || {};
      const render = info.render || {};
      
      // Safely extract memory metrics
      const geometries = memory.geometries || 0;
      const textures = memory.textures || 0;
      const programs = info.programs?.length || 0;
      const triangles = render.triangles || 0;
      
      // Calculate memory usage with weighted factors (more accurate estimate)
      const memoryUsage = (geometries * 0.8) + (textures * 3) + (programs * 0.5); // Weighted units
      
      // Track memory peaks and calculate growth rate
      let growthRate = 1.0;
      if (memoryUsage > 0) {
        if (this.lastMemoryUsage > 0) {
          growthRate = memoryUsage / this.lastMemoryUsage;
        }
        
        this.memoryPeaks.push(memoryUsage);
        if (this.memoryPeaks.length > 10) {
          this.memoryPeaks.shift();
        }
      }
      
      // For voxel worlds, geometry count is the most critical factor to track
      // Much more aggressive limits for voxel-based Minecraft-type worlds
      const MEDIUM_GEO_LIMIT = 20000;   // Warning level
      const HIGH_GEO_LIMIT = 25000;     // High concern level
      const CRITICAL_GEO_LIMIT = 30000; // Critical level
      
      // Track multi-level severity
      const isGeometryMedium = geometries > MEDIUM_GEO_LIMIT;
      const isGeometryHigh = geometries > HIGH_GEO_LIMIT;
      const isGeometryCritical = geometries > CRITICAL_GEO_LIMIT;
      
      // React based on severity level, but respect gentle check flag
      if (!gentleCheck) {
        // Critical level - requires emergency action
        if (isGeometryCritical) {
          console.error(`CRITICAL geometry limit exceeded: ${geometries} geometries`);
          this.performEmergencyRecovery();
          
          // Notify application of critical memory status via event
          try {
            window.dispatchEvent(new CustomEvent('webgl-geometry-critical', { 
              detail: { count: geometries, limit: CRITICAL_GEO_LIMIT } 
            }));
          } catch (e) {
            // Ignore event dispatch errors
          }
        }
        // High level - requires strong action
        else if (isGeometryHigh) {
          console.warn(`HIGH geometry limit exceeded: ${geometries} geometries`);
          
          // If growing quickly, perform emergency recovery
          if (growthRate > 1.2) {
            console.error(`Rapid geometry growth at high levels: +${((growthRate-1)*100).toFixed(0)}%`);
            this.performEmergencyRecovery();
          } else {
            this.performLightCleanup();
          }
        }
        // Medium level - requires light action
        else if (isGeometryMedium) {
          console.warn(`Approaching geometry limits: ${geometries} geometries`);
          this.performLightCleanup();
        }
        
        // Also check for growth spikes regardless of absolute level
        const absoluteGrowth = memoryUsage - this.lastMemoryUsage;
        if (absoluteGrowth > 5000) {
          console.warn(`Large memory spike detected: +${absoluteGrowth.toFixed(0)} units`);
          this.performLightCleanup();
        }
      }
      
      this.lastMemoryUsage = memoryUsage;
      
      // Log memory usage with more useful information for debugging
      // Include growthRate in the log to help track memory trends
      console.log(
        `WebGL memory: ${memoryUsage.toFixed(0)} units ` +
        `[Geometries: ${geometries}, Textures: ${textures}, ` +
        `Triangles: ${(triangles/1000).toFixed(1)}k], ` +
        `FPS: ${this.smoothedFps.toFixed(1)}` +
        (growthRate !== 1.0 ? `, Growth: ${((growthRate-1)*100).toFixed(1)}%` : '')
      );
      
    } catch (e) {
      console.error('Error checking WebGL memory usage:', e);
    }
  }
  
  /**
   * Perform light cleanup to free some resources
   */
  private performLightCleanup(): void {
    if (!this.renderer) return;
    
    try {
      // Clear texture and shader cache
      THREE.Cache.clear();
      
      // Reduce renderer memory usage
      if (this.renderer.info && this.renderer.info.autoReset === false) {
        this.renderer.info.reset();
      }
      
      // Clear any render target caches
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      
    } catch (e) {
      console.error('Error during light cleanup:', e);
    }
  }
  /**
   * Perform emergency recovery when memory usage is critically high
   */
  private performEmergencyRecovery(): void {
    if (this.isRecoveryInProgress) return;
    
    const now = Date.now();
    if (now - this.lastRecoveryTime < this.RECOVERY_COOLDOWN) {
      console.log('Skipping recovery, still in cooldown period');
      return;
    }
    
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('Maximum recovery attempts reached, WebGL context may be unstable');
      return;
    }
    
    this.isRecoveryInProgress = true;
    this.lastRecoveryTime = now;
    this.recoveryAttempts++;
    
    console.log(`Starting emergency WebGL recovery (attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts})...`);
    
    try {
      // 1. Clear all caches
      THREE.Cache.clear();
      
      // 2. Safely dispose non-essential scene elements if we have access to the scene
      if (this.scene) {
        // Enhanced three-pass strategy for safe cleanup
        
        // COLLECTION PASS: collect objects first
        const objectsToDispose: THREE.Object3D[] = [];
        const objectsToRemove: THREE.Object3D[] = [];
        const criticalMemoryPressure = this.recoveryAttempts > 1;
        
        try {
          // Use a safe copy of children array for traversal when possible
          const collectObjects = (parent: THREE.Object3D) => {
            // Safety guard - this shouldn't happen with proper parent-child relationships
            if (!parent) return;
            
            // Get a safe copy of children to iterate over
            const children = parent.children ? [...parent.children] : [];
            
            for (let i = 0; i < children.length; i++) {
              const object = children[i];
              if (!object) continue; // Skip if undefined (shouldn't happen)
              
              // Check if this is a mesh we might want to dispose
              if (object instanceof THREE.Mesh) {
                // More aggressive strategy when memory pressure is critical
                const isLowPriority = object.userData?.priority === 'low';
                const isInvisible = !object.visible;
                const isDistant = object.userData?.distance && object.userData.distance > (criticalMemoryPressure ? 50 : 100);
                const isNonEssential = isInvisible || isLowPriority || isDistant;
                
                if (isNonEssential) {
                  objectsToDispose.push(object);
                  
                  // More aggressive at removing from scene entirely under heavy pressure
                  if (criticalMemoryPressure || isInvisible || isLowPriority) {
                    objectsToRemove.push(object);
                  }
                }
              }
              
              // Recursively process this object's children
              collectObjects(object);
            }
          };
          
          // Start collection from scene root
          collectObjects(this.scene);
          
          console.log(`Found ${objectsToDispose.length} objects to dispose, ${objectsToRemove.length} to remove`);
        } catch (traverseError) {
          console.error('Safe scene traversal error:', traverseError);
        }
        
        // DISPOSAL PASS: dispose resources separately
        let disposedGeometries = 0;
        let disposedMaterials = 0;
        let disposedTextures = 0;
        
        objectsToDispose.forEach((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          
          try {
            // Dispose geometry
            if (object.geometry) {
              object.geometry.dispose();
              disposedGeometries++;
            }
            
            // Dispose materials
            if (object.material) {
              const materials = Array.isArray(object.material) 
                ? object.material 
                : [object.material];
              
              materials.forEach((material) => {
                try {
                  // Safely dispose textures and other properties
                  Object.keys(material).forEach((key) => {
                    const value = (material as any)[key];
                    if (value && typeof value === 'object' && 'dispose' in value) {
                      if (typeof value.dispose === 'function') {
                        value.dispose();
                        if (key.includes('map')) disposedTextures++;
                      }
                    }
                  });
                  
                  material.dispose();
                  disposedMaterials++;
                } catch (materialError) {
                  // Silently handle disposal errors
                }
              });
            }
          } catch (objectError) {
            console.warn('Error disposing object resources:', objectError);
          }
        });
        
        // REMOVAL PASS: remove from parents separately and safely
        let removedCount = 0;
        
        objectsToRemove.forEach((object) => {
          try {
            if (object.parent) {
              object.parent.remove(object);
              removedCount++;
            }
          } catch (removeError) {
            console.warn('Error removing object from scene:', removeError);
          }
        });
        
        // Provide detailed cleanup report
        console.log(
          `Cleanup complete: Removed ${removedCount} objects, ` +
          `disposed ${disposedGeometries} geometries, ` +
          `${disposedMaterials} materials, ${disposedTextures} textures`
        );
      }
        // 3. Reset renderer state if available
      if (this.renderer) {
        this.renderer.setRenderTarget(null);
        this.renderer.clear();
        if (this.renderer.info) this.renderer.info.reset();
      }
      
      // 4. Force garbage collection (indirectly)
      this.triggerGarbageCollection();
      
      console.log('Emergency WebGL recovery completed');
    } catch (e) {
      console.error('Error during emergency recovery:', e);
    } finally {
      this.isRecoveryInProgress = false;
    }
  }
  
  /**
   * Try to force garbage collection indirectly
   */
  private triggerGarbageCollection(): void {
    try {
      // Create pressure on memory to encourage browser GC
      const tempArrays = [];
      for (let i = 0; i < 10; i++) {
        tempArrays.push(new Array(100000).fill(0));
      }
      // Release references
      tempArrays.length = 0;
    } catch (e) {
      // Ignore allocation errors
    }
  }
  
  /**
   * Track frame rate with safety checks
   */
  public updateFps(fps: number): void {
    // Validate input - protect against bad values that could crash the system
    if (isNaN(fps) || fps <= 0 || fps > 1000) return;
    
    this.fpsHistory.push(fps);
    
    // Keep history limited
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }
    
    // Calculate smoothed FPS with outlier rejection
    const sortedFps = [...this.fpsHistory].sort((a, b) => a - b);
    // Remove top and bottom 10% to eliminate outliers
    const trimStart = Math.floor(sortedFps.length * 0.1);
    const trimEnd = Math.ceil(sortedFps.length * 0.9);
    const trimmedFps = sortedFps.slice(trimStart, trimEnd);
    
    // Calculate average of trimmed values
    if (trimmedFps.length > 0) {
      this.smoothedFps = trimmedFps.reduce((sum, val) => sum + val, 0) / trimmedFps.length;
    }
    
    // Check for severe performance issues and trigger recovery if needed
    if (this.smoothedFps < 15 && !this.isRecoveryInProgress) {
      console.warn(`Severe performance issue detected: FPS = ${this.smoothedFps.toFixed(1)}`);
      this.performLightCleanup();
    }
  }
  
  /**
   * Get current smoothed FPS
   */
  public getFps(): number {
    return this.smoothedFps;
  }
  
  /**
   * Clean up all resources
   */
  public dispose(): void {
    this.stopMonitoring();
    this.renderer = null;
    this.scene = null;
    this.memoryPeaks = [];
    this.fpsHistory = [];
  }
}

/**
 * Configure WebGL rendering mode for stability under memory pressure
 * @param renderer The WebGL renderer to configure
 * @param memoryPressure A number between 0-1 representing current memory pressure (0 = low, 1 = critical)
 */
export function configureRendererForStability(renderer: THREE.WebGLRenderer, memoryPressure: number = 0): void {
  if (!renderer) return;
  
  try {
    // Scale quality based on memory pressure (0-1)
    // Clamp pressure between 0-1
    const pressure = Math.max(0, Math.min(1, memoryPressure));
    
    // Pixel ratio scales down with higher pressure (lowers resolution)
    const desiredPixelRatio = Math.max(0.5, 1.5 - pressure);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, desiredPixelRatio));
    
    // Configure renderer based on pressure
    if (pressure > 0.7) {
      // Critical pressure - most aggressive settings
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      
      // Lower precision if supported by the device
      if (renderer.capabilities.precision !== 'lowp') {
        renderer.capabilities.precision = 'lowp';
      }
        // Reduce memory usage
      renderer.info.autoReset = true;
      
      // Force memory cleanup
      // Note: Modern THREE.js doesn't expose these methods directly
      // We'll use renderer.properties clearing instead
      renderer.dispose();
    } 
    else if (pressure > 0.4) {
      // Medium pressure
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      
      if (renderer.capabilities.precision !== 'mediump') {
        renderer.capabilities.precision = 'mediump';
      }
      
      // Clean info but less aggressively
      if (renderer.info.render.calls > 1000) {
        renderer.info.reset();
      }
    }
    else {
      // Low or no pressure - normal settings
      // No special optimizations needed
    }
    
    // Make sure WebGL extensions for stability are loaded
    const context = renderer.getContext();
    if (context) {
      // Try to enable extensions that help with stability
      context.getExtension('WEBGL_lose_context');
      context.getExtension('OES_element_index_uint');
      
      // If WebGL2, enable advanced features that improve stability
      if (context instanceof WebGL2RenderingContext) {
        context.getExtension('KHR_parallel_shader_compile');
        context.getExtension('EXT_disjoint_timer_query_webgl2');
      }
    }
  } catch (e) {
    console.error('Error configuring renderer for stability:', e);
  }
}

/**
 * Detect if we're running in a low-memory environment
 */
export function isLowMemoryEnvironment(): boolean {
  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check for available memory if supported
  let isLowMemory = false;
  
  // Use navigator.deviceMemory if available (Chrome)
  if ('deviceMemory' in navigator) {
    isLowMemory = (navigator as any).deviceMemory < 4; // Less than 4GB
  }
  
  // Check hardware concurrency (CPU cores)
  if ('hardwareConcurrency' in navigator) {
    isLowMemory = isLowMemory || navigator.hardwareConcurrency <= 4; // 4 or fewer cores
  }
  
  // Mobile devices are generally considered low memory
  return isLowMemory || isMobile;
}

/**
 * Fix WebGL context loss by restoring all critical renderer settings
 */
export function restoreRendererState(renderer: THREE.WebGLRenderer, scene?: THREE.Scene): void {
  if (!renderer) return;
  
  try {
    // Reset internal state
    renderer.setRenderTarget(null);
    renderer.setClearColor(new THREE.Color('#87CEEB'));
    renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, false);
    renderer.clear();
    
    // Reset info counters
    if (renderer.info) {
      renderer.info.reset();
      renderer.info.autoReset = true;
    }
    
    // Regenerate material programs if needed
    if (scene) {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material) {
          const materials = Array.isArray(object.material) 
            ? object.material 
            : [object.material];
          
          materials.forEach((material) => {
            // Force shader recompilation
            material.needsUpdate = true;
          });
        }
      });
    }
    
    console.log('WebGL renderer state restored');
  } catch (e) {
    console.error('Error restoring renderer state:', e);
  }
}

/**
 * Detects and fixes memory leaks in a Three.js scene
 * @param scene The Three.js scene to check
 * @param renderer The WebGL renderer
 */
export function detectAndFixMemoryLeaks(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  if (!scene || !renderer) return;
  
  try {
    // Get current memory stats
    const memoryStats = {
      geometries: renderer.info.memory.geometries || 0,
      textures: renderer.info.memory.textures || 0,
      totalObjects: 0,
      disconnectedObjects: 0,
      unboundGeometries: 0,
      unusedMaterials: new Set<THREE.Material>()
    };
    
    // Create material tracking set
    const usedMaterials = new Set<THREE.Material>();
    const allMaterials = new Set<THREE.Material>();
    
    // Check for unconnected objects and unbind unused resources
    scene.traverse((object) => {
      memoryStats.totalObjects++;
      
      // Check if object is disconnected (has no parent but is not the scene)
      if (object !== scene && !object.parent) {
        console.warn('Found disconnected object in scene:', object.type);
        memoryStats.disconnectedObjects++;
      }
      
      // Track materials and geometries
      if (object instanceof THREE.Mesh) {
        // Track materials
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(mat => {
          if (mat) {
            usedMaterials.add(mat);
            allMaterials.add(mat);
          }
        });
        
        // Check for unbonund geometries
        if (!object.geometry) {
          console.warn('Found mesh with no geometry:', object);
        } else if (!object.visible) {
          // Object not visible, consider unbinding geometry
          memoryStats.unboundGeometries++;
          if (!object.geometry.boundingBox && !object.geometry.boundingSphere) {
            // Unbind unused computational resources
            object.geometry.computeBoundingBox = () => {};
            object.geometry.computeBoundingSphere = () => {};
          }
        }
      }
    });
    
    // Find unused materials
    allMaterials.forEach(material => {
      if (!usedMaterials.has(material)) {
        memoryStats.unusedMaterials.add(material);
      }
    });
    
    // Report findings
    const unusedMaterialCount = memoryStats.unusedMaterials.size;
    if (memoryStats.disconnectedObjects > 0 || memoryStats.unboundGeometries > 0 || unusedMaterialCount > 0) {
      console.warn(`Memory leak detection: Found ${memoryStats.disconnectedObjects} disconnected objects, ${memoryStats.unboundGeometries} unbounded geometries, ${unusedMaterialCount} unused materials`);
      
      // Clean up unused materials
      memoryStats.unusedMaterials.forEach(material => {
        material.dispose();
      });
      
      // Force garbage collection indirectly
      setTimeout(() => {
        renderer.info.reset();
      }, 100);
    }
    
  } catch (error) {
    console.error('Error during memory leak detection:', error);
  }
}

/**
 * Sets up emergency handlers for out-of-memory errors
 */
export function setupEmergencyMemoryHandlers(): void {
  // Listen for unhandled errors that might indicate memory issues
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    
    // Check for common out-of-memory error messages
    const isMemoryError = 
      errorMessage.includes('out of memory') || 
      errorMessage.includes('memory limit') || 
      errorMessage.includes('allocation failed') ||
      errorMessage.includes('WEBGL_memory');
      
    if (isMemoryError) {
      console.error('Emergency: WebGL memory error detected:', errorMessage);
      
      // Try emergency cleanup
      THREE.Cache.clear();
      
      // Force garbage collection indirectly
      const largeArrays = [];
      try {
        for (let i = 0; i < 3; i++) {
          const arr = new Array(1000000);
          arr.fill(0);
          largeArrays.push(arr);
        }
      } catch (e) {
        // Ignore allocation errors
      }
      
      // Clear references
      largeArrays.length = 0;
      
      // Notify user
      console.log('Emergency memory cleanup performed');
    }
  });
}
