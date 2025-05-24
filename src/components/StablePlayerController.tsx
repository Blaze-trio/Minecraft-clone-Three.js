// Enhanced Player Controller with Realistic Physics and Block Collision
import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { stableWorldGenerator } from '../utils/stableWorldGenerator';
import * as THREE from 'three';

interface StablePlayerControllerProps {
  position: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
}

export const StablePlayerController: React.FC<StablePlayerControllerProps> = ({
  position,
  onPositionChange
}) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const isGrounded = useRef(false);
  const keys = useRef({
    w: false, a: false, s: false, d: false,
    space: false, shift: false
  });

  // Player physics constants
  const MOVE_SPEED = 8;
  const JUMP_POWER = 12;
  const GRAVITY = -35;
  const MAX_FALL_SPEED = -20;
  const PLAYER_HEIGHT = 1.8;
  const PLAYER_WIDTH = 0.6;

  // Set up keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW': keys.current.w = true; break;
        case 'KeyA': keys.current.a = true; break;
        case 'KeyS': keys.current.s = true; break;
        case 'KeyD': keys.current.d = true; break;
        case 'Space': 
          keys.current.space = true; 
          event.preventDefault(); 
          break;
        case 'ShiftLeft': keys.current.shift = true; break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW': keys.current.w = false; break;
        case 'KeyA': keys.current.a = false; break;
        case 'KeyS': keys.current.s = false; break;
        case 'KeyD': keys.current.d = false; break;
        case 'Space': keys.current.space = false; break;
        case 'ShiftLeft': keys.current.shift = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Enhanced collision detection
  const checkCollision = (pos: THREE.Vector3): boolean => {
    const playerBottom = pos.y - PLAYER_HEIGHT;
    const playerTop = pos.y;
    const playerLeft = pos.x - PLAYER_WIDTH / 2;
    const playerRight = pos.x + PLAYER_WIDTH / 2;
    const playerFront = pos.z + PLAYER_WIDTH / 2;
    const playerBack = pos.z - PLAYER_WIDTH / 2;

    // Check all blocks that could intersect with player
    for (let x = Math.floor(playerLeft); x <= Math.ceil(playerRight); x++) {
      for (let y = Math.floor(playerBottom); y <= Math.ceil(playerTop); y++) {
        for (let z = Math.floor(playerBack); z <= Math.ceil(playerFront); z++) {
          if (stableWorldGenerator.isBlockAt(x, y, z)) {
            // Check if player bounding box intersects with block
            const blockLeft = x;
            const blockRight = x + 1;
            const blockBottom = y;
            const blockTop = y + 1;
            const blockBack = z;
            const blockFront = z + 1;

            if (playerRight > blockLeft && playerLeft < blockRight &&
                playerTop > blockBottom && playerBottom < blockTop &&
                playerFront > blockBack && playerBack < blockFront) {
              return true;
            }
          }
        }
      }
    }
    return false;  };

  // Get the highest solid block Y position under the player
  const getGroundHeight = (x: number, z: number): number => {
    for (let y = Math.floor(position[1]); y >= 0; y--) {
      if (stableWorldGenerator.isBlockAt(Math.floor(x), y, Math.floor(z))) {
        return y + 1; // Stand on top of the block
      }
    }
    return 0; // Default ground level
  };

  useFrame((_, delta) => {
    const currentPos = new THREE.Vector3(...position);
    
    // Get camera direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(direction, camera.up).normalize();

    // Handle movement input
    const moveVector = new THREE.Vector3();
    let speed = MOVE_SPEED;
    
    if (keys.current.shift) speed *= 2; // Sprint
    
    if (keys.current.w) moveVector.add(direction);
    if (keys.current.s) moveVector.sub(direction);
    if (keys.current.a) moveVector.sub(right);
    if (keys.current.d) moveVector.add(right);

    if (moveVector.length() > 0) {
      moveVector.normalize().multiplyScalar(speed * delta);
    }

    // Apply gravity
    velocity.current.y += GRAVITY * delta;
    velocity.current.y = Math.max(velocity.current.y, MAX_FALL_SPEED);

    // Handle jumping
    if (keys.current.space && isGrounded.current) {
      velocity.current.y = JUMP_POWER;
      isGrounded.current = false;
    }

    // Calculate new position with collision detection
    let newPos = currentPos.clone();

    // Handle horizontal movement with collision
    if (moveVector.x !== 0) {
      const testPos = newPos.clone();
      testPos.x += moveVector.x;
      if (!checkCollision(testPos)) {
        newPos.x = testPos.x;
      }
    }

    if (moveVector.z !== 0) {
      const testPos = newPos.clone();
      testPos.z += moveVector.z;
      if (!checkCollision(testPos)) {
        newPos.z = testPos.z;
      }
    }

    // Handle vertical movement with collision
    const verticalMove = velocity.current.y * delta;
    const testPos = newPos.clone();
    testPos.y += verticalMove;

    if (verticalMove < 0) {
      // Falling - check for ground collision
      if (checkCollision(testPos)) {
        // Hit ground - place player on top of highest block
        const groundHeight = getGroundHeight(newPos.x, newPos.z);
        newPos.y = groundHeight + PLAYER_HEIGHT;
        velocity.current.y = 0;
        isGrounded.current = true;
      } else {
        newPos.y = testPos.y;
        isGrounded.current = false;
      }
    } else {
      // Rising - check for ceiling collision
      if (checkCollision(testPos)) {
        // Hit ceiling
        velocity.current.y = 0;
      } else {
        newPos.y = testPos.y;
        isGrounded.current = false;
      }
    }

    // Update camera and position
    camera.position.copy(newPos);
    onPositionChange([newPos.x, newPos.y, newPos.z]);
  });

  return null;
};
