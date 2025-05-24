import React, { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';

// Internal component that runs inside the Canvas and has access to Three.js renderer
const GeometryTester: React.FC<{ setResults: (results: string) => void }> = ({ setResults }) => {
  const { gl } = useThree();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (gl && gl.info) {
          const geometries = gl.info.memory?.geometries || 0;
          const textures = gl.info.memory?.textures || 0;
          
          console.log('🧪 ABSOLUTE MINIMAL SCENE RESULTS:');
          console.log('📊 Geometries:', geometries);
          console.log('🖼️ Textures:', textures);
          console.log('🎯 Expected: 0 geometries (no meshes created)');
            if (geometries === 0) {
            console.log('✅ SUCCESS: React Three Fiber baseline is clean!');
            setResults(`✅ SUCCESS: ${geometries} geometries (React Three Fiber baseline is CLEAN!)`);
          } else {
            console.log('❌ ISSUE: React Three Fiber creates', geometries, 'hidden geometries');
            setResults(`❌ ISSUE: ${geometries} hidden geometries found - React Three Fiber has baseline overhead`);
          }
        } else {
          setResults('❌ Failed to access renderer info');
        }
      } catch (error) {
        console.error('Error during geometry test:', error);
        setResults('❌ Error during test');
      }
    }, 2000); // Check after 2 seconds
    
    return () => clearTimeout(timer);
  }, [gl, setResults]);

  // This component renders nothing - it just tests
  return null;
};

// ABSOLUTELY MINIMAL SCENE
// NO monitoring, NO hooks, NO geometry tracking
// Just canvas + basic lights to test React Three Fiber baseline
export const AbsoluteMinimalScene: React.FC = () => {
  const [testResults, setTestResults] = useState<string>('⏳ Testing...');

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative',
      background: '#87CEEB' 
    }}>
      {/* Static info display */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '14px',
        zIndex: 1000
      }}>
        <div style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: '10px' }}>
          🧪 ABSOLUTE MINIMAL SCENE TEST
        </div>        <div>🎯 Components: Canvas + ambientLight + directionalLight ONLY</div>
        <div>📊 Expected geometries: 0 (no meshes)</div>        <div style={{ 
          color: testResults.includes('SUCCESS') ? '#4CAF50' : testResults.includes('ISSUE') ? '#ff6b6b' : '#4ecdc4', 
          fontWeight: 'bold',
          fontSize: '16px',
          marginTop: '10px',
          padding: '10px',
          backgroundColor: testResults.includes('SUCCESS') ? 'rgba(76, 175, 80, 0.2)' : testResults.includes('ISSUE') ? 'rgba(255, 107, 107, 0.2)' : 'rgba(78, 205, 196, 0.2)',
          borderRadius: '5px',
          border: `2px solid ${testResults.includes('SUCCESS') ? '#4CAF50' : testResults.includes('ISSUE') ? '#ff6b6b' : '#4ecdc4'}`
        }}>
          {testResults}
        </div>        <div style={{ marginTop: '10px', fontSize: '12px', color: '#ccc' }}>
          Test automatically runs after 2 seconds. Results shown above.
        </div>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#4ecdc4',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        >
          🔄 Re-run Test
        </button>
      </div>      {/* Canvas with ONLY lighting - no meshes, no hooks */}
      <Canvas camera={{ position: [0, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <GeometryTester setResults={setTestResults} />
      </Canvas>
    </div>
  );
};
