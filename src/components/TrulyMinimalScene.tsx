import React, { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';

// Absolutely minimal debug component - just tracks geometry count
const GeometryTracker: React.FC = () => {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const hasLogged = useRef(false);

  useFrame(() => {
    frameCount.current++;
    
    if (!gl || !gl.info) return;
    
    const info = gl.info;
    const memory = info.memory || {};
    const geometries = memory.geometries || 0;
    const textures = memory.textures || 0;
    const calls = info.render?.calls || 0;
    
    // Log only once after the scene has had time to stabilize
    if (frameCount.current === 180 && !hasLogged.current) { // 3 seconds at 60fps
      console.log('🔬 TRULY MINIMAL SCENE ANALYSIS:');
      console.log(`📊 Geometries: ${geometries}`);
      console.log(`🖼️ Textures: ${textures}`);
      console.log(`📞 Render calls: ${calls}`);
      console.log('🎯 Expected: 0 geometries, 0 textures, minimal calls');
      console.log('💡 This scene contains ONLY lighting - no meshes, no models, no PlayerController');
      
      if (geometries > 0) {
        console.error(`❌ GEOMETRY LEAK: Found ${geometries} geometries in empty scene!`);
        console.error('🔍 This indicates React Three Fiber is creating hidden geometries');
      } else {
        console.log(`✅ SUCCESS: Truly empty scene with ${geometries} geometries`);
      }
      
      hasLogged.current = true;
    }
  });

  return null;
};

// Completely empty scene with just lighting
export const TrulyMinimalScene: React.FC = () => {
  useEffect(() => {
    console.log('🚀 Starting TRULY MINIMAL SCENE test');
    console.log('📋 Components: ONLY basic lighting');
    console.log('🚫 NO PlayerController, NO meshes, NO materials, NO geometries');
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#001' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        {/* Only basic lighting - no shadows, no complex features */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={0.8} 
          castShadow={false}
        />
        
        {/* Geometry tracker */}
        <GeometryTracker />
      </Canvas>
      
      {/* Status overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <div style={{ color: '#ff6b6b', fontWeight: 'bold' }}>🔬 TRULY MINIMAL SCENE</div>
        <div style={{ marginTop: '10px' }}>
          <div>📊 Expected geometries: 0</div>
          <div>🎯 Components: ONLY lighting</div>          <div>⏱️ Test duration: 3 seconds</div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#ccc' }}>
          If geometries {'>'} 0, React Three Fiber has hidden leaks
        </div>
      </div>
    </div>
  );
};

export default TrulyMinimalScene;
