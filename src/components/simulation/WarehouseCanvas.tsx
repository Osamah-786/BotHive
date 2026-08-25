import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { WarehouseGrid } from './WarehouseGrid';
import { RobotMesh } from './RobotMesh';
import { ObstacleMesh } from './ObstacleMesh';
import { P2PLines } from './P2PLines';
import { useSimStore } from '../../store/useSimStore';
import { getCell, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../../engine/warehouse';
import type { Robot } from '../../engine/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Camera zoom: how many pixels to show per world unit.
 * Tuned so the full 20×14 grid fits comfortably in a half-screen canvas.
 */
const CAMERA_ZOOM = 36;

/**
 * The grid is centred at (0,0) in world space by offsetting the mesh positions.
 * Centre offset so tile (0,0) → world (-halfW, -halfH).
 */
const HALF_W = (GRID_COLS * TILE_SIZE) / 2;
const HALF_H = (GRID_ROWS * TILE_SIZE) / 2;

// ─── Side banner ──────────────────────────────────────────────────────────────

interface BannerProps {
  label: string;
  color: string; // tailwind arbitrary value, e.g. '#ef4444'
}

function SideBanner({ label, color }: BannerProps) {
  return (
    <div
      className="pointer-events-none absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-[5px]"
      style={{ backgroundColor: `${color}18`, borderBottom: `1px solid ${color}55` }}
    >
      <span
        className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── WarehouseCanvas ──────────────────────────────────────────────────────────

interface WarehouseCanvasProps {
  /** 'traditional' or 'proposed' — determines which slice of the store to read */
  side: 'traditional' | 'proposed';
}

export function WarehouseCanvas({ side }: WarehouseCanvasProps) {
  const robots: Robot[] = useSimStore((s) =>
    side === 'traditional' ? s.traditional.robots : s.proposed.robots
  );
  const blockedCells = useSimStore((s) => s.blockedCells);
  const p2pLinks = useSimStore((s) => s.proposed.p2pLinks);
  const toggleBlockCell = useSimStore((s) => s.toggleBlockCell);

  const isTraditional = side === 'traditional';
  const bannerLabel = isTraditional ? '⬛  CENTRALIZED  ·  CLOUD' : '⬡  DECENTRALIZED  ·  P2P MESH';
  const bannerColor = isTraditional ? '#ef4444' : '#22c55e';
  const toggleFloorObstacle = (x: number, y: number) => {
    if (getCell(x, y)?.type === 'floor') toggleBlockCell(x, y);
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#0f0a04' }}>
      {/* Industrial panel-style label strip */}
      <SideBanner label={bannerLabel} color={bannerColor} />

      <Canvas
        // Disable default camera — we inject our own OrthographicCamera below
        camera={{ manual: true }}
        // Keep the background transparent so the parent div's dark bg shows through
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Flat ambient + directional light for top-down readability */}
        <ambientLight intensity={2.2} />
        <directionalLight position={[0, 10, 5]} intensity={0.6} />

        {/*
          OrthographicCamera centred on the grid.
          near/far chosen wide so nothing clips.
        */}
        <OrthographicCamera
          makeDefault
          zoom={CAMERA_ZOOM}
          position={[0, 0, 10]}
          near={0.1}
          far={100}
        />

        {/* Offset group so tile (0,0) renders at world (-HALF_W, -HALF_H) */}
        <group position={[-HALF_W + TILE_SIZE / 2, HALF_H - TILE_SIZE / 2, 0]}>
          {/* Static warehouse grid */}
          <WarehouseGrid onFloorClick={toggleFloorObstacle} />
          <ObstacleMesh blockedCells={blockedCells} onCellClick={toggleFloorObstacle} />
          {!isTraditional && <P2PLines robots={robots} links={p2pLinks} />}

          {/* One RobotMesh per robot */}
          {robots.map((robot) => (
            <RobotMesh key={robot.id} robot={robot} />
          ))}
        </group>
      </Canvas>
    </div>
  );
}
