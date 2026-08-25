import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Robot } from '../../engine/types';
import { TILE_SIZE } from '../../engine/warehouse';

// ─── Robot visual constants ───────────────────────────────────────────────────

const ROBOT_SIZE   = TILE_SIZE * 0.55;
const ROBOT_HEIGHT = 0.18;
const ROBOT_Z      = 0.40;

const FROZEN_EMISSIVE = '#ff0000';

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
  const matRef   = useRef<THREE.MeshStandardMaterial>(null);

  const isFrozen  = robot.state === 'frozen';
  const isWaiting = robot.state === 'waiting';

  // Logical grid → world coordinates (recalculated on every render with latest store values)
  const targetX = robot.position.x * TILE_SIZE;
  const targetY = -robot.position.y * TILE_SIZE;

  // ── Place the robot at its starting cell on first mount ──────────────────────
  // We intentionally do NOT pass position as a JSX prop on the <group>.
  // If we did, R3F's reconciler would call object.position.set() on every React
  // re-render — snapping the mesh back to the new cell instantly and killing the
  // smooth interpolation in useFrame below.
  useEffect(() => {
    groupRef.current?.position.set(targetX, targetY, ROBOT_Z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← mount only, intentionally empty deps

  // ── Per-frame: smooth glide + frozen pulse ───────────────────────────────────
  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const mat   = matRef.current;
    if (!group || !mat) return;

    // Damp toward the logical target position.
    // lambda = 9 → soft vehicle-like deceleration; reaches ~83% in one 200ms tick.
    // Critically: useFrame owns the position; the JSX prop does NOT (no snap on re-render).
    group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 9, delta);
    group.position.y = THREE.MathUtils.damp(group.position.y, targetY, 9, delta);
    group.position.z = ROBOT_Z;

    // Frozen robots pulse red; waiting robots have a subtle dim glow.
    if (isFrozen) {
      const pulse = (Math.sin(clock.getElapsedTime() * 6) + 1) / 2;
      mat.emissiveIntensity = 0.25 + pulse * 1.15;
      mat.emissive.set(FROZEN_EMISSIVE);
    } else {
      mat.emissiveIntensity = isWaiting ? 0.15 : 0;
      mat.emissive.set(robot.color);
    }
  });

  return (
    // ← No position prop here. useFrame owns all position changes after mount.
    <group ref={groupRef}>
      {/* ── Task-state ring — amber=pickup, orange=dropoff ── */}
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

      {/* ── Body ── */}
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

      {/* ── Direction nub ── */}
      <mesh position={[0, ROBOT_SIZE * 0.32, ROBOT_HEIGHT / 2 + 0.02]}>
        <boxGeometry args={[ROBOT_SIZE * 0.18, ROBOT_SIZE * 0.18, 0.06]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>

      {/* ── A* path preview dots ── */}
      {robot.path.slice(0, 12).map((wp, i) => (
        <mesh
          key={`${wp.x}-${wp.y}-${i}`}
          position={[
            (wp.x - robot.position.x) * TILE_SIZE,
            -(wp.y - robot.position.y) * TILE_SIZE,
            -ROBOT_Z + 0.08,
          ]}
        >
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color={robot.color} transparent opacity={0.38 - i * 0.018} />
        </mesh>
      ))}

      {/* ── ID label ── */}
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

      {/* ── Battery % — turns red below 25% ── */}
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
