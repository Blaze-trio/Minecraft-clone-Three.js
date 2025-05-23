import React, { useState, useEffect, useRef } from 'react';
import { Stats } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

// Performance monitor component
export const PerformanceStats: React.FC = () => {
  // Use Stats from drei with minimal styling
  return (
    <Stats 
      showPanel={0} // 0: fps, 1: ms, 2: mb, 3: custom
      className="stats-panel" 
    />
  );
};

// HUD data interface for communication between Canvas and HUD
export interface HUDData {
  fps: number;
  playerPosition: [number, number, number];
  renderDistance: number;
  chunksLoaded: number;
  totalChunks: number;
  webglContextStatus: 'stable' | 'warning' | 'lost' | 'restored';
}

// Shared state for transferring data from Canvas to HUD
export const useHUDState = () => {
  const [hudData, setHUDData] = useState<HUDData>({
    fps: 0,
    playerPosition: [0, 50, 0],
    renderDistance: 0,
    chunksLoaded: 0,
    totalChunks: 0,
    webglContextStatus: 'stable'
  });
  
  return { hudData, setHUDData };
};

// Component to calculate and update HUD data within Three.js context
export const HUDUpdater: React.FC<{
  setHUDData: React.Dispatch<React.SetStateAction<HUDData>>;
  playerPosition: [number, number, number];
  renderDistance: number;
  visibleChunks: number;
  totalChunks: number;
}> = ({ 
  setHUDData, 
  playerPosition, 
  renderDistance, 
  visibleChunks, 
  totalChunks 
}) => {
  const frameTime = useRef<number>(0);
  const fpsHistory = useRef<number[]>([]);
  const webglStatus = useRef<HUDData['webglContextStatus']>('stable');
  const lowFpsCounter = useRef<number>(0);
  
  // Monitor for WebGL context issues
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    // Set up context loss handler
    const handleContextLost = () => {
      console.warn('WebGL context was lost. Attempting to recover...');
      webglStatus.current = 'lost';
      
      // Update HUD immediately to show lost status
      setHUDData(prev => ({
        ...prev,
        webglContextStatus: 'lost'
      }));
    };
    
    // Set up context restored handler
    const handleContextRestored = () => {
      console.log('WebGL context was restored!');
      webglStatus.current = 'restored';
      
      // Update HUD to show restored status
      setHUDData(prev => ({
        ...prev,
        webglContextStatus: 'restored'
      }));
      
      // Reset to stable after a short delay
      setTimeout(() => {
        webglStatus.current = 'stable';
        setHUDData(prev => ({
          ...prev,
          webglContextStatus: 'stable'
        }));
      }, 3000);
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [setHUDData]);
  
  useFrame((_state, delta) => {
    frameTime.current = delta;
    
    // Calculate FPS with smoothing
    const fps = 1 / (frameTime.current || 0.016);
    fpsHistory.current.push(fps);
    
    // Keep FPS history to last 30 frames
    if (fpsHistory.current.length > 30) {
      fpsHistory.current.shift();
    }
    
    // Calculate average FPS for smoother display
    const avgFps = Math.round(
      fpsHistory.current.reduce((sum, val) => sum + val, 0) / 
      fpsHistory.current.length
    );
    
    // Track and update context health based on FPS
    if (avgFps < 15) {
      lowFpsCounter.current += 1;
      if (lowFpsCounter.current > 60 && webglStatus.current === 'stable') {
        webglStatus.current = 'warning';
      }
    } else {
      lowFpsCounter.current = 0;
      if (webglStatus.current === 'warning') {
        webglStatus.current = 'stable';
      }
    }
    
    // Update HUD data
    setHUDData({
      fps: avgFps,
      playerPosition,
      renderDistance,
      chunksLoaded: visibleChunks,
      totalChunks,
      webglContextStatus: webglStatus.current
    });
  });
  
  // No visual output for this component
  return null;
};

// HUD component to be rendered outside Three.js context
export const GameHUD: React.FC<{
  hudData: HUDData;
}> = ({ hudData }) => {
  const { fps, playerPosition, renderDistance, chunksLoaded, totalChunks, webglContextStatus } = hudData;
  
  // Apply color based on FPS for visual feedback
  const fpsColor = fps > 50 ? 'lime' : fps > 30 ? 'yellow' : 'red';
  
  // Status colors for WebGL context
  const getStatusInfo = () => {
    switch(webglContextStatus) {
      case 'stable':
        return { color: 'lime', text: 'Stable' };
      case 'warning':
        return { color: 'orange', text: 'Performance Warning' };
      case 'lost':
        return { color: 'red', text: 'Context Lost - Recovering...' };
      case 'restored':
        return { color: 'cyan', text: 'Context Restored' };
      default:
        return { color: 'white', text: 'Unknown' };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  return (
    <div className="game-hud" style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      color: 'white',
      fontFamily: 'monospace',
      background: 'rgba(0,0,0,0.6)',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 100,
      userSelect: 'none',
      pointerEvents: 'none'
    }}>
      <div style={{ color: fpsColor, fontWeight: 'bold' }}>
        FPS: {fps}
      </div>
      <div>
        Position: {playerPosition.map(p => p.toFixed(1)).join(', ')}
      </div>
      <div>
        Render Distance: {renderDistance}
      </div>
      <div>
        Chunks: {chunksLoaded} / {totalChunks}
      </div>
      <div style={{ color: statusInfo.color, marginTop: '5px', fontWeight: 'bold' }}>
        WebGL: {statusInfo.text}
      </div>
    </div>
  );
};

// Crosshair component for targeting blocks
export const Crosshair: React.FC = () => {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      fontSize: '24px',
      userSelect: 'none',
      pointerEvents: 'none',
      zIndex: 100
    }}>
      +
    </div>
  );
};

// Controls hint popup
export const ControlsHint: React.FC = () => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!visible) return null;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'white',
      fontFamily: 'monospace',
      background: 'rgba(0,0,0,0.7)',
      padding: '10px',
      borderRadius: '5px',
      textAlign: 'center',
      zIndex: 100,
      userSelect: 'none',
      pointerEvents: 'none'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Controls</h3>
      <p>WASD - Move | Space - Jump | Shift - Descend</p>
      <p>Click to lock mouse and look around</p>
    </div>
  );
};
