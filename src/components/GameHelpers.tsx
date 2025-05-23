import React from 'react';

// Loading component for when 3D dependencies are loading
const LoadingScreen: React.FC = () => (
  <div style={{
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#87CEEB',
    fontFamily: 'Arial, sans-serif',
    color: '#333'
  }}>
    <div style={{
      fontSize: '24px',
      marginBottom: '20px',
      fontWeight: 'bold'
    }}>
      🎮 Loading Minecraft Clone...
    </div>
    <div style={{
      fontSize: '16px',
      marginBottom: '30px',
      opacity: 0.8
    }}>
      Initializing 3D world and dependencies
    </div>
    <div style={{
      width: '200px',
      height: '4px',
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: '2px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, #4CAF50, #45a049)',
        animation: 'loading 2s ease-in-out infinite',
        borderRadius: '2px'
      }} />
    </div>
    <style>{`
      @keyframes loading {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(0%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
);

// Error boundary for 3D components
class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('3D Game Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ff6b6b',
          fontFamily: 'Arial, sans-serif',
          color: 'white',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1>🚨 3D Mode Error</h1>
          <p style={{ marginBottom: '20px', maxWidth: '600px' }}>
            The 3D version failed to load. This could be due to:
          </p>
          <ul style={{ textAlign: 'left', marginBottom: '30px' }}>
            <li>Browser compatibility issues with WebGL or ES modules</li>
            <li>MIME type errors blocking module loading</li>
            <li>Missing dependencies or build issues</li>
            <li>Graphics driver or hardware limitations</li>
          </ul>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.href = '/?mode=2d'}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🎮 Try 2D Mode
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#fff',
                color: '#ff6b6b',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔄 Reload 3D
            </button>
            <button
              onClick={() => window.location.href = '/test.html'}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔍 Debug Mode
            </button>
          </div>
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer' }}>Show Error Details</summary>
            <pre style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '10px', 
              borderRadius: '5px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px',
              marginTop: '10px'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export { LoadingScreen, GameErrorBoundary };
