import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

interface PlayerControllerProps {
  position: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
}

// Simple collision detection for ground and basic boundaries
const checkCollision = (position: Vector3): Vector3 => {
  const newPos = position.clone();
  
  // Ground collision (minimum Y position)
  const groundLevel = 1; // Above the ground plane
  if (newPos.y < groundLevel) {
    newPos.y = groundLevel;
  }
  
  // Simple world boundaries to prevent player from going too far
  const worldBounds = 200;
  newPos.x = Math.max(-worldBounds, Math.min(worldBounds, newPos.x));
  newPos.z = Math.max(-worldBounds, Math.min(worldBounds, newPos.z));
  
  // Height limit
  const maxHeight = 100;
  if (newPos.y > maxHeight) {
    newPos.y = maxHeight;
  }
  
  return newPos;
};

interface PlayerControllerProps {
  position: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({
  position,
  onPositionChange,
}) => {
  const velocity = useRef<Vector3>(new Vector3());
  const keys = useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  // Use refs to avoid unnecessary allocations
  const tempVector = useRef(new Vector3());
  const currentPos = useRef(new Vector3(...position));
  const frameCount = useRef(0);
  
  useFrame((state, delta) => {
    // Limit updates to reduce CPU usage while maintaining responsiveness
    frameCount.current++;
    const shouldUpdatePosition = frameCount.current % 2 === 0;
    
    // Clamp delta to prevent jumps after tab switching
    const clampedDelta = Math.min(delta, 0.1);
    const speed = 10;
    
    // Update current position from props (only if changed)
    if (
      currentPos.current.x !== position[0] ||
      currentPos.current.y !== position[1] ||
      currentPos.current.z !== position[2]
    ) {
      currentPos.current.set(position[0], position[1], position[2]);
    }

    // Movement (optimized to reduce allocations)
    velocity.current.set(0, 0, 0); // Reset velocity
    
    // Batch key checks to reduce operations
    const moveForward = keys.current.has('KeyW');
    const moveBackward = keys.current.has('KeyS');
    const moveLeft = keys.current.has('KeyA');
    const moveRight = keys.current.has('KeyD');
    const moveUp = keys.current.has('Space');
    const moveDown = keys.current.has('ShiftLeft');
    
    // Only calculate if keys are pressed
    if (moveForward || moveBackward || moveLeft || moveRight || moveUp || moveDown) {
      if (moveForward) velocity.current.z -= speed * clampedDelta;
      if (moveBackward) velocity.current.z += speed * clampedDelta;
      if (moveLeft) velocity.current.x -= speed * clampedDelta;
      if (moveRight) velocity.current.x += speed * clampedDelta;
      if (moveUp) velocity.current.y += speed * clampedDelta;
      if (moveDown) velocity.current.y -= speed * clampedDelta;
        // Apply velocity with collision detection
      const newPosition = currentPos.current.clone().add(velocity.current);
      const collisionCheckedPosition = checkCollision(newPosition);
      currentPos.current.copy(collisionCheckedPosition);
    
      // Only update position state if needed to reduce React renders
      if (shouldUpdatePosition) {
        tempVector.current.copy(currentPos.current);
        onPositionChange([tempVector.current.x, tempVector.current.y, tempVector.current.z]);
      }
    }

    // Always update camera position for smooth movement
    state.camera.position.copy(currentPos.current);
  });

  return null;
};
