import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Robot } from '../../engine/types';
import { TILE_SIZE } from '../../engine/warehouse';

// ─── Robot visual constants ───────────────────────────────────────────────────

const ROBOT_SIZE   = TILE_SIZE * 0.55; // slightly smaller than a tile so it fits in corridors
const ROBOT_HEIGHT = 0.18;             // flat disc-like profile for top-down clarity
const ROBOT_Z      = 0.40;            // sits above tiles (floor depth 0.04 + shelf 0.35 + margin)

/** Frozen robots pulse red — this is the emissive colour overlay. */
const FROZEN_EMISSIVE = '#ff0000';

/**
 * Task-state ring colours.
 * Amber  = robot is heading to a pickup station.
 * Orange = robot is heading to a dropoff station.
 * This encodes mission direction purely through hue — no text needed.
 */
const TASK_RING_COLOR: Record<'pickup' | 'dropoff', string> = {
  pickup:  '#f59e0b',
  dropoff: '#ea7c1a',
};

// ─── RobotMesh ────────────────────────────────────────────────────────────────

interface RobotMeshProps {
  robot: Robot;
}

export function RobotMesh({ robot }: RobotMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const isFrozen  = robot.state === 'frozen';
  const isWaiting = robot.state === 'waiting';

  // Parent group has shifted origin; tile (col, row) → (col * TILE_SIZE, -row * TILE_SIZE).
  const wx = robot.position.x * TILE_SIZE;
  const wy = -robot.position.y * TILE_SIZE;

  // ── Pulsing red glow for frozen robots (Traditional side only) ───────────────
  useFrame(({ clock }, delta) => {
    if (!matRef.current || !groupRef.current) return;
    if (isFrozen) {
      // Sine wave 0 → 1 → 0 at ~1 Hz
      const pulse = (Math.sin(clock.getElapsedTime() * 6) + 1) / 2;
      matRef.current.emissiveIntensity = 0.25 + pulse * 1.15;
      matRef.current.emissive.set(FROZEN_EMISSIVE);
    } else {
      matRef.current.emissiveIntensity = isWaiting ? 0.15 : 0;
      matRef.current.emissive.set(robot.color);
    }

    // Damped interpolation turns each discrete engine move into smooth motion.
    groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, wx, 18, delta);
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, wy, 18, delta);
  });

  return (
    <group ref={groupRef} position={[wx, wy, ROBOT_Z]}>
      {/* ── Task-state ring — amber=pickup, orange=dropoff. Mission direction at a glance. ── */}
      <mesh position={[0, 0, -ROBOT_HEIGHT / 2 - 0.01]}>
        <torusGeometry args={[ROBOT_SIZE / 2 + 0.055, 0.035, 8, 24]} />
        <meshStandardMaterial
          color={TASK_RING_COLOR[robot.task]}
          emissive={TASK_RING_COLOR[robot.task]}
          emissiveIntensity={0.55}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* ── Body — rounded cylinder for top-down AMR disc silhouette ── */}
      <mesh castShadow>
        <cylinderGeometry args={[ROBOT_SIZE / 2, ROBOT_SIZE / 2, ROBOT_HEIGHT, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color={robot.color}
          emissive={robot.color}
          emissiveIntensity={0}
          roughness={0.3}
          metalness={0.55}
        />
      </mesh>

      {/* ── Direction indicator nub — small box on the "front" of the robot ── */}
      <mesh position={[0, ROBOT_SIZE * 0.32, ROBOT_HEIGHT / 2 + 0.02]}>
        <boxGeometry args={[ROBOT_SIZE * 0.18, ROBOT_SIZE * 0.18, 0.06]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>

      {/* Faint breadcrumbs reveal the current local A* route ahead. */}
      {robot.path.slice(0, 12).map((waypoint, index) => (
        <mesh
          key={`${waypoint.x}-${waypoint.y}-${index}`}
          position={[
            (waypoint.x - robot.position.x) * TILE_SIZE,
            -(waypoint.y - robot.position.y) * TILE_SIZE,
            -ROBOT_Z + 0.08,
          ]}
        >
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color={robot.color} transparent opacity={0.38 - index * 0.018} />
        </mesh>
      ))}

      {/* ── ID label — monospace, industrial ── */}
      <Text
        position={[0, 0, ROBOT_HEIGHT / 2 + 0.12]}
        fontSize={0.22}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {robot.id}
      </Text>

      {/* ── Battery % label — smaller, below ID. Turns red below 25%. ── */}
      <Text
        position={[0, -0.28, ROBOT_HEIGHT / 2 + 0.12]}
        fontSize={0.14}
        color={robot.battery < 25 ? '#ef4444' : '#a3a3a3'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {`${Math.round(robot.battery)}%`}
      </Text>
    </group>
  );
}
