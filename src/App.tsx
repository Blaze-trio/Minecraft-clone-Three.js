import { useState, useEffect } from 'react';
import { GameErrorBoundary } from './components/GameHelpers';
import SimpleMinecraftGame from './components/SimpleMinecraftGame';
import GameWorld3D from './components/GameWorld3D';
import './App.css';

function App() {
  // Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const force2D = urlParams.get('mode') === '2d';
  const force3D = urlParams.get('mode') === '3d';
  
  console.log('App starting - URL params:', urlParams.toString());
  console.log('Force 2D mode:', force2D, 'Force 3D mode:', force3D);
  
  // Default to 3D mode unless explicitly forced to 2D
  const [use3D, setUse3D] = useState(!force2D);
  const [loadingFailed, setLoadingFailed] = useState(false);

  // Test if 3D modules can be loaded
  useEffect(() => {
    console.log('useEffect running - use3D:', use3D, 'force2D:', force2D);
    
    if (force2D) {
      console.log('2D mode forced by URL parameter');
      setUse3D(false);
      return;
    }

    const test3DSupport = async () => {
      try {
        console.log('Testing 3D support...');
        
        // Test WebGL support
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          console.warn('WebGL not supported, falling back to 2D mode');
          setUse3D(false);
          return;
        }
        
        console.log('WebGL supported, testing module loading...');

        // Try to pre-load critical modules with timeout
        const modulePromise = Promise.all([
          import('three'),
          import('@react-three/fiber'),
          import('@react-three/drei')
        ]);

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Module loading timeout')), 10000)
        );

        await Promise.race([modulePromise, timeoutPromise]);
        
        console.log('3D modules loaded successfully');
      } catch (error) {
        console.error('3D module loading failed:', error);
        setLoadingFailed(true);
        setUse3D(false);
      }
    };

    if (use3D) {
      test3DSupport();
    }
  }, [use3D, force2D]);

  // Add a timeout to automatically fallback to 2D if 3D takes too long
  useEffect(() => {
    if (use3D && !force2D) {
      const fallbackTimer = setTimeout(() => {
        console.log('3D mode taking too long, falling back to 2D');
        setUse3D(false);
      }, 15000); // 15 second timeout
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [use3D, force2D]);

  console.log('Rendering - use3D:', use3D, 'loadingFailed:', loadingFailed);

  // If 3D failed to load, show 2D fallback
  if (!use3D || loadingFailed) {
    console.log('Rendering 2D fallback mode');
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0, 
        overflow: 'hidden'
      }}>
        <SimpleMinecraftGame />
      </div>
    );
  }

  // Try to load 3D version
  console.log('Attempting to render 3D mode');
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden',
      background: '#87CEEB'
    }}>
      <GameErrorBoundary>
        <GameWorld3D />
      </GameErrorBoundary>
    </div>
  );
}

export default App;
