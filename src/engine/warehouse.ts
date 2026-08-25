import type { Cell, CellType } from './types';

// ─── Grid dimensions ──────────────────────────────────────────────────────────

export const GRID_COLS = 20;
export const GRID_ROWS = 14;

/** World-space size of one tile (used by the R3F renderer) */
export const TILE_SIZE = 1;

// ─── Station positions ────────────────────────────────────────────────────────

/**
 * Three pickup stations — one per robot.
 * Positions chosen to be on open floor tiles, well-separated.
 */
export const PICKUP_STATIONS: { x: number; y: number; label: string }[] = [
  { x: 1,  y: 2,  label: 'P1' },
  { x: 1,  y: 7,  label: 'P2' },
  { x: 1,  y: 11, label: 'P3' },
];

/**
 * Three dropoff stations — one per robot.
 * Positioned on the opposite side of the warehouse.
 */
export const DROPOFF_STATIONS: { x: number; y: number; label: string }[] = [
  { x: 18, y: 2,  label: 'D1' },
  { x: 18, y: 7,  label: 'D2' },
  { x: 18, y: 11, label: 'D3' },
];

// ─── Shelf block definitions ──────────────────────────────────────────────────

/**
 * Each shelf block is a rectangle: { col start, row start, width, height }.
 * Arranged to create natural narrow aisles between them.
 *
 * Layout (schematic — S=shelf, A=choke aisle corridor):
 *
 *  col:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
 *  row 0: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row 1: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row 2: P1 .  .  .  [choke]   .  .  .  .  [choke]    .  .  .  D1 .
 *  row 3: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row 4: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row 5: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row 6: .  .  .  .  [choke]   .  .  .  .  [choke]    .  .  .  .  .
 *  row 7: P2 .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  D2 .
 *  row 8: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row 9: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row10: .  .  .  .  [choke]   .  .  .  .  [choke]    .  .  .  .  .
 *  row11: P3 .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  D3 .
 *  row12: .  .  .  .  S  S  S  S  .  .  .  .  S  S  S  S  .  .  .  .
 *  row13: .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
 *
 * Choke aisles: col 8 (between the two shelf banks), and the corridor
 * rows where shelves are absent, forcing robots through a single tile gap.
 */
const SHELF_BLOCKS: { x: number; y: number; w: number; h: number }[] = [
  // Left shelf bank — upper block (rows 0–1)
  { x: 4, y: 0, w: 4, h: 2 },
  // Left shelf bank — middle-upper block (rows 3–5)
  { x: 4, y: 3, w: 4, h: 3 },
  // Left shelf bank — middle-lower block (rows 7–9)
  { x: 4, y: 7, w: 4, h: 3 },
  // Left shelf bank — lower block (rows 11–12)
  { x: 4, y: 11, w: 4, h: 2 },

  // Right shelf bank — upper block (rows 0–1)
  { x: 12, y: 0, w: 4, h: 2 },
  // Right shelf bank — middle-upper block (rows 3–5)
  { x: 12, y: 3, w: 4, h: 3 },
  // Right shelf bank — middle-lower block (rows 7–9)
  { x: 12, y: 7, w: 4, h: 3 },
  // Right shelf bank — lower block (rows 11–12)
  { x: 12, y: 11, w: 4, h: 2 },
];

// ─── Grid builder ─────────────────────────────────────────────────────────────

function buildGrid(): Cell[][] {
  // Initialise every cell as 'floor'
  const grid: Cell[][] = Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({ x, y, type: 'floor' as CellType }))
  );

  // Stamp shelf blocks
  for (const block of SHELF_BLOCKS) {
    for (let dy = 0; dy < block.h; dy++) {
      for (let dx = 0; dx < block.w; dx++) {
        const gx = block.x + dx;
        const gy = block.y + dy;
        if (gx < GRID_COLS && gy < GRID_ROWS) {
          grid[gy][gx] = { x: gx, y: gy, type: 'shelf' };
        }
      }
    }
  }

  // Stamp pickup stations
  for (const p of PICKUP_STATIONS) {
    grid[p.y][p.x] = { x: p.x, y: p.y, type: 'pickup', label: p.label };
  }

  // Stamp dropoff stations
  for (const d of DROPOFF_STATIONS) {
    grid[d.y][d.x] = { x: d.x, y: d.y, type: 'dropoff', label: d.label };
  }

  return grid;
}

/**
 * The canonical 20×14 warehouse grid.
 * Access a cell with: WAREHOUSE_GRID[row][col]  or  WAREHOUSE_GRID[y][x]
 *
 * Created once at module load — treat as read-only.
 * The engine uses `blockedCells` (a Set<string>) for dynamic obstacles on top.
 */
export const WAREHOUSE_GRID: Cell[][] = buildGrid();

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns the cell at (x, y), or undefined if out of bounds. */
export function getCell(x: number, y: number): Cell | undefined {
  return WAREHOUSE_GRID[y]?.[x];
}

/** Returns true if (x, y) is a permanently impassable tile (shelf). */
export function isPermanentlyBlocked(x: number, y: number): boolean {
  const cell = getCell(x, y);
  return cell === undefined || cell.type === 'shelf';
}

/**
 * Returns true if (x, y) is passable given a set of dynamically blocked cells.
 * @param blockedCells  Set of "x,y" strings representing runtime obstacles.
 */
export function isPassable(
  x: number,
  y: number,
  blockedCells: Set<string> = new Set()
): boolean {
  if (isPermanentlyBlocked(x, y)) return false;
  return !blockedCells.has(`${x},${y}`);
}

/** Convenience: returns all four cardinal neighbours of (x, y). */
export function neighbours(x: number, y: number): { x: number; y: number }[] {
  return [
    { x: x,     y: y - 1 }, // up
    { x: x,     y: y + 1 }, // down
    { x: x - 1, y: y     }, // left
    { x: x + 1, y: y     }, // right
  ];
}
