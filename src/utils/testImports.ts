// Simple test file to check imports
import type { Chunk, Block } from '../types/game.js';
import { ImprovedWorldGenerator } from './improvedWorldGenerator.js';

console.log('Test imports file loaded');

// Try to create an instance
try {
  const generator = new ImprovedWorldGenerator();
  console.log('Successfully created ImprovedWorldGenerator instance');
} catch (error) {
  console.error('Error creating ImprovedWorldGenerator:', error);
}

export function testFunction() {
  console.log('Test function called');
  return true;
}
