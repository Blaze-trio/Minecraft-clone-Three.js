import { useState, useEffect } from 'react';
import { GameErrorBoundary } from './components/GameHelpers';
import SimpleMinecraftGame from './components/SimpleMinecraftGame';
import { HighPerformanceWorld } from './components/HighPerformanceWorld';
import { setupEmergencyMemoryHandlers } from './utils/webglUtils';
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

    // Add event handlers for WebGL context loss at the app level
    const handleContextLost = () => {
      console.error('App level: WebGL context was lost!');
      // Don't immediately fall back - the context manager will try to recover
    };
    
    const handleContextRestored = () => {
      console.log('App level: WebGL context was restored successfully!');
    };
    
    // Find any canvas elements and add listeners
    const setupContextLossHandlers = () => {
      const canvasElements = document.querySelectorAll('canvas');
      canvasElements.forEach(canvas => {
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
      });
    };
    
    // Call once and set up a mutation observer to watch for new canvases
    setupContextLossHandlers();
    
    // Set up observer to watch for new canvas elements
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'CANVAS') {
              setupContextLossHandlers();
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Clean up
    return () => {
      const canvasElements = document.querySelectorAll('canvas');
      canvasElements.forEach(canvas => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      });
      observer.disconnect();
    };
  }, [force2D]);

  // Test 3D support separately
  useEffect(() => {
    if (force2D) return;
    
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
      // Longer initialization time to give WebGL more time to stabilize
      const fallbackTimer = setTimeout(() => {
        console.log('3D mode taking too long, falling back to 2D');
        setUse3D(false);
      }, 45000); // 45 second timeout - much more time for initialization
      
      // Setup multiple recovery attempts with progressive backoff
      let recoveryAttempts = 0;
      const maxRecoveryAttempts = 3; // More recovery attempts
      const recoveryInProgress = { current: false };
      const lastRecoveryTime = { timestamp: 0 };
      const RECOVERY_COOLDOWN = 10000; // 10 seconds between recovery attempts
      
      // WebGL error counter to track error frequency
      const errorCounts = {
        webgl: 0,
        context: 0,
        memory: 0,
        other: 0
      };
      
      // Add window-level error handler for WebGL context errors
      const handleGlobalError = (event: ErrorEvent) => {
        // Track error types
        if (event.message.includes('WebGL')) errorCounts.webgl++;
        if (event.message.includes('context')) errorCounts.context++;
        if (event.message.includes('memory')) errorCounts.memory++;
        if (!event.message.includes('WebGL') && !event.message.includes('context') && !event.message.includes('memory')) {
          errorCounts.other++;
        }
        
        // Only react to WebGL-related errors
        if (event.message.includes('WebGL') || 
            event.message.includes('context') || 
            event.message.includes('three.js') ||
            event.message.includes('memory')) {
          
          console.warn('Global WebGL error detected:', event.message);
          
          // Prevent multiple rapid recovery attempts
          const now = Date.now();
          if (recoveryInProgress.current || (now - lastRecoveryTime.timestamp < RECOVERY_COOLDOWN)) {
            console.log('Recovery already in progress or in cooldown, skipping');
            return;
          }
          
          if (recoveryAttempts < maxRecoveryAttempts) {
            recoveryAttempts++;
            recoveryInProgress.current = true;
            lastRecoveryTime.timestamp = now;
            
            console.log(`Attempting WebGL recovery (${recoveryAttempts}/${maxRecoveryAttempts})...`);
            
            // Progressive delay for recovery attempts
            const recoveryDelay = recoveryAttempts * 2000; // Increase delay with each attempt
            setTimeout(() => {
              recoveryInProgress.current = false;
              
              // Check if errors are still occurring
              if (errorCounts.webgl + errorCounts.context > 5) {
                console.warn('Still seeing WebGL errors after recovery attempt');
              } else {
                console.log('Recovery appears successful, error count reduced');
              }
              
              // Reset error counts for next cycle
              Object.keys(errorCounts).forEach(key => {
                errorCounts[key as keyof typeof errorCounts] = 0;
              });
              
            }, recoveryDelay);
          } else {
            // Only fall back if we have frequent critical errors
            if (errorCounts.webgl + errorCounts.context > 10) {
              console.error('WebGL recovery attempts exhausted with continuing errors, falling back to 2D mode');
              setUse3D(false);
            } else {
              console.warn('WebGL recovery attempts exhausted, but errors are infrequent. Continuing in 3D mode with degraded stability.');
            }
          }
        }
      };
      
      window.addEventListener('error', handleGlobalError);
      
      return () => {
        clearTimeout(fallbackTimer);
        window.removeEventListener('error', handleGlobalError);
      };
    }
  }, [use3D, force2D]);

  // Set up emergency memory handlers for the entire application
  useEffect(() => {
    // Initialize emergency handlers for memory issues
    setupEmergencyMemoryHandlers();
    console.log('Emergency WebGL memory handlers initialized');
    
    return () => {
      // Nothing to clean up for memory handlers
    };
  }, []);

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

  // Try to load high-performance 3D version
  console.log('Attempting to render high-performance 3D mode');
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
        <HighPerformanceWorld />
      </GameErrorBoundary>
    </div>
  );
}

export default App;
