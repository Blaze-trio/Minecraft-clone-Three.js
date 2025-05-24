// A simplified component to test if imports are working correctly
import React, { useState, useEffect } from 'react';
// Import without extension to avoid potential issues
import { SimplifiedGenerator } from '../utils/simplifiedGenerator';

export const TestGeneratorComponent: React.FC = () => {
  const [testMessage, setTestMessage] = useState('Initializing...');
  
  useEffect(() => {
    try {
      console.log('TestGeneratorComponent mounted');
      const generator = new SimplifiedGenerator();
      const chunk = generator.generateChunk(0, 0);
      setTestMessage(`Success! Generated a chunk with ${chunk.blocks.length} blocks.`);
    } catch (error) {
      console.error('Error in TestGeneratorComponent:', error);
      setTestMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#2c2c2c', color: 'white', margin: '10px' }}>
      <h2>Test Generator Component</h2>
      <p>{testMessage}</p>
    </div>
  );
};
