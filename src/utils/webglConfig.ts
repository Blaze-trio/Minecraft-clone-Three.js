/**
 * WebGL configuration and optimization settings
 */

// Default WebGL renderer settings for optimal performance
export const WEBGL_RENDERER_CONFIG = {
  antialias: false,           // Disable antialiasing for better performance
  powerPreference: 'high-performance', // Request high performance GPU
  precision: 'lowp',          // Use low precision for better performance
  depth: true,                // Keep depth buffer for proper rendering
  stencil: false,             // Disable stencil buffer if not needed
  alpha: false,               // Disable alpha for better performance
  preserveDrawingBuffer: true, // Important for context recovery
  failIfMajorPerformanceCaveat: false // Don't fail on low-end devices
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
      maxChunks: 9           // Limit chunk count
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
      maxChunks: 25          // Medium chunk count
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
    maxChunks: 64            // Many chunks
  };
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
