// Advanced controlled test for actual game components
import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { PlayerController } from './PlayerController';
import { ChunkComponent } from './Block';
import { OptimizedChunk } from './OptimizedBlock';
import { ImprovedWorldGenerator } from '../utils/cleanGenerator';
import type { Chunk } from '../types/game';

// Geometry monitor with detailed logging
const AdvancedGeometryMonitor: React.FC<{ 
  onUpdate: (stats: { geometries: number; textures: number; calls: number; triangles: number }) => void 
}> = ({ onUpdate }) => {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastGeometries = useRef(0);
  
  useFrame(() => {
    frameCount.current++;
    
    // Update stats every 30 frames (0.5 seconds at 60fps) for faster feedback
    if (frameCount.current % 30 === 0 && gl?.info) {
      const memory = gl.info.memory || {};
      const render = gl.info.render || {};
      
      const currentGeometries = memory.geometries || 0;
      const delta = currentGeometries - lastGeometries.current;
      
      // Log significant changes
      if (delta > 0) {
        console.log(`📈 GEOMETRY INCREASE: +${delta} (${lastGeometries.current} → ${currentGeometries})`);
      } else if (delta < 0) {
        console.log(`📉 GEOMETRY DECREASE: ${delta} (${lastGeometries.current} → ${currentGeometries})`);
      }
      
      lastGeometries.current = currentGeometries;
      
      onUpdate({
        geometries: currentGeometries,
        textures: memory.textures || 0,
        calls: render.calls || 0,
        triangles: render.triangles || 0
      });
    }
  });
  
  return null;
};

// Single block test component
const SingleBlock: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  if (!enabled) return null;
  
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#8B4513" />
    </mesh>
  );
};

// Small chunk test (2x2x2 = 8 blocks) - NO CULLING VERSION
const SmallChunk: React.FC<{ enabled: boolean; useOptimized: boolean }> = ({ enabled, useOptimized }) => {
  const [chunk, setChunk] = useState<Chunk | null>(null);
  
  useEffect(() => {
    if (!enabled) {
      setChunk(null);
      return;
    }
    
    // Create a minimal 2x2x2 chunk with separation (no occlusion culling)
    const blocks = [];
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          blocks.push({
            x: x * 3, // Separate blocks so no culling happens
            y: y * 3,
            z: z * 3,
            type: 1 // dirt
          });
        }
      }
    }
    
    console.log(`🔧 SmallChunk created with ${blocks.length} blocks (separated to avoid culling)`);
      setChunk({
      x: 0,
      z: 0,
      blocks: blocks,
      isReady: true
    });
  }, [enabled]);
  
  if (!chunk) return null;
  
  if (useOptimized) {
    return <OptimizedChunk chunk={chunk} chunkX={0} chunkZ={0} />;
  } else {
    // Use ChunkComponent but log what it's doing
    console.log(`🎯 Rendering ChunkComponent with ${chunk.blocks.length} input blocks`);
    return <ChunkComponent blocks={chunk.blocks} chunkKey="test-chunk" />;
  }
};

export const RealComponentTest: React.FC = () => {
  // Component states
  const [enablePlayer, setEnablePlayer] = useState(false);
  const [enableSingleBlock, setEnableSingleBlock] = useState(false);
  const [enableSmallChunk, setEnableSmallChunk] = useState(false);
  const [useOptimizedChunk, setUseOptimizedChunk] = useState(false);
  const [enableControls, setEnableControls] = useState(false);
  
  // Stats tracking
  const [stats, setStats] = useState({ geometries: 0, textures: 0, calls: 0, triangles: 0 });
  const [baseline, setBaseline] = useState<number | null>(null);
  const [checkpoints, setCheckpoints] = useState<Array<{name: string, geometries: number}>>([]);
  
  // Set baseline after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseline === null) {
        setBaseline(stats.geometries);
        setCheckpoints([{name: 'Baseline', geometries: stats.geometries}]);
        console.log(`🎯 BASELINE SET: ${stats.geometries} geometries`);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [stats.geometries, baseline]);
  
  const getGeometryDelta = () => baseline !== null ? stats.geometries - baseline : 0;
  
  // Add checkpoint when components change
  const addCheckpoint = (name: string) => {
    const newCheckpoint = {name, geometries: stats.geometries};
    setCheckpoints(prev => [...prev, newCheckpoint]);
    console.log(`📍 CHECKPOINT: ${name} = ${stats.geometries} geometries`);
  };
  
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#87CEEB' }}>
      {/* Enhanced Control Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.95)',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '13px',
        zIndex: 1000,
        minWidth: '400px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ color: '#FF6B6B', fontWeight: 'bold', marginBottom: '15px', fontSize: '16px' }}>
          🔬 REAL COMPONENT GEOMETRY TEST
        </div>
        
        {/* Current Stats */}
        <div style={{ marginBottom: '15px', padding: '12px', background: '#111', borderRadius: '6px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>📊 Current Stats:</div>
          <div>Geometries: <span style={{color: '#4CAF50', fontWeight: 'bold'}}>{stats.geometries}</span></div>
          <div>Baseline: <span style={{color: '#FFA500'}}>{baseline ?? 'Setting...'}</span></div>
          <div style={{ 
            color: getGeometryDelta() > 0 ? '#ff6b6b' : '#4CAF50',
            fontWeight: 'bold'
          }}>
            Delta: <span style={{fontSize: '15px'}}>+{getGeometryDelta()}</span> geometries
          </div>
          <div>Textures: {stats.textures}</div>
          <div>Triangles: {stats.triangles.toLocaleString()}</div>
          <div>Draw Calls: {stats.calls}</div>
        </div>
        
        {/* Component Controls */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '10px' }}>
            🎛️ Enable Components:
          </div>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enablePlayer} 
              onChange={(e) => {
                setEnablePlayer(e.target.checked);
                if (e.target.checked) addCheckpoint('PlayerController');
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: enablePlayer ? '#4CAF50' : '#ccc'}}>
              PlayerController (expected: +0 geometries)
            </span>
          </label>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enableSingleBlock} 
              onChange={(e) => {
                setEnableSingleBlock(e.target.checked);
                if (e.target.checked) addCheckpoint('Single Block');
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: enableSingleBlock ? '#4CAF50' : '#ccc'}}>
              Single Block (expected: +1 geometry)
            </span>
          </label>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enableSmallChunk} 
              onChange={(e) => {
                setEnableSmallChunk(e.target.checked);
                if (e.target.checked) addCheckpoint(useOptimizedChunk ? 'OptimizedChunk 2x2x2' : 'ChunkComponent 2x2x2');
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: enableSmallChunk ? '#4CAF50' : '#ccc'}}>
              Small Chunk 2x2x2 (expected: +8 geometries)
            </span>
          </label>
          
          {enableSmallChunk && (
            <label style={{ display: 'block', marginBottom: '8px', marginLeft: '20px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={useOptimizedChunk} 
                onChange={(e) => {
                  setUseOptimizedChunk(e.target.checked);
                  addCheckpoint(e.target.checked ? 'Switched to OptimizedChunk' : 'Switched to ChunkComponent');
                }}
                style={{ marginRight: '8px' }}
              />
              <span style={{color: useOptimizedChunk ? '#FFA500' : '#ccc'}}>
                Use OptimizedChunk (instanced rendering)
              </span>
            </label>
          )}
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={enableControls} 
              onChange={(e) => {
                setEnableControls(e.target.checked);
                if (e.target.checked) addCheckpoint('PointerLockControls');
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: enableControls ? '#4CAF50' : '#ccc'}}>
              PointerLockControls (expected: +0 geometries)
            </span>
          </label>
        </div>
        
        {/* Checkpoints History */}
        {checkpoints.length > 1 && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#FFA500', fontWeight: 'bold', marginBottom: '8px' }}>
              📍 Geometry History:
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px' }}>
              {checkpoints.map((checkpoint, index) => {
                const delta = index > 0 ? checkpoint.geometries - checkpoints[index-1].geometries : 0;
                return (
                  <div key={index} style={{ 
                    marginBottom: '4px',
                    color: delta > 10 ? '#ff6b6b' : delta > 0 ? '#FFA500' : '#4CAF50'
                  }}>
                    {checkpoint.name}: {checkpoint.geometries} 
                    {delta !== 0 && <span style={{fontWeight: 'bold'}}> (+{delta})</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Instructions */}
        <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.4', marginTop: '10px' }}>
          <strong>🎯 Test Goal:</strong><br/>
          Find which component creates excessive geometries.<br/>
          <strong>Expected totals:</strong> 1 block = +1, 8 blocks = +8<br/>
          <strong>⚠️ Red flag:</strong> If any component adds 50+ geometries!
        </div>
      </div>
      
      {/* 3D Scene */}
      <Canvas camera={{ position: [5, 5, 5], fov: 75 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
        {/* Advanced Geometry Monitor */}
        <AdvancedGeometryMonitor onUpdate={setStats} />
        
        {/* Test Components */}
        {enablePlayer && (
          <PlayerController 
            position={[0, 2, 0]} 
            onPositionChange={() => {}} 
          />
        )}
        
        {enableSingleBlock && <SingleBlock enabled={true} />}
        
        {enableSmallChunk && (
          <SmallChunk enabled={true} useOptimized={useOptimizedChunk} />
        )}
        
        {enableControls && <PointerLockControls />}
      </Canvas>
    </div>
  );
};
