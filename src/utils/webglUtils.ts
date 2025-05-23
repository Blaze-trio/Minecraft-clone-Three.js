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
        }, 1000);
      } else {
        // No extension available, fall back to iframe trick
        console.log('WEBGL_lose_context extension not available, trying iframe reset...');
        
        // Create an invisible iframe to force a GPU context reset
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Remove the iframe after a short delay
        setTimeout(() => {
          document.body.removeChild(iframe);
          
          // Check if context is restored
          setTimeout(() => {
            try {
              gl.getParameter(gl.VERSION);
              console.log('Context possibly restored via iframe trick');
              resolve(true);
            } catch (e) {
              console.error('Context still lost after iframe trick');
              resolve(false);
            }
          }, 500);
        }, 500);
      }
    } catch (e) {
      console.error('Error during context recovery attempt:', e);
      resolve(false);
    }
  });
}

/**
 * Class to monitor WebGL memory usage and performance
 */
export class WebGLMonitor {
  private memoryCheckInterval: number | null = null;
  private lastMemoryUsage = 0;
  private smoothedFps = 60;
  private fpsHistory: number[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  
  constructor(renderer?: THREE.WebGLRenderer) {
    if (renderer) {
      this.renderer = renderer;
      this.startMonitoring();
    }
  }
  
  public setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.startMonitoring();
  }
  
  /**
   * Start monitoring WebGL usage
   */
  public startMonitoring(): void {
    if (!this.renderer) return;
    
    this.memoryCheckInterval = window.setInterval(() => {
      this.checkMemoryUsage();
    }, 5000);
  }
  
  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }
  
  /**
   * Check memory usage from renderer
   */
  private checkMemoryUsage(): void {
    if (!this.renderer) return;
    
    try {
      const info = this.renderer.info;
      const geometries = info.memory.geometries || 0;
      const textures = info.memory.textures || 0;
      
      // Calculate memory usage (very rough estimate)
      const memoryUsage = geometries * 0.5 + textures * 2; // MB
      
      // Check for memory leaks (significant increase)
      if (this.lastMemoryUsage > 0 && memoryUsage > this.lastMemoryUsage * 1.5) {
        console.warn(`Possible WebGL memory leak detected: ${memoryUsage.toFixed(2)}MB (was ${this.lastMemoryUsage.toFixed(2)}MB)`);
      }
      
      this.lastMemoryUsage = memoryUsage;
      
      // Log memory usage
      console.log(`WebGL memory usage: ~${memoryUsage.toFixed(2)}MB, Geometries: ${geometries}, Textures: ${textures}`);
      
    } catch (e) {
      console.error('Error checking WebGL memory usage:', e);
    }
  }
  
  /**
   * Track frame rate
   */
  public updateFps(fps: number): void {
    this.fpsHistory.push(fps);
    
    // Keep history limited
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }
    
    // Calculate smoothed FPS
    this.smoothedFps = this.fpsHistory.reduce((sum, val) => sum + val, 0) / this.fpsHistory.length;
    
    // Check for performance issues
    if (this.smoothedFps < 20) {
      console.warn(`Performance warning: Low FPS (${this.smoothedFps.toFixed(1)})`);
    }
  }
  
  /**
   * Get current smoothed FPS
   */
  public getFps(): number {
    return this.smoothedFps;
  }
  
  /**
   * Clean up
   */
  public dispose(): void {
    this.stopMonitoring();
    this.renderer = null;
  }
}
