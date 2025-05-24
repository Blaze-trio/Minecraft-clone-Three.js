// Controlled geometry test - systematically add components to isolate the leak
import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { PlayerController } from './PlayerController';

// Geometry monitor component
const GeometryMonitor: React.FC<{ 
  onUpdate: (stats: { geometries: number; textures: number; calls: number }) => void 
}> = ({ onUpdate }) => {
  const { gl } = useThree();
  const frameCount = useRef(0);
  
  useFrame(() => {
    frameCount.current++;
    
    // Update stats every 60 frames (1 second at 60fps)
    if (frameCount.current % 60 === 0 && gl?.info) {
      const memory = gl.info.memory || {};
      const render = gl.info.render || {};
      
      onUpdate({
        geometries: memory.geometries || 0,
        textures: memory.textures || 0,
        calls: render.calls || 0
      });
    }
  });
  
  return null;
};

// Single test chunk component (minimal geometry)
const TestChunk: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  if (!enabled) return null;
  
  // Create a simple 3x3x3 chunk with only a few blocks
  const blocks = [];
  for (let x = 0; x < 3; x++) {
    for (let z = 0; z < 3; z++) {
      // Only ground level
      blocks.push(
        <mesh key={`${x}-0-${z}`} position={[x, 0, z]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
      );
    }
  }
  
  return <group>{blocks}</group>;
};

export const ControlledGeometryTest: React.FC = () => {
  // Component enablement states
  const [enablePlayer, setEnablePlayer] = useState(false);
  const [enableChunk, setEnableChunk] = useState(false);
  const [enableControls, setEnableControls] = useState(false);
  
  // Geometry stats
  const [stats, setStats] = useState({ geometries: 0, textures: 0, calls: 0 });
  const [baseline, setBaseline] = useState<number | null>(null);
  
  // Set baseline after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseline === null) {
        setBaseline(stats.geometries);
        console.log(`🎯 BASELINE SET: ${stats.geometries} geometries`);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [stats.geometries, baseline]);
  
  const getGeometryDelta = () => baseline !== null ? stats.geometries - baseline : 0;
  
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#87CEEB' }}>
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        zIndex: 1000,
        minWidth: '300px'
      }}>
        <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '15px' }}>
          🔬 CONTROLLED GEOMETRY TEST
        </div>
        
        {/* Current Stats */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#111', borderRadius: '4px' }}>
          <div>📊 <strong>Current Geometries:</strong> {stats.geometries}</div>
          <div>🎯 <strong>Baseline:</strong> {baseline ?? 'Setting...'}</div>
          <div style={{ 
            color: getGeometryDelta() > 0 ? '#ff6b6b' : '#4CAF50',
            fontWeight: 'bold'
          }}>
            ⚡ <strong>Delta:</strong> +{getGeometryDelta()} geometries
          </div>
          <div>🖼️ <strong>Textures:</strong> {stats.textures}</div>
          <div>📞 <strong>Calls:</strong> {stats.calls}</div>
        </div>
        
        {/* Component Controls */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ color: '#FFA500', fontWeight: 'bold', marginBottom: '10px' }}>
            Enable Components:
          </div>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enablePlayer} 
              onChange={(e) => setEnablePlayer(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            PlayerController (+? geometries)
          </label>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enableChunk} 
              onChange={(e) => setEnableChunk(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Test Chunk (3x3x3 = +9 geometries expected)
          </label>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enableControls} 
              onChange={(e) => setEnableControls(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            PointerLockControls (+? geometries)
          </label>
        </div>
        
        {/* Instructions */}
        <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
          <strong>Instructions:</strong><br/>
          1. Wait for baseline to be set (2 seconds)<br/>
          2. Enable components one by one<br/>
          3. Watch geometry delta to identify leaks<br/>
          4. Expected: Small, predictable increases only
        </div>
      </div>
      
      {/* 3D Scene */}
      <Canvas camera={{ position: [5, 5, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        {/* Geometry Monitor */}
        <GeometryMonitor onUpdate={setStats} />
        
        {/* Conditionally enabled components */}
        {enablePlayer && (
          <PlayerController 
            position={[0, 2, 0]} 
            onPositionChange={() => {}} 
          />
        )}
        
        {enableChunk && <TestChunk enabled={true} />}
        
        {enableControls && <PointerLockControls />}
      </Canvas>
    </div>
  );
};
