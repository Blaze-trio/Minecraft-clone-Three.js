import React, { useState, useEffect } from 'react';
import { ImprovedWorldGenerator } from '../utils/cleanGenerator';

export const CleanGeneratorTest: React.FC = () => {
  const [status, setStatus] = useState('Initializing...');
  
  useEffect(() => {
    try {
      console.log('Creating clean generator...');
      const generator = new ImprovedWorldGenerator();
      const chunk = generator.generateChunk(0, 0);
      setStatus(`Success! Generated chunk with ${chunk.blocks.length} blocks.`);
    } catch (err) {
      console.error('Error in clean generator:', err);
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);
  
  return (
    <div style={{
      padding: '15px',
      backgroundColor: '#333',
      color: 'white',
      borderRadius: '5px',
      marginTop: '10px'
    }}>
      <h3>Clean Generator Test</h3>
      <p>{status}</p>
    </div>
  );
};
