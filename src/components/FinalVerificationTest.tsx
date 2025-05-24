// Final verification test with exact geometry measurements
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { ChunkComponent } from './Block';
import type { Block as BlockType } from '../types/game';

// Precise geometry monitor with detailed reporting
const PreciseGeometryMonitor: React.FC<{ 
  onUpdate: (stats: {geometries: number, textures: number, programs: number}) => void 
}> = ({ onUpdate }) => {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastStats = useRef({geometries: 0, textures: 0, programs: 0});
  
  useFrame(() => {
    frameCount.current++;
    
    // Check every 30 frames for responsive feedback
    if (frameCount.current % 30 === 0 && gl?.info) {
      const memory = gl.info.memory || {};      const currentStats = {
        geometries: memory.geometries || 0,
        textures: memory.textures || 0,
        programs: (gl.info.programs?.length || 0) // Get program count from programs array
      };
      
      // Only update if any value changed
      if (JSON.stringify(currentStats) !== JSON.stringify(lastStats.current)) {
        const delta = currentStats.geometries - lastStats.current.geometries;
        if (delta !== 0) {
          console.log(`📊 GEOMETRY CHANGE: ${delta > 0 ? '+' : ''}${delta} (${lastStats.current.geometries} → ${currentStats.geometries})`);
        }
        
        lastStats.current = currentStats;
        onUpdate(currentStats);
      }
    }
  });
  
  return null;
};

// Test components with exact expectations
const Test8DirectBlocks: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const blocks = useMemo(() => {
    if (!enabled) return null;
    
    console.log('🔧 Creating 8 direct mesh blocks (Expected: +8 geometries)');
    
    const meshes = [];
    for (let i = 0; i < 8; i++) {
      meshes.push(
        <mesh key={`direct-${i}`} position={[i * 2, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
      );
    }
    
    return <group>{meshes}</group>;
  }, [enabled]);
  
  return blocks;
};

const Test8ChunkBlocks: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [chunk, setChunk] = useState<BlockType[] | null>(null);
  
  useEffect(() => {
    if (!enabled) {
      setChunk(null);
      return;
    }
    
    // Create 8 blocks with maximum separation to prevent any culling
    const blocks: BlockType[] = [];
    for (let i = 0; i < 8; i++) {
      blocks.push({
        x: i * 50, // Even more separation  
        y: 0,
        z: 0,
        type: 1 // dirt
      });
    }
    
    console.log(`🔧 Creating ChunkComponent with 8 blocks (Expected: +8 geometries)`);
    setChunk(blocks);
  }, [enabled]);
  
  const chunkElement = useMemo(() => {
    if (!chunk) return null;
    return <ChunkComponent blocks={chunk} chunkKey="final-test" />;
  }, [chunk]);
  
  return chunkElement;
};

export const FinalVerificationTest: React.FC = () => {
  const [stats, setStats] = useState({geometries: 0, textures: 0, programs: 0});
  const [baseline, setBaseline] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Array<{name: string, geometries: number, expected: number, pass: boolean}>>([]);
  
  // Test states
  const [testDirectBlocks, setTestDirectBlocks] = useState(false);
  const [testChunkBlocks, setTestChunkBlocks] = useState(false);
  
  // Set baseline after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseline === null) {
        setBaseline(stats.geometries);
        console.log(`🎯 BASELINE ESTABLISHED: ${stats.geometries} geometries`);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [stats.geometries, baseline]);
  
  const getCurrentDelta = () => baseline !== null ? stats.geometries - baseline : 0;
  
  // Record test results
  const recordTest = (name: string, expected: number) => {
    const actual = getCurrentDelta();
    const pass = actual === expected;
    const result = {name, geometries: actual, expected, pass};
    
    setTestResults(prev => {
      const filtered = prev.filter(r => r.name !== name);
      return [...filtered, result];
    });
    
    console.log(`📋 TEST RESULT: ${name} - Expected: ${expected}, Actual: ${actual} ${pass ? '✅ PASS' : '❌ FAIL'}`);
  };
  
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#87CEEB' }}>
      {/* Results Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.95)',
        color: 'white',
        padding: '25px',
        borderRadius: '10px',
        fontFamily: 'monospace',
        zIndex: 1000,
        minWidth: '500px'
      }}>
        <div style={{ color: '#00FF00', fontWeight: 'bold', marginBottom: '20px', fontSize: '18px' }}>
          🎯 FINAL VERIFICATION TEST
        </div>
        
        {/* Current Stats */}
        <div style={{ marginBottom: '20px', padding: '15px', background: '#111', borderRadius: '8px' }}>
          <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '10px' }}>Current WebGL Stats:</div>
          <div>Geometries: <span style={{color: '#00FF00', fontWeight: 'bold', fontSize: '16px'}}>{stats.geometries}</span></div>
          <div>Baseline: <span style={{color: '#FFA500'}}>{baseline ?? 'Establishing...'}</span></div>
          <div style={{ 
            color: getCurrentDelta() > 0 ? '#00FF00' : '#4CAF50',
            fontWeight: 'bold',
            fontSize: '15px'
          }}>
            Current Delta: +{getCurrentDelta()}
          </div>
          <div style={{fontSize: '12px', color: '#aaa'}}>
            Textures: {stats.textures} | Programs: {stats.programs}
          </div>
        </div>
        
        {/* Test Controls */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#FFA500', fontWeight: 'bold', marginBottom: '12px' }}>
            🧪 Run Tests:
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <button 
              onClick={() => {
                const newState = !testDirectBlocks;
                setTestDirectBlocks(newState);
                if (newState) {
                  setTimeout(() => recordTest('8 Direct Blocks', 8), 1000);
                }
              }}
              style={{ 
                background: testDirectBlocks ? '#4CAF50' : '#333',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              {testDirectBlocks ? '✅' : '⭕'} 8 Direct Blocks
            </button>
            <span style={{color: '#ccc', fontSize: '12px'}}>Expected: +8 geometries</span>
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <button 
              onClick={() => {
                const newState = !testChunkBlocks;
                setTestChunkBlocks(newState);
                if (newState) {
                  setTimeout(() => recordTest('ChunkComponent 8 Blocks', 8), 1000);
                }
              }}
              style={{ 
                background: testChunkBlocks ? '#4CAF50' : '#333',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              {testChunkBlocks ? '✅' : '⭕'} ChunkComponent
            </button>
            <span style={{color: '#ccc', fontSize: '12px'}}>Expected: +8 geometries</span>
          </div>
        </div>
        
        {/* Test Results */}
        {testResults.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#00FF00', fontWeight: 'bold', marginBottom: '10px' }}>
              📊 Test Results:
            </div>
            {testResults.map((result, index) => (
              <div key={index} style={{ 
                marginBottom: '6px',
                color: result.pass ? '#4CAF50' : '#ff6b6b',
                fontSize: '13px'
              }}>
                {result.pass ? '✅' : '❌'} {result.name}: {result.geometries}/{result.expected} geometries
              </div>
            ))}
          </div>
        )}
        
        {/* Summary */}
        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '15px', lineHeight: '1.4' }}>
          <strong style={{color: '#FFA500'}}>Test Goal:</strong> Confirm exact geometry counts<br/>
          <strong style={{color: '#FFA500'}}>Success Criteria:</strong> Each test creates exactly expected geometries<br/>
          <strong style={{color: '#4CAF50'}}>Status:</strong> No infinite re-rendering, stable measurements
        </div>
      </div>
      
      {/* 3D Scene */}
      <Canvas camera={{ position: [15, 15, 15], fov: 75 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
        <PreciseGeometryMonitor onUpdate={setStats} />
        
        {/* Test Components */}
        <Test8DirectBlocks enabled={testDirectBlocks} />
        <Test8ChunkBlocks enabled={testChunkBlocks} />
      </Canvas>
    </div>
  );
};
