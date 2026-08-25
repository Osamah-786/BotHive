import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE } from '../../engine/warehouse';

interface ObstacleMeshProps {
  blockedCells: Set<string>;
  onCellClick?: (x: number, y: number) => void;
}

/** Red, pulsing physical marker for a chaos-injected blocked aisle. */
export function ObstacleMesh({ blockedCells, onCellClick }: ObstacleMeshProps) {
  return (
    <group>
      {[...blockedCells].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return <ObstacleBlock key={key} x={x} y={y} onClick={onCellClick} />;
      })}
    </group>
  );
}

interface ObstacleBlockProps {
  x: number;
  y: number;
  onClick?: (x: number, y: number) => void;
}

function ObstacleBlock({ x, y, onClick }: ObstacleBlockProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.emissiveIntensity = 0.45 + (Math.sin(clock.getElapsedTime() * 5) + 1) * 0.22;
  });

  return (
    <mesh
      position={[x * TILE_SIZE, -y * TILE_SIZE, 0.34]}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(x, y);
      }}
    >
      <boxGeometry args={[TILE_SIZE * 0.78, TILE_SIZE * 0.78, 0.62]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#991b1b"
        emissive="#ef4444"
        emissiveIntensity={0.6}
        roughness={0.35}
        metalness={0.2}
      />
    </mesh>
  );
}
