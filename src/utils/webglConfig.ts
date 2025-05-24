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
  // Maximum resource counts before action is needed
  MAX_GEOMETRY_COUNT: 30000,  // Much more aggressive limit (was 50000)
  MAX_TEXTURE_COUNT: 1000,
  MAX_RENDER_CALLS: 5000,     // Keep draw calls reasonable
  DANGER_GEOMETRY_COUNT: 25000, // Lower threshold for entering danger zone (was 40000)
  WARNING_GEOMETRY_COUNT: 20000, // New warning threshold
  
  // Memory spike detection thresholds (percentage increase)
  MEMORY_SPIKE_THRESHOLD: 20, // More sensitive spike detection (was 30%)
  
  // Chunk management to prevent excessive geometry
  MAX_CHUNKS_LOW_END: 9,      // For low-end devices
  MAX_CHUNKS_MID_RANGE: 16,   // For mid-range devices
  MAX_CHUNKS_HIGH_END: 25,    // Reduced from 36 to 25 for high-end devices
  
  // Dynamic LOD settings to reduce geometry count
  ENABLE_LOD: true,
  LOD_DISTANCE_NEAR: 24,      // Reduced full detail distance (was 32)
  LOD_DISTANCE_MID: 48,       // Reduced medium detail distance (was 64) 
  LOD_DISTANCE_FAR: 96,       // Reduced low detail distance (was 128)
  
  // Maximum geometry per chunk to prevent excessive detail
  MAX_GEOMETRY_PER_CHUNK: 1200, // Limit blocks per chunk
  SIMPLIFY_THRESHOLD: 900,     // Threshold to trigger block merging
  
  // Memory cleanup intervals (milliseconds)
  CLEANUP_INTERVAL_NORMAL: 30000,    // 30 seconds in normal operation
  CLEANUP_INTERVAL_WARNING: 10000,   // 10 seconds when memory pressure detected
  CLEANUP_INTERVAL_CRITICAL: 5000,   // 5 seconds in critical situations
  
  // Object distance thresholds for cleanup
  CLEANUP_DISTANCE_NORMAL: 100,      // Normal cleanup distance threshold
  CLEANUP_DISTANCE_WARNING: 75,      // Warning level distance threshold
  CLEANUP_DISTANCE_CRITICAL: 40      // Critical level distance threshold
};

// Adapt render settings based on device capabilities
export function getOptimalSettings() {
  // Check device capabilities
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : true;
  
  // Adjust based on device
  if (isMobile || isLowEndDevice) {
    return {
      renderDistance: 3,    // Short render distance
      dpr: [0.5, 0.75],      // Low resolution
      shadows: false,        // Disable shadows
      maxTextureSize: 512,   // Small textures
      chunkSize: 16,         // Smaller chunks
      frameLoop: 'demand',   // Render only when needed
      maxChunks: VOXEL_MEMORY_CONFIG.MAX_CHUNKS_LOW_END
    };
  }
  
  // For medium devices
  const isHighEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency >= 8 : false;
  if (!isHighEndDevice) {
    return {
      renderDistance: 5,     // Medium render distance
      dpr: [0.75, 1],        // Medium resolution
      shadows: false,         // Basic shadows
      maxTextureSize: 1024,  // Medium textures
      chunkSize: 16,          // Standard chunk size
      frameLoop: 'always',   // Always render
      maxChunks: VOXEL_MEMORY_CONFIG.MAX_CHUNKS_MID_RANGE
    };
  }
  
  // For high-end devices
  return {
    renderDistance: 8,       // Long render distance
    dpr: [1, 1.5],           // High resolution
    shadows: true,           // Full shadows
    maxTextureSize: 2048,    // High quality textures
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
    
    // Assess risk level
    if (stats.geometries > VOXEL_MEMORY_CONFIG.MAX_GEOMETRY_COUNT) {
      stats.risk = 'critical';
    } else if (stats.geometries > VOXEL_MEMORY_CONFIG.DANGER_GEOMETRY_COUNT) {
      stats.risk = 'high';
    } else if (stats.geometries > VOXEL_MEMORY_CONFIG.DANGER_GEOMETRY_COUNT * 0.7) {
      stats.risk = 'medium';
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
