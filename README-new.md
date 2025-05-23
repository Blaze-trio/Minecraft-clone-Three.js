# OpenTRIO - Minecraft Clone

A Minecraft-inspired voxel game built with React, TypeScript, and Three.js featuring procedural world generation, block building mechanics, and a pixel art aesthetic.

## Features

- **🌍 Procedural World Generation**: Infinite terrain generated using Simplex noise
- **🎮 First-Person Gameplay**: WASD movement with mouse look controls
- **🔨 Block Interaction**: Break and place blocks with left/right click
- **📦 Block Inventory**: Multiple block types including grass, dirt, stone, wood, and leaves
- **🌳 Natural Generation**: Trees, caves, and varied terrain
- **🎨 Pixel Art Style**: Authentic retro Minecraft-like visuals
- **⚡ Performance Optimized**: Chunk-based rendering with occlusion culling

## Controls

- **Movement**: WASD keys
- **Vertical**: Space (up) / Shift (down)
- **Camera**: Mouse (click to lock cursor)
- **Break Block**: Left click
- **Place Block**: Right click
- **Inventory**: Click inventory button or use hotbar

## Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **3D Graphics**: Three.js + React Three Fiber + Drei
- **Procedural Generation**: Simplex noise for terrain
- **Styling**: CSS modules for UI components

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## Architecture

### Core Components

- `GameWorld`: Main game renderer and state management
- `PlayerController`: Handles movement and physics
- `Block`: Individual block rendering with textures
- `ChunkComponent`: Efficient chunk-based world rendering
- `Inventory`: Block selection and management UI
- `WorldGenerator`: Procedural terrain generation

### Block System

The game includes various block types:
- **Grass**: Surface terrain with grass texture
- **Dirt**: Underground and foundation blocks
- **Stone**: Deep underground base material
- **Wood**: Tree trunks and building material
- **Leaves**: Tree foliage with transparency

### World Generation

- Chunk-based loading (16x16 blocks per chunk)
- Height-based terrain using 2D noise
- Cave generation using 3D noise
- Automatic tree placement
- Dynamic chunk loading based on player position

## Development

The project follows modern React best practices:
- TypeScript for type safety
- Component composition for modularity
- Custom hooks for game logic
- Performance optimizations for 3D rendering

## License

MIT License - See LICENSE file for details.
