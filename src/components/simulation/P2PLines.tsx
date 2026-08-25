import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { P2PLink, Robot } from '../../engine/types';
import { TILE_SIZE } from '../../engine/warehouse';

interface P2PLinesProps {
  robots: Robot[];
  links: P2PLink[];
}

/** Animated peer-to-peer radio links, shown only on the decentralized warehouse. */
export function P2PLines({ robots, links }: P2PLinesProps) {
  const robotsById = useMemo(() => new Map(robots.map((robot) => [robot.id, robot])), [robots]);

  return (
    <group>
      {links.map((link) => {
        const from = robotsById.get(link.from);
        const to = robotsById.get(link.to);
        if (!from || !to) return null;
        return <P2PLinkLine key={`${link.from}-${link.to}`} from={from.position} to={to.position} />;
      })}
    </group>
  );
}

interface P2PLinkLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function P2PLinkLine({ from, to }: P2PLinkLineProps) {
  const lineRef = useRef<THREE.Line>(null);
  const line = useMemo(() => {
    const points = [
      new THREE.Vector3(from.x * TILE_SIZE, -from.y * TILE_SIZE, 0.34),
      new THREE.Vector3(to.x * TILE_SIZE, -to.y * TILE_SIZE, 0.34),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: '#4ade80',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [from.x, from.y, to.x, to.y]);

  useFrame(({ clock }) => {
    const material = lineRef.current?.material as THREE.LineBasicMaterial | undefined;
    if (material) material.opacity = 0.32 + (Math.sin(clock.getElapsedTime() * 5) + 1) * 0.18;
  });

  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }, [line]);

  return <primitive ref={lineRef} object={line} />;
}
