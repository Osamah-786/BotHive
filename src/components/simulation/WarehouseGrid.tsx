import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { WAREHOUSE_GRID, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../../engine/warehouse';
import type { CellType } from '../../engine/types';

// ─── Warehouse colour palette (plan spec) ────────────────────────────────────

const CELL_COLORS: Record<CellType, string> = {
  floor:   '#c8a96e', // sandy beige
  shelf:   '#6b4226', // dark wood brown
  pickup:  '#f59e0b', // amber
  dropoff: '#ea7c1a', // orange
  blocked: '#ef4444',
};

/** Slight height variation per cell type to give visual separation */
const CELL_DEPTH: Record<CellType, number> = {
  floor:   0.04,
  shelf:   0.35,
  pickup:  0.08,
  dropoff: 0.08,
  blocked: 0.25,
};

/** Emissive intensity — makes special cells glow slightly under flat lighting */
const CELL_EMISSIVE: Record<CellType, number> = {
  floor:   0,
  shelf:   0,
  pickup:  0.25,
  dropoff: 0.20,
  blocked: 0.40,
};

/** Label text color per station type */
const LABEL_COLOR: Partial<Record<CellType, string>> = {
  pickup:  '#1a1209', // dark — reads against amber
  dropoff: '#1a1209', // dark — reads against orange
};

// ─── Thin gap between tiles to read the grid structure ───────────────────────
const GAP = 0.05;

// ─── WarehouseGrid ────────────────────────────────────────────────────────────

interface WarehouseGridProps {
  /** Clicking a floor tile toggles a temporary aisle obstacle. */
  onFloorClick?: (x: number, y: number) => void;
}

export function WarehouseGrid({ onFloorClick }: WarehouseGridProps) {
  /**
   * Build the flat array of static cell descriptors once.
   * Memoised to avoid re-building 280 cells every render frame.
   */
  const cells = useMemo(() => {
    const result: {
      key: string;
      x: number;
      y: number;
      type: CellType;
      label?: string;
    }[] = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const base = WAREHOUSE_GRID[row][col];
        const type: CellType = base.type;
        result.push({ key: `${col}-${row}`, x: col, y: row, type, label: base.label });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {cells.map(({ key, x, y, type, label }) => {
        const color   = CELL_COLORS[type];
        const depth   = CELL_DEPTH[type];
        const emissive = CELL_EMISSIVE[type];
        const tileW   = TILE_SIZE - GAP;

        return (
          <group
            key={key}
            // Grid coordinate → world position.
            // Parent group has already shifted origin so (0,0) is top-left.
            // Y axis in Three.js is up, grid rows increase downward → negate y.
            position={[x * TILE_SIZE, -y * TILE_SIZE, 0]}
          >
            {/* ── Tile mesh ── */}
            <mesh
              position={[0, 0, depth / 2]}
              onClick={(event) => {
                event.stopPropagation();
                if (type === 'floor') onFloorClick?.(x, y);
              }}
            >
              <boxGeometry args={[tileW, tileW, depth]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={emissive}
                roughness={type === 'shelf' ? 0.9 : 0.5}
                metalness={type === 'shelf' ? 0.1 : 0.0}
              />
            </mesh>

            {/* ── Station label (P1, D1, etc.) ── */}
            {label && (
              <Text
                position={[0, 0, depth + 0.12]}
                fontSize={0.28}
                color={LABEL_COLOR[type] ?? '#fef3c7'}
                anchorX="center"
                anchorY="middle"
                font={undefined}
                outlineWidth={0.015}
                outlineColor="#00000055"
              >
                {label}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}
