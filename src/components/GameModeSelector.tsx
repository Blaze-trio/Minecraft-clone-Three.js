import React, { useState } from 'react';
import { GameErrorBoundary } from './GameHelpers';
import { HighPerformanceWorld } from './HighPerformanceWorld';
import { SimpleTestWorld } from './SimpleTestWorld';
import StableMinecraftWorld from './StableMinecraftWorld';

type GameMode = 'menu' | 'stable' | 'highPerformance' | 'enhanced' | 'basic';

const GameModeSelector: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<GameMode>('menu');

  const renderGameMode = () => {
    switch (currentMode) {
      case 'stable':
        return (
          <GameErrorBoundary>
            <StableMinecraftWorld />
          </GameErrorBoundary>
        );
      case 'highPerformance':
        return (
          <GameErrorBoundary>
            <HighPerformanceWorld />
          </GameErrorBoundary>
        );
      case 'enhanced':
        return (
          <GameErrorBoundary>
            <StableMinecraftWorld />
          </GameErrorBoundary>
        );
      case 'basic':
        return (
          <GameErrorBoundary>
            <SimpleTestWorld />
          </GameErrorBoundary>
        );
      case 'menu':
      default:
        return renderMenu();
    }
  };

  const renderMenu = () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #87CEEB 0%, #6B9FE8 50%, #4682B4 100%)',
      fontFamily: 'Arial, sans-serif',
      color: 'white'
    }}>
      <div style={{
        textAlign: 'center',
        background: 'rgba(0,0,0,0.3)',
        padding: '40px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        maxWidth: '800px'
      }}>
        <h1 style={{ fontSize: '3em', marginBottom: '20px', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          🎮 Minecraft Clone
        </h1>
        <p style={{ fontSize: '1.2em', marginBottom: '40px', opacity: 0.9 }}>
          Choose your gaming experience
        </p>        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Stable World - NEW RECOMMENDED */}
          <button
            onClick={() => setCurrentMode('stable')}
            style={{
              padding: '20px',
              background: 'linear-gradient(145deg, #00C853, #00A843)',
              border: 'none',
              borderRadius: '15px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
            }}
          >
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>🌍</div>
            <div style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              Stable World
            </div>
            <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
              Realistic terrain & collision<br/>
              Stable chunk loading<br/>
              ⭐ NEW & RECOMMENDED
            </div>
          </button>          {/* High Performance Testing */}
          <button
            onClick={() => setCurrentMode('highPerformance')}
            style={{
              padding: '20px',
              background: 'linear-gradient(145deg, #FF9800, #F57C00)',
              border: 'none',
              borderRadius: '15px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
            }}
          >
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>🔬</div>
            <div style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              Performance Test
            </div>
            <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
              Progressive rendering test<br/>
              Memory optimization<br/>
              🧪 Experimental
            </div>
          </button>

          {/* Enhanced World */}
          <button
            onClick={() => setCurrentMode('enhanced')}
            style={{
              padding: '20px',
              background: 'linear-gradient(145deg, #2196F3, #1976D2)',
              border: 'none',
              borderRadius: '15px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
            }}
          >
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>⚡</div>            <div style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              Enhanced World
            </div>            <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
              Stable chunk generation<br/>
              Realistic terrain & physics<br/>
              🎯 Reliable & Smooth
            </div>
          </button>

          {/* Basic 3D World */}
          <button
            onClick={() => setCurrentMode('basic')}
            style={{
              padding: '20px',
              background: 'linear-gradient(145deg, #9C27B0, #7B1FA2)',
              border: 'none',
              borderRadius: '15px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
            }}
          >
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>🎮</div>
            <div style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              Basic 3D World
            </div>
            <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
              Simple 3D world<br/>
              Direct implementation<br/>
              🏗️ Foundation
            </div>
          </button>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '10px',
          fontSize: '0.9em'
        }}>          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>🎯 Quick Start Guide:</div>
          <div>• <strong>New to the game?</strong> Try "Stable World" for the best experience</div>
          <div>• <strong>Performance testing?</strong> Use "Performance Test" for debugging</div>
          <div>• <strong>Feature exploration?</strong> "Enhanced World" has stable chunk generation</div>
          <div>• <strong>Development?</strong> "Basic 3D World" for minimal implementation</div>
        </div>

        <div style={{ 
          marginTop: '20px',
          display: 'flex', 
          gap: '15px', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => window.location.href = '/?mode=2d'}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🎯 2D Fallback Mode
          </button>
          <button
            onClick={() => window.location.href = '/test.html'}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔍 Debug Test
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {currentMode !== 'menu' && (
        <button
          onClick={() => setCurrentMode('menu')}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '10px 15px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 1000,
            fontFamily: 'monospace'
          }}
        >
          🏠 Menu
        </button>
      )}
      <GameErrorBoundary>
        {renderGameMode()}
      </GameErrorBoundary>
    </div>
  );
};

export default GameModeSelector;
