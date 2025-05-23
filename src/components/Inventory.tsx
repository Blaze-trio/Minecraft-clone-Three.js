import React, { useState } from 'react';
import { BLOCK_TYPES } from '../types/game';

interface InventoryProps {
  selectedBlock: number;
  onBlockSelect: (blockId: number) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ selectedBlock, onBlockSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const availableBlocks = BLOCK_TYPES.filter(block => block.id > 0); // Exclude air

  return (
    <>
      {/* Hotbar */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '5px',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '10px'
      }}>
        {availableBlocks.slice(0, 9).map((block) => (
          <div
            key={block.id}
            onClick={() => onBlockSelect(block.id)}
            style={{
              width: '50px',
              height: '50px',
              background: selectedBlock === block.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              border: selectedBlock === block.id ? '2px solid white' : '2px solid transparent',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              textAlign: 'center'
            }}
          >
            {block.name}
          </div>
        ))}
      </div>

      {/* Inventory toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        {isOpen ? 'Close' : 'Inventory'}
      </button>

      {/* Full inventory */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.9)',
          padding: '20px',
          borderRadius: '10px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          minWidth: '300px'
        }}>
          {availableBlocks.map(block => (
            <div
              key={block.id}
              onClick={() => {
                onBlockSelect(block.id);
                setIsOpen(false);
              }}
              style={{
                width: '80px',
                height: '80px',
                background: selectedBlock === block.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                border: selectedBlock === block.id ? '2px solid white' : '2px solid transparent',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                textAlign: 'center'
              }}
            >
              <div>{block.name}</div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>
                Hardness: {block.hardness}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
