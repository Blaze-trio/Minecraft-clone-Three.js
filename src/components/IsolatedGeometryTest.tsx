// Isolated test for specific geometry issues
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { ChunkComponent } from './Block';
import type { Block as BlockType } from '../types/game';

// Simple geometry monitor
const SimpleGeometryMonitor: React.FC<{ 
  onUpdate: (count: number) => void 
}> = ({ onUpdate }) => {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastCount = useRef(0);
  
  useFrame(() => {
    frameCount.current++;
    
    // Only check every 60 frames (1 second at 60fps) to reduce overhead
    if (frameCount.current % 60 === 0 && gl?.info?.memory) {
      const currentCount = gl.info.memory.geometries || 0;
      
      // Only update if count actually changed
      if (currentCount !== lastCount.current) {
        lastCount.current = currentCount;
        onUpdate(currentCount);
      }
    }
  });
  
  return null;
};

// Test 1: Direct blocks (should create exactly 8 geometries)
const DirectBlocksTest: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  // Use useMemo to prevent infinite re-renders
  const blocks = useMemo(() => {
    if (!enabled) return null;
    
    console.log('🔧 DirectBlocksTest: Creating 8 direct mesh components');
    
    const blockElements = [];
    for (let i = 0; i < 8; i++) {
      blockElements.push(
        <mesh key={`direct-${i}`} position={[i * 3, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
      );
    }
    
    return <group>{blockElements}</group>;
  }, [enabled]);
  
  return blocks;
};

// Test 2: ChunkComponent with widely separated blocks (no culling)
const ChunkComponentTest: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [chunk, setChunk] = useState<BlockType[] | null>(null);
  
  useEffect(() => {
    if (!enabled) {
      setChunk(null);
      return;
    }
    
    // Create 8 blocks separated by 20 units (no possible occlusion)
    const blocks: BlockType[] = [];
    for (let i = 0; i < 8; i++) {
      blocks.push({
        x: i * 20, // Massive separation
        y: 0,
        z: 0,
        type: 1 // dirt
      });
    }
    
    console.log(`🔧 ChunkComponentTest: Created ${blocks.length} blocks with 20-unit separation`);
    console.log('🔧 Block positions:', blocks.map(b => `(${b.x},${b.y},${b.z})`));
    setChunk(blocks);
  }, [enabled]); // Only depend on enabled, not on other changing values
  
  // Use useMemo to prevent re-rendering the component
  const chunkElement = useMemo(() => {
    if (!chunk) return null;
    return <ChunkComponent blocks={chunk} chunkKey="isolated-test" />;
  }, [chunk]);
  
  return chunkElement;
};

// Test 3: PointerLockControls (should create 0 geometries)
const ControlsTest: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  // Use useMemo to prevent infinite re-renders and only log once per enable/disable
  const controls = useMemo(() => {
    if (!enabled) return null;
    
    console.log('🔧 ControlsTest: Adding PointerLockControls');
    return <PointerLockControls />;
  }, [enabled]);
  
  return controls;
};

export const IsolatedGeometryTest: React.FC = () => {
  const [geometryCount, setGeometryCount] = useState(0);
  const [baseline, setBaseline] = useState<number | null>(null);
  
  // Test states
  const [testDirectBlocks, setTestDirectBlocks] = useState(false);
  const [testChunkComponent, setTestChunkComponent] = useState(false);
  const [testControls, setTestControls] = useState(false);
  
  // Set baseline after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseline === null) {
        setBaseline(geometryCount);
        console.log(`🎯 BASELINE SET: ${geometryCount} geometries`);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [geometryCount, baseline]);
  
  const getDelta = () => baseline !== null ? geometryCount - baseline : 0;
  
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
        zIndex: 1000,
        minWidth: '350px'
      }}>
        <div style={{ color: '#FF6B6B', fontWeight: 'bold', marginBottom: '15px' }}>
          🔬 ISOLATED GEOMETRY TEST
        </div>
        
        {/* Stats */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#111', borderRadius: '4px' }}>
          <div>Geometries: <span style={{color: '#4CAF50', fontWeight: 'bold'}}>{geometryCount}</span></div>
          <div>Baseline: <span style={{color: '#FFA500'}}>{baseline ?? 'Setting...'}</span></div>
          <div style={{ 
            color: getDelta() > 0 ? '#ff6b6b' : '#4CAF50',
            fontWeight: 'bold'
          }}>
            Delta: +{getDelta()}
          </div>
        </div>
        
        {/* Test Controls */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '10px' }}>
            Tests:
          </div>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={testDirectBlocks} 
              onChange={(e) => {
                setTestDirectBlocks(e.target.checked);
                console.log(`🎯 DirectBlocks ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: testDirectBlocks ? '#4CAF50' : '#ccc'}}>
              8 Direct Blocks (Expected: +8)
            </span>
          </label>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={testChunkComponent} 
              onChange={(e) => {
                setTestChunkComponent(e.target.checked);
                console.log(`🎯 ChunkComponent ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: testChunkComponent ? '#4CAF50' : '#ccc'}}>
              ChunkComponent 8 blocks (Expected: +8)
            </span>
          </label>
          
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={testControls} 
              onChange={(e) => {
                setTestControls(e.target.checked);
                console.log(`🎯 PointerLockControls ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
              }}
              style={{ marginRight: '8px' }}
            />
            <span style={{color: testControls ? '#4CAF50' : '#ccc'}}>
              PointerLockControls (Expected: +0)
            </span>
          </label>
        </div>
        
        <div style={{ fontSize: '11px', color: '#ccc', marginTop: '10px' }}>
          <strong>Goal:</strong> Identify which component is broken
        </div>
      </div>
      
      {/* 3D Scene */}
      <Canvas camera={{ position: [10, 10, 10], fov: 75 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
        <SimpleGeometryMonitor onUpdate={setGeometryCount} />
        
        {/* Test Components */}
        <DirectBlocksTest enabled={testDirectBlocks} />
        <ChunkComponentTest enabled={testChunkComponent} />
        <ControlsTest enabled={testControls} />
      </Canvas>
    </div>
  );
};
