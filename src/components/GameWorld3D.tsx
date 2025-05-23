// A direct import version of the 3D game world to avoid lazy loading issues
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Sky, PointerLockControls } from '@react-three/drei';
import { Raycaster, Vector3, Vector2 } from 'three';
import { WorldGenerator } from '../utils/worldGenerator';
import { ChunkComponent } from './Block';
import { PlayerController } from './PlayerController';
import { Inventory } from './Inventory';
import type { Chunk, Block } from '../types/game';
import { RENDER_DISTANCE, CHUNK_SIZE } from '../types/game';

const BlockInteraction: React.FC<{
  onBlockBreak: (x: number, y: number, z: number) => void;
  onBlockPlace: (x: number, y: number, z: number, blockType: number) => void;
  selectedBlock: number;
}> = ({ onBlockBreak, onBlockPlace, selectedBlock }) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new Raycaster());

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (document.pointerLockElement) {
        raycaster.current.setFromCamera(new Vector2(0, 0), camera);
        const intersects = raycaster.current.intersectObjects(scene.children, true);
        
        if (intersects.length > 0) {
          const intersection = intersects[0];
          const point = intersection.point;
          const normal = intersection.face?.normal;
          
          if (normal) {
            if (event.button === 0) { // Left click - break block
              const blockPos = new Vector3(
                Math.floor(point.x),
                Math.floor(point.y),
                Math.floor(point.z)
              );
              onBlockBreak(blockPos.x, blockPos.y, blockPos.z);
            } else if (event.button === 2) { // Right click - place block
              const placePos = new Vector3(
                Math.floor(point.x + normal.x * 0.5),
                Math.floor(point.y + normal.y * 0.5),
                Math.floor(point.z + normal.z * 0.5)
              );
              onBlockPlace(placePos.x, placePos.y, placePos.z, selectedBlock);
            }
          }
        }
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault(); // Prevent context menu on right click
    };

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [camera, scene, onBlockBreak, onBlockPlace, selectedBlock]);

  return null;
};

export const GameWorld3D: React.FC = () => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 50, 0]);
  const [selectedBlock, setSelectedBlock] = useState(1); // Start with grass
  const [chunks, setChunks] = useState(() => new Map<string, Chunk>());
  const worldGenerator = useMemo(() => new WorldGenerator(), []);

  React.useEffect(() => {
    console.log('GameWorld3D component mounted successfully!');
  }, []);

  const handleBlockBreak = useCallback((x: number, y: number, z: number) => {
    console.log('Breaking block at:', x, y, z);
    setChunks(prevChunks => {
      const newChunks = new Map(prevChunks);
      const chunkX = Math.floor(x / CHUNK_SIZE);
      const chunkZ = Math.floor(z / CHUNK_SIZE);
      const chunkKey = worldGenerator.getChunkKey(chunkX, chunkZ);
      
      const chunk = newChunks.get(chunkKey);
      if (chunk) {
        const newBlocks = chunk.blocks.filter(block => 
          !(block.x === x && block.y === y && block.z === z)
        );
        newChunks.set(chunkKey, { ...chunk, blocks: newBlocks });
      }
      
      return newChunks;
    });
  }, [worldGenerator]);

  const handleBlockPlace = useCallback((x: number, y: number, z: number, blockType: number) => {
    console.log('Placing block at:', x, y, z, 'type:', blockType);
    setChunks(prevChunks => {
      const newChunks = new Map(prevChunks);
      const chunkX = Math.floor(x / CHUNK_SIZE);
      const chunkZ = Math.floor(z / CHUNK_SIZE);
      const chunkKey = worldGenerator.getChunkKey(chunkX, chunkZ);
      
      const chunk = newChunks.get(chunkKey);
      if (chunk) {
        // Check if there's already a block at this position
        const existingBlock = chunk.blocks.find(block => 
          block.x === x && block.y === y && block.z === z
        );
        
        if (!existingBlock) {
          const newBlock: Block = { type: blockType, x, y, z };
          const newBlocks = [...chunk.blocks, newBlock];
          newChunks.set(chunkKey, { ...chunk, blocks: newBlocks });
        }
      }
      
      return newChunks;
    });
  }, [worldGenerator]);

  const visibleChunks = useMemo(() => {
    const result: Chunk[] = [];
    const playerChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);

    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const chunkX = playerChunkX + dx;
        const chunkZ = playerChunkZ + dz;
        const key = worldGenerator.getChunkKey(chunkX, chunkZ);

        if (!chunks.has(key)) {
          const chunk = worldGenerator.generateChunk(chunkX, chunkZ);
          setChunks(prev => new Map(prev).set(key, chunk));
        }

        const chunk = chunks.get(key);
        if (chunk) {
          result.push(chunk);
        }
      }
    }

    return result;
  }, [playerPosition, chunks, worldGenerator]);

  const handlePlayerMove = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position);
  }, []);

  console.log('Rendering GameWorld3D, chunks:', visibleChunks.length);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        onCreated={(state) => {
          console.log('Canvas created successfully');
          state.camera.position.set(...playerPosition);
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />

        {/* Sky */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* Player Controller */}
        <PlayerController
          position={playerPosition}
          onPositionChange={handlePlayerMove}
        />

        {/* Block Interaction */}
        <BlockInteraction
          onBlockBreak={handleBlockBreak}
          onBlockPlace={handleBlockPlace}
          selectedBlock={selectedBlock}
        />        {/* World chunks */}
        {visibleChunks.map((chunk) => {
          const chunkKey = worldGenerator.getChunkKey(chunk.x, chunk.z);
          return (
            <ChunkComponent
              key={chunkKey}
              chunkKey={chunkKey}
              blocks={chunk.blocks}
            />
          );
        })}

        {/* Camera controls */}
        <PointerLockControls />
      </Canvas>

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <div>🎮 Minecraft Clone 3D</div>
        <div>Position: {playerPosition.map(p => p.toFixed(1)).join(', ')}</div>
        <div>Chunks loaded: {visibleChunks.length}</div>
        <div>Selected: {selectedBlock}</div>
        <div>Controls:</div>
        <div>• WASD: Move, Space/Shift: Up/Down</div>
        <div>• Left Click: Break block</div>
        <div>• Right Click: Place block</div>
        <div>• Click to lock mouse cursor</div>
      </div>

      {/* Crosshair */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '20px',
        height: '20px',
        pointerEvents: 'none'
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '2px',
          height: '12px',
          background: 'white',
          borderRadius: '1px'
        }}/>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '12px',
          height: '2px',
          background: 'white',
          borderRadius: '1px'
        }}/>
      </div>      {/* Inventory */}
      <Inventory
        selectedBlock={selectedBlock}
        onBlockSelect={setSelectedBlock}
      />
    </div>
  );
};

export default GameWorld3D;
