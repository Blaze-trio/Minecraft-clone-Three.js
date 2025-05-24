/**
 * WebGL configuration and optimization settings
 */

// Default WebGL renderer settings for optimal performance and stability
export const WEBGL_RENDERER_CONFIG = {
  antialias: false,           // Disable antialiasing for better performance
  powerPreference: 'high-performance', // Request high performance GPU
  precision: 'mediump',       // Medium precision for balance between quality and performance
  depth: true,                // Keep depth buffer for proper rendering
  stencil: false,             // Disable stencil buffer if not needed
  alpha: false,               // Disable alpha for better performance
  preserveDrawingBuffer: true, // Important for context recovery
  premultipliedAlpha: true,   // Better color stability
  failIfMajorPerformanceCaveat: false, // Don't fail on low-end devices
  context: { // Advanced context attributes
    desynchronized: false,    // Keep synchronized to prevent context loss
    powerPreference: 'high-performance', // Redundant but important for some browsers
    preserveDrawingBuffer: true // Redundant but important for context recovery
  }
};

// Memory usage limits for voxel-based games
export const VOXEL_MEMORY_CONFIG = {
  // Maximum resource counts before action is needed - EMERGENCY THRESHOLDS
  MAX_GEOMETRY_COUNT: 3000,   // Emergency reduction to match HighPerformanceWorld budget
  MAX_TEXTURE_COUNT: 200,     // Drastically reduced texture limit
  MAX_RENDER_CALLS: 1000,     // Emergency draw call limit
  DANGER_GEOMETRY_COUNT: 2500, // Danger zone at 2.5k geometries
  WARNING_GEOMETRY_COUNT: 2000, // Warning at 2k geometries
  CRITICAL_GEOMETRY_COUNT: 1500, // Critical threshold for emergency actions  
  
  // Memory spike detection thresholds (percentage increase)
  MEMORY_SPIKE_THRESHOLD: 10, // Even more sensitive spike detection
  
  // Chunk management to prevent excessive geometry - EMERGENCY LIMITS
  MAX_CHUNKS_LOW_END: 3,      // Emergency reduction for low-end devices
  MAX_CHUNKS_MID_RANGE: 4,    // Emergency reduction for mid-range devices  
  MAX_CHUNKS_HIGH_END: 6,     // Emergency reduction for high-end devices
  
  // Dynamic LOD settings to reduce geometry count - EMERGENCY AGGRESSIVE
  ENABLE_LOD: true,
  LOD_DISTANCE_NEAR: 10,      // Emergency reduction (was 18)
  LOD_DISTANCE_MID: 20,       // Emergency reduction (was 35) 
  LOD_DISTANCE_FAR: 35,       // Emergency reduction (was 70)
  
  // Maximum geometry per chunk to prevent excessive detail - EMERGENCY LIMITS
  MAX_GEOMETRY_PER_CHUNK: 100, // Emergency reduction from 800
  SIMPLIFY_THRESHOLD: 50,      // Emergency threshold for block merging
    // Memory cleanup intervals (milliseconds) - FASTER RESPONSE
  CLEANUP_INTERVAL_NORMAL: 15000,    // 15 seconds in normal operation (was 30)
  CLEANUP_INTERVAL_WARNING: 5000,   // 5 seconds when memory pressure detected (was 10)
  CLEANUP_INTERVAL_CRITICAL: 2000,   // 2 seconds in critical situations (was 5)
  
  // Object distance thresholds for cleanup - MORE AGGRESSIVE
  CLEANUP_DISTANCE_NORMAL: 80,      // Reduced normal cleanup distance (was 100)
  CLEANUP_DISTANCE_WARNING: 60,      // Reduced warning level distance (was 75)
  CLEANUP_DISTANCE_CRITICAL: 30      // Reduced critical level distance (was 40)
};

// Adapt render settings based on device capabilities
export function getOptimalSettings() {
  // Check device capabilities
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : true;
    // Adjust based on device
  if (isMobile || isLowEndDevice) {
    return {
      renderDistance: 2,    // Very short render distance (was 3)
      dpr: [0.5, 0.65],      // Even lower resolution
      shadows: false,        // Disable shadows
      maxTextureSize: 256,   // Very small textures (was 512)
      chunkSize: 16,         // Smaller chunks
      frameLoop: 'demand',   // Render only when needed
      maxChunks: VOXEL_MEMORY_CONFIG.MAX_CHUNKS_LOW_END
    };
  }
    // For medium devices
  const isHighEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency >= 8 : false;
  if (!isHighEndDevice) {
    return {
      renderDistance: 3,     // Reduced medium render distance (was 5)
      dpr: [0.65, 0.85],        // Lower medium resolution
      shadows: false,         // Keep shadows disabled
      maxTextureSize: 512,  // Reduced medium textures (was 1024)
      chunkSize: 16,          // Standard chunk size
      frameLoop: 'always',   // Always render
      maxChunks: VOXEL_MEMORY_CONFIG.MAX_CHUNKS_MID_RANGE
    };
  }
    // For high-end devices - CONSERVATIVE EVEN FOR HIGH-END
  return {
    renderDistance: 5,       // Reduced long render distance (was 8)
    dpr: [0.85, 1.2],           // Slightly reduced high resolution
    shadows: false,           // Keep shadows disabled for performance
    maxTextureSize: 1024,    // Reduced high quality textures (was 2048)
    chunkSize: 16,            // Standard chunk size
    frameLoop: 'always',     // Always render
    maxChunks: VOXEL_MEMORY_CONFIG.MAX_CHUNKS_HIGH_END
  };
}

/**
 * Checks the current WebGL memory status
 * @param gl WebGL renderer 
 * @returns Memory stats and risk assessment
 */
export function checkWebGLMemoryStatus(gl: any) {
  if (!gl || !gl.info) {
    return { risk: 'unknown' };
  }
  
  try {
    // Get current stats
    const memory = gl.info.memory || {};
    const render = gl.info.render || {};
    
    const stats = {
      geometries: memory.geometries || 0,
      textures: memory.textures || 0,
      calls: render.calls || 0,
      triangles: render.triangles || 0,
      risk: 'low' as 'low' | 'medium' | 'high' | 'critical' | 'unknown'
    };
      // Assess risk level with new aggressive thresholds
    if (stats.geometries > VOXEL_MEMORY_CONFIG.MAX_GEOMETRY_COUNT) {
      stats.risk = 'critical';
    } else if (stats.geometries > VOXEL_MEMORY_CONFIG.DANGER_GEOMETRY_COUNT) {
      stats.risk = 'high';
    } else if (stats.geometries > VOXEL_MEMORY_CONFIG.WARNING_GEOMETRY_COUNT) {
      stats.risk = 'medium';
    } else if (stats.geometries > VOXEL_MEMORY_CONFIG.CRITICAL_GEOMETRY_COUNT) {
      stats.risk = 'medium'; // Start warning earlier
    }
    
    return stats;
  } catch (e) {
    console.warn("Error checking WebGL memory:", e);
    return { risk: 'unknown' };
  }
}

// Configure GPU requirements
export function configureGPU(gl: any) {
  try {
    // Try to get the renderer info
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      
      console.log(`GPU: ${vendor} - ${renderer}`);
      
      // Check for known problematic GPUs or drivers
      const isIntegrated = /intel/i.test(renderer) || /llvmpipe/i.test(renderer);
      const isMobile = /adreno|mali|apple|powervr/i.test(renderer.toLowerCase());
      
      // Return configuration based on GPU type
      return {
        isIntegrated,
        isMobile,
        needsMemoryOptimization: isIntegrated || isMobile,
        supportsInstancing: !(/angle/i.test(renderer) && /direct3d9/i.test(renderer))
      };
    }
  } catch (e) {
    console.warn("Unable to get GPU info:", e);
  }
  
  // Default fallback
  return {
    isIntegrated: true,
    isMobile: false,
    needsMemoryOptimization: true,
    supportsInstancing: true
  };
}

/**
 * Apply aggressive optimization for high geometry scenarios
 * @param gl WebGL renderer
 * @param scene Scene object
 * @returns Success status
 */
export function applyAggressiveOptimization(gl: any, scene: any) {
  // Skip if objects don't exist
  if (!gl || !scene) return false;
  
  try {
    // Apply render quality reductions
    if (gl.setPixelRatio) {
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 0.75)); // Reduce resolution
    }
    
    // Reduce shadow quality
    if (gl.shadowMap) {
      gl.shadowMap.enabled = false;
      gl.shadowMap.autoUpdate = false;
    }
    
    // Force all materials to low quality
    if (scene.traverse) {
      scene.traverse((object: any) => {
        if (object.material) {
          const materials = Array.isArray(object.material) 
            ? object.material 
            : [object.material];
            
          materials.forEach((material: any) => {
            // Reduce material quality
            if (material.roughness !== undefined) material.roughness = 1;
            if (material.metalness !== undefined) material.metalness = 0;
            material.flatShading = true;
            material.precision = 'lowp';
            material.fog = false;
            
            // Disable expensive material features
            if (material.envMap) material.envMap = null;
            material.lights = false;
            material.needsUpdate = true;
          });
        }
      });
    }
    
    return true;
  } catch (e) {
    console.error("Error applying aggressive optimization:", e);
    return false;
  }
}

// Help recover from context loss
export function setupContextRecoveryOptions(gl: any) {
  try {
    // Configure extension if available
    const loseContextExt = gl.getExtension('WEBGL_lose_context');
    
    // Configure context attributes if possible
    if (gl.canvas && gl.canvas.addEventListener) {
      // Add handlers for context events
      gl.canvas.addEventListener('webglcontextlost', (e: Event) => {
        console.warn('WebGL context lost event at canvas level');
        e.preventDefault(); // Prevent default to allow recovery
      });
      
      gl.canvas.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored event at canvas level');
      });
    }
    
    // Return the extension for manual testing/recovery
    return loseContextExt;
  } catch (e) {
    console.error("Error setting up context recovery:", e);
    return null;
  }
}

/**
 * Emergency memory cleanup when approaching WebGL context loss
 * @param gl WebGL renderer
 * @param scene Scene object  
 * @param chunks Array of chunk objects to potentially remove
 * @returns Number of objects cleaned up
 */
export function emergencyMemoryCleanup(gl: any, scene: any, chunks: any[] = []) {
  let cleanedCount = 0;
  
  try {
    console.warn('🚨 Emergency memory cleanup initiated!');
      // 1. Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    // 2. Remove distant chunks immediately
    chunks.forEach((chunk, index) => {
      if (chunk && chunk.position) {
        const distance = Math.sqrt(
          chunk.position.x * chunk.position.x + 
          chunk.position.z * chunk.position.z
        );
        
        // Remove chunks beyond emergency distance
        if (distance > VOXEL_MEMORY_CONFIG.CLEANUP_DISTANCE_CRITICAL) {
          if (chunk.dispose) chunk.dispose();
          if (scene && scene.remove) scene.remove(chunk);
          chunks.splice(index, 1);
          cleanedCount++;
        }
      }
    });
    
    // 3. Dispose unused geometries and materials
    if (scene && scene.traverse) {
      scene.traverse((object: any) => {
        if (object.geometry && object.geometry.dispose) {
          // Check if geometry is shared
          if (!object.geometry.userData.shared) {
            object.geometry.dispose();
            cleanedCount++;
          }
        }
        
        if (object.material) {
          const materials = Array.isArray(object.material) 
            ? object.material 
            : [object.material];
            
          materials.forEach((material: any) => {
            if (material.dispose && !material.userData.shared) {
              material.dispose();
              cleanedCount++;
            }
          });
        }
      });
    }
    
    // 4. Force WebGL state cleanup
    if (gl && gl.info) {
      gl.info.autoReset = true;
      gl.resetState();
    }
    
    console.log(`🧹 Emergency cleanup removed ${cleanedCount} objects`);
    return cleanedCount;
    
  } catch (e) {
    console.error("Error during emergency cleanup:", e);
    return cleanedCount;
  }
}

/**
 * Calculate if LOD (Level of Detail) should be applied based on distance and memory pressure
 * @param distance Distance from camera
 * @param memoryPressure Memory pressure level (0-1)
 * @returns LOD level (0 = full detail, 1 = medium detail, 2 = low detail)
 */
export function calculateLODLevel(distance: number, memoryPressure: number = 0): number {
  // Adjust thresholds based on memory pressure
  const pressureFactor = 1 - Math.min(1, Math.max(0, memoryPressure));
  const nearThreshold = VOXEL_MEMORY_CONFIG.LOD_DISTANCE_NEAR * pressureFactor;
  const midThreshold = VOXEL_MEMORY_CONFIG.LOD_DISTANCE_MID * pressureFactor;
  
  if (distance <= nearThreshold) {
    return 0; // Full detail
  } else if (distance <= midThreshold) {
    return 1; // Medium detail
  } else {
    return 2; // Low detail
  }
}
