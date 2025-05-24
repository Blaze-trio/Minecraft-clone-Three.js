// Enhanced WebGL Performance Monitor with Aggressive Context Loss Prevention
import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useCallback } from 'react';
import { 
  checkWebGLMemoryStatus, 
  emergencyMemoryCleanup, 
  applyAggressiveOptimization,
  VOXEL_MEMORY_CONFIG 
} from '../utils/webglConfig';
import type { HUDData } from './GameHUD';

interface EnhancedMonitorProps {
  setHUDData: React.Dispatch<React.SetStateAction<HUDData>>;
  chunks?: any[];
  onEmergencyCleanup?: (cleanedCount: number) => void;
  onPerformanceAlert?: (level: 'warning' | 'critical' | 'emergency') => void;
}

interface MemoryStats {
  geometries: number;
  textures: number;
  calls: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export const EnhancedWebGLMonitor: React.FC<EnhancedMonitorProps> = ({
  setHUDData,
  chunks = [],
  onEmergencyCleanup,
  onPerformanceAlert
}) => {
  const { gl, scene } = useThree();
  const memoryStatsRef = useRef<MemoryStats>({
    geometries: 0,
    textures: 0,
    calls: 0,
    risk: 'low'
  });
  const lastCleanupTime = useRef(Date.now());
  const consecutiveHighFrames = useRef(0);
  const consecutiveLowFrames = useRef(0);
  const aggressiveModeActive = useRef(false);
  const cleanupCooldown = useRef(false);
  const contextLossPreventionActive = useRef(false);

  // Emergency cleanup function with callbacks
  const performEmergencyCleanup = useCallback(() => {
    if (cleanupCooldown.current) return 0;
    
    const cleanedCount = emergencyMemoryCleanup(gl, scene, chunks);
    cleanupCooldown.current = true;
    
    // Reset cooldown after 5 seconds
    setTimeout(() => {
      cleanupCooldown.current = false;
    }, 5000);
    
    if (onEmergencyCleanup) {
      onEmergencyCleanup(cleanedCount);
    }
    
    return cleanedCount;
  }, [gl, scene, chunks, onEmergencyCleanup]);

  // Progressive performance monitoring
  useFrame((_state, delta) => {
    if (!gl || !gl.info) return;

    const fps = 1 / Math.max(delta, 0.001);
    const memoryStatus = checkWebGLMemoryStatus(gl);
    memoryStatsRef.current = memoryStatus;

    // Update HUD with current memory stats
    setHUDData(prev => ({
      ...prev,
      webglMemoryStatus: {
        geometries: memoryStatus.geometries || 0,
        textures: memoryStatus.textures || 0,
        calls: memoryStatus.calls || 0,
        risk: memoryStatus.risk
      }
    }));

    // Track FPS trends for more responsive action
    if (fps < 15) {
      consecutiveLowFrames.current++;
      consecutiveHighFrames.current = 0;
    } else if (fps > 45) {
      consecutiveHighFrames.current++;
      consecutiveLowFrames.current = 0;
    } else {
      // Reset counters for middle range FPS
      consecutiveLowFrames.current = Math.max(0, consecutiveLowFrames.current - 1);
      consecutiveHighFrames.current = Math.max(0, consecutiveHighFrames.current - 1);
    }

    // CRITICAL: Immediate context loss prevention
    if (memoryStatus.geometries > VOXEL_MEMORY_CONFIG.MAX_GEOMETRY_COUNT) {
      if (!contextLossPreventionActive.current) {
        contextLossPreventionActive.current = true;
        console.error('🚨 CRITICAL: Geometry count exceeded maximum! Initiating emergency protocols...');
        
        if (onPerformanceAlert) onPerformanceAlert('emergency');
        
        // Apply immediate aggressive optimizations
        applyAggressiveOptimization(gl, scene);
        
        // Emergency cleanup
        const cleaned = performEmergencyCleanup();
        console.log(`Emergency cleanup removed ${cleaned} objects`);
        
        // Dispatch global emergency event for other systems to respond
        window.dispatchEvent(new CustomEvent('webgl-emergency-mode', {
          detail: { 
            geometries: memoryStatus.geometries,
            action: 'emergency-cleanup-initiated',
            cleaned 
          }
        }));
        
        // Reset prevention flag after 10 seconds
        setTimeout(() => {
          contextLossPreventionActive.current = false;
        }, 10000);
      }
      return; // Skip other checks during emergency
    }

    // HIGH RISK: Aggressive prevention measures
    if (memoryStatus.geometries > VOXEL_MEMORY_CONFIG.DANGER_GEOMETRY_COUNT || memoryStatus.risk === 'high') {
      if (!aggressiveModeActive.current) {
        aggressiveModeActive.current = true;
        console.warn('⚠️ HIGH RISK: Entering aggressive optimization mode');
        
        if (onPerformanceAlert) onPerformanceAlert('critical');
        
        applyAggressiveOptimization(gl, scene);
        
        window.dispatchEvent(new CustomEvent('webgl-high-memory-pressure', {
          detail: { 
            geometries: memoryStatus.geometries,
            risk: memoryStatus.risk
          }
        }));
      }
      
      // Perform cleanup if it's been a while or FPS is suffering
      const timeSinceCleanup = Date.now() - lastCleanupTime.current;
      if (timeSinceCleanup > VOXEL_MEMORY_CONFIG.CLEANUP_INTERVAL_WARNING || consecutiveLowFrames.current > 30) {
        const cleaned = performEmergencyCleanup();
        lastCleanupTime.current = Date.now();
        console.log(`High-risk cleanup removed ${cleaned} objects`);
      }
    } 
    // MEDIUM RISK: Preventive measures
    else if (memoryStatus.geometries > VOXEL_MEMORY_CONFIG.WARNING_GEOMETRY_COUNT || memoryStatus.risk === 'medium') {
      if (onPerformanceAlert) onPerformanceAlert('warning');
      
      // Less aggressive cleanup on longer intervals
      const timeSinceCleanup = Date.now() - lastCleanupTime.current;
      if (timeSinceCleanup > VOXEL_MEMORY_CONFIG.CLEANUP_INTERVAL_NORMAL) {
        const cleaned = performEmergencyCleanup();
        lastCleanupTime.current = Date.now();
        console.log(`Preventive cleanup removed ${cleaned} objects`);
      }
    }
    // LOW RISK: Reset aggressive mode
    else if (memoryStatus.risk === 'low' && aggressiveModeActive.current) {
      // Only reset if we've had good performance for a while
      if (consecutiveHighFrames.current > 120) { // 2 seconds of good FPS
        aggressiveModeActive.current = false;
        console.log('✅ LOW RISK: Exiting aggressive optimization mode');
        
        window.dispatchEvent(new CustomEvent('webgl-memory-normal', {
          detail: { geometries: memoryStatus.geometries }
        }));
      }
    }
  });

  // Listen for global emergency events from other components
  useEffect(() => {
    const handleEmergencyMode = (e: any) => {
      console.log('Emergency mode triggered by external component:', e.detail);
      performEmergencyCleanup();
    };

    const handleMemoryCritical = (e: any) => {
      console.log('Memory critical event received:', e.detail);
      if (!aggressiveModeActive.current) {
        applyAggressiveOptimization(gl, scene);
        aggressiveModeActive.current = true;
      }
    };

    window.addEventListener('webgl-emergency-mode', handleEmergencyMode);
    window.addEventListener('webgl-memory-critical', handleMemoryCritical);
    window.addEventListener('webgl-geometry-critical', handleMemoryCritical);

    return () => {
      window.removeEventListener('webgl-emergency-mode', handleEmergencyMode);
      window.removeEventListener('webgl-memory-critical', handleMemoryCritical);
      window.removeEventListener('webgl-geometry-critical', handleMemoryCritical);
    };
  }, [gl, scene, performEmergencyCleanup]);

  // Periodic health checks
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      if (!gl || !gl.info) return;

      const memoryStatus = checkWebGLMemoryStatus(gl);
      
      // Log periodic status
      console.log(
        `WebGL Health Check - Geometries: ${memoryStatus.geometries}, ` +
        `Risk: ${memoryStatus.risk}, ` +
        `Aggressive Mode: ${aggressiveModeActive.current ? 'ON' : 'OFF'}`
      );

      // Check for memory leaks (continuous growth)
      if (memoryStatus.geometries > memoryStatsRef.current.geometries + 1000) {
        console.warn('Potential memory leak detected - rapid geometry growth');
        window.dispatchEvent(new CustomEvent('webgl-memory-leak-warning', {
          detail: { 
            previous: memoryStatsRef.current.geometries,
            current: memoryStatus.geometries
          }
        }));
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(healthCheckInterval);
  }, [gl]);

  return null; // This component doesn't render anything
};

export default EnhancedWebGLMonitor;
