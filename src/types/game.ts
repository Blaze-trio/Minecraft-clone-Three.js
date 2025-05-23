import * as THREE from 'three';

// Types for the Minecraft clone game
export interface BlockType {
  id: number;
  name: string;
  textureTop: string;
  textureSide: string;
  textureBottom: string;
  hardness: number;
  transparent: boolean;
}

export interface Block {
  type: number;
  x: number;
  y: number;
  z: number;
}

export interface Chunk {
  x: number;
  z: number;
  blocks: Block[];
  mesh?: THREE.InstancedMesh;
  isReady?: boolean; // Flag to indicate if chunk is ready to render
  needsUpdate?: boolean; // Flag to indicate if chunk needs geometry update
  lodLevel?: number; // Level of detail (0 = highest detail)
}

export interface Player {
  position: [number, number, number];
  rotation: [number, number];
  velocity: [number, number, number];
  onGround: boolean;
  selectedBlock: number;
}

export interface GameState {
  world: Map<string, Chunk>;
  player: Player;
  inventory: number[];
  gameMode: 'survival' | 'creative';
  renderDistance: number;
}

export const BLOCK_TYPES: BlockType[] = [
  {
    id: 0,
    name: 'Air',
    textureTop: '',
    textureSide: '',
    textureBottom: '',
    hardness: 0,
    transparent: true,
  },  {
    id: 1,
    name: 'Grass',
    textureTop: '/textures/grass_top.svg',
    textureSide: '/textures/grass_side.svg',
    textureBottom: '/textures/dirt.svg',
    hardness: 1,
    transparent: false,
  },
  {
    id: 2,
    name: 'Dirt',
    textureTop: '/textures/dirt.svg',
    textureSide: '/textures/dirt.svg',
    textureBottom: '/textures/dirt.svg',
    hardness: 1,
    transparent: false,
  },
  {
    id: 3,
    name: 'Stone',
    textureTop: '/textures/stone.svg',
    textureSide: '/textures/stone.svg',
    textureBottom: '/textures/stone.svg',
    hardness: 3,
    transparent: false,
  },
  {
    id: 4,
    name: 'Wood',
    textureTop: '/textures/log_top.svg',
    textureSide: '/textures/log_side.svg',
    textureBottom: '/textures/log_top.svg',
    hardness: 2,
    transparent: false,
  },
  {
    id: 5,
    name: 'Leaves',
    textureTop: '/textures/leaves.svg',
    textureSide: '/textures/leaves.svg',
    textureBottom: '/textures/leaves.svg',
    hardness: 0.5,
    transparent: true,
  },
];

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const RENDER_DISTANCE = 4; // Reduced from 8 to 4 for better performance
export const MAX_RENDER_DISTANCE = 8; // Maximum render distance for high-end devices
