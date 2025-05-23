# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a Minecraft clone game built with React, TypeScript, and Three.js. The project includes:

- 3D voxel-based world rendering using Three.js and React Three Fiber
- Procedural world generation with chunk-based loading
- Block breaking and placing mechanics
- Player movement and physics
- Pixel art style textures and shaders
- Inventory system for different block types

## Technical Stack
- **Frontend**: React 18 + TypeScript + Vite
- **3D Graphics**: Three.js + React Three Fiber + Drei
- **Procedural Generation**: Simplex noise for terrain
- **Styling**: CSS modules for UI components

## Code Style Guidelines
- Use TypeScript for all components and utilities
- Implement proper 3D performance optimizations (instancing, culling)
- Follow React best practices with hooks and component composition
- Use consistent naming for game entities (Player, Block, Chunk, World)
- Implement proper error boundaries for 3D rendering
