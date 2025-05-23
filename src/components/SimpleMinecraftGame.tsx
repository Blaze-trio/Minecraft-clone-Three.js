import React, { useRef, useEffect, useState } from 'react';

// Simple 2D Minecraft-style game as fallback
const SimpleMinecraftGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGameActive, setIsGameActive] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 250, y: 250 });
  const [blocks, setBlocks] = useState<Array<{x: number, y: number, type: string}>>([]);

  // Initialize the game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Generate initial world
    const initialBlocks = [];
    for (let x = 0; x < 40; x++) {
      for (let y = 25; y < 30; y++) {
        const blockType = y === 25 ? 'grass' : y < 28 ? 'dirt' : 'stone';
        initialBlocks.push({ x: x * 20, y: y * 20, type: blockType });
      }
    }
    setBlocks(initialBlocks);
    setIsGameActive(true);
  }, []);

  // Game loop
  useEffect(() => {
    if (!isGameActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const gameLoop = () => {
      // Clear canvas
      ctx.fillStyle = '#87CEEB'; // Sky blue
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw blocks
      blocks.forEach(block => {
        switch (block.type) {
          case 'grass':
            ctx.fillStyle = '#90EE90';
            break;
          case 'dirt':
            ctx.fillStyle = '#8B4513';
            break;
          case 'stone':
            ctx.fillStyle = '#808080';
            break;
          default:
            ctx.fillStyle = '#90EE90';
        }
        ctx.fillRect(block.x, block.y, 20, 20);
        
        // Block outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(block.x, block.y, 20, 20);
      });

      // Draw player
      ctx.fillStyle = '#0066CC';
      ctx.fillRect(playerPos.x, playerPos.y, 20, 40);
      
      // Player outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(playerPos.x, playerPos.y, 20, 40);

      requestAnimationFrame(gameLoop);
    };

    gameLoop();
  }, [isGameActive, blocks, playerPos]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const speed = 20;
      switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          setPlayerPos(prev => ({ ...prev, x: Math.max(0, prev.x - speed) }));
          break;
        case 'd':
        case 'arrowright':
          setPlayerPos(prev => ({ ...prev, x: Math.min(760, prev.x + speed) }));
          break;
        case 'w':
        case 'arrowup':
          setPlayerPos(prev => ({ ...prev, y: Math.max(0, prev.y - speed) }));
          break;
        case 's':
        case 'arrowdown':
          setPlayerPos(prev => ({ ...prev, y: Math.min(560, prev.y + speed) }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Handle mouse clicks for block placing/breaking
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 20) * 20;
    const y = Math.floor((e.clientY - rect.top) / 20) * 20;

    if (e.button === 0) { // Left click - remove block
      setBlocks(prev => prev.filter(block => !(block.x === x && block.y === y)));
    } else if (e.button === 2) { // Right click - add block
      e.preventDefault();
      setBlocks(prev => {
        const existing = prev.find(block => block.x === x && block.y === y);
        if (!existing) {
          return [...prev, { x, y, type: 'grass' }];
        }
        return prev;
      });
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#333',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        marginBottom: '20px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h1>🎮 2D Minecraft Clone (Fallback Mode)</h1>
        <p>Use WASD or Arrow Keys to move • Left Click: Break Block • Right Click: Place Block</p>
        <p>Player Position: ({Math.floor(playerPos.x/20)}, {Math.floor(playerPos.y/20)})</p>
      </div>
      
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          border: '2px solid #fff',
          backgroundColor: '#87CEEB',
          cursor: 'crosshair'
        }}
      />
      
      <div style={{
        marginTop: '20px',
        color: 'white',
        textAlign: 'center'
      }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          🔄 Restart Game
        </button>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🎮 Try 3D Mode
        </button>
      </div>
    </div>
  );
};

export default SimpleMinecraftGame;
