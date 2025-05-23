import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

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

  useFrame((state, delta) => {
    const speed = 10;
    const currentPosition = new Vector3(...position);

    // Movement
    if (keys.current.has('KeyW')) {
      velocity.current.z -= speed * delta;
    }
    if (keys.current.has('KeyS')) {
      velocity.current.z += speed * delta;
    }
    if (keys.current.has('KeyA')) {
      velocity.current.x -= speed * delta;
    }
    if (keys.current.has('KeyD')) {
      velocity.current.x += speed * delta;
    }
    if (keys.current.has('Space')) {
      velocity.current.y += speed * delta;
    }
    if (keys.current.has('ShiftLeft')) {
      velocity.current.y -= speed * delta;
    }

    // Apply velocity with damping
    currentPosition.add(velocity.current);
    velocity.current.multiplyScalar(0.8);

    onPositionChange([currentPosition.x, currentPosition.y, currentPosition.z]);

    // Update camera position
    state.camera.position.copy(currentPosition);
  });

  return null;
};
