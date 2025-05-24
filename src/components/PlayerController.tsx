import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

interface PlayerControllerProps {
  position: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({
  position,
  onPositionChange
}) => {
  const { camera } = useThree();
  const velocity = useRef(new Vector3());
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    shift: false
  });

  // Set up keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW': keys.current.w = true; break;
        case 'KeyA': keys.current.a = true; break;
        case 'KeyS': keys.current.s = true; break;
        case 'KeyD': keys.current.d = true; break;
        case 'Space': keys.current.space = true; event.preventDefault(); break;
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

  useFrame((state, delta) => {
    const speed = 10;
    const direction = new Vector3();

    // Get camera direction
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    // Calculate right vector
    const right = new Vector3();
    right.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

    // Apply movement based on keys
    if (keys.current.w) velocity.current.add(direction.multiplyScalar(speed * delta));
    if (keys.current.s) velocity.current.add(direction.multiplyScalar(-speed * delta));
    if (keys.current.a) velocity.current.add(right.multiplyScalar(-speed * delta));
    if (keys.current.d) velocity.current.add(right.multiplyScalar(speed * delta));
    if (keys.current.space) velocity.current.y += speed * delta;
    if (keys.current.shift) velocity.current.y -= speed * delta;

    // Apply velocity to position
    const newPosition: [number, number, number] = [
      position[0] + velocity.current.x,
      position[1] + velocity.current.y,
      position[2] + velocity.current.z
    ];

    // Update camera position
    camera.position.set(...newPosition);

    // Call position change callback
    onPositionChange(newPosition);

    // Apply damping
    velocity.current.multiplyScalar(0.8);
  });

  return null;
};
