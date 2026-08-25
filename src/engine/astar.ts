import { isPassable, neighbours, GRID_COLS, GRID_ROWS } from './warehouse';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridPos {
  x: number;
  y: number;
}

// ─── Heuristic ────────────────────────────────────────────────────────────────

/** Manhattan distance — admissible for a 4-directional grid. */
function heuristic(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// ─── Node used internally by the open-set ────────────────────────────────────

interface AStarNode {
  pos: GridPos;
  g: number; // cost from start
  f: number; // g + h
  parent: AStarNode | null;
}

// ─── Simple min-heap (priority queue) ─────────────────────────────────────────

class MinHeap {
  private heap: AStarNode[] = [];

  get size() {
    return this.heap.length;
  }

  push(node: AStarNode): void {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].f <= this.heap[i].f) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].f < this.heap[smallest].f) smallest = l;
      if (r < n && this.heap[r].f < this.heap[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

// ─── A* ───────────────────────────────────────────────────────────────────────

/**
 * Finds the shortest path from `start` to `goal` on the warehouse grid.
 *
 * @param start        Starting grid position.
 * @param goal         Target grid position.
 * @param blockedCells Runtime-dynamic obstacles (e.g. blocked aisles).
 *                     These are overlaid on top of the permanent shelf tiles.
 * @returns            Array of grid positions from start (exclusive) to goal
 *                     (inclusive).  Returns an empty array if no path exists.
 *
 * @example
 * const path = aStar({ x: 1, y: 2 }, { x: 18, y: 7 });
 * // path[0] is the first step AFTER the start position
 */
export function aStar(
  start: GridPos,
  goal: GridPos,
  blockedCells: Set<string> = new Set()
): GridPos[] {
  // Edge-cases
  if (start.x === goal.x && start.y === goal.y) return [];

  // Validate goal is actually reachable (not a shelf / out-of-bounds)
  if (!isPassable(goal.x, goal.y, blockedCells)) return [];

  const key = (p: GridPos) => `${p.x},${p.y}`;

  const openSet = new MinHeap();
  const gScore = new Map<string, number>();
  const closed = new Set<string>();

  const startNode: AStarNode = {
    pos: start,
    g: 0,
    f: heuristic(start, goal),
    parent: null,
  };

  openSet.push(startNode);
  gScore.set(key(start), 0);

  while (openSet.size > 0) {
    const current = openSet.pop()!;
    const ck = key(current.pos);

    if (closed.has(ck)) continue;
    closed.add(ck);

    // Goal reached — reconstruct path
    if (current.pos.x === goal.x && current.pos.y === goal.y) {
      return reconstructPath(current);
    }

    // Expand neighbours
    for (const nb of neighbours(current.pos.x, current.pos.y)) {
      // Bounds check
      if (nb.x < 0 || nb.x >= GRID_COLS || nb.y < 0 || nb.y >= GRID_ROWS) continue;

      const nk = key(nb);
      if (closed.has(nk)) continue;
      if (!isPassable(nb.x, nb.y, blockedCells)) continue;

      const tentativeG = current.g + 1; // uniform cost (each step = 1)
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentativeG);
        openSet.push({
          pos: nb,
          g: tentativeG,
          f: tentativeG + heuristic(nb, goal),
          parent: current,
        });
      }
    }
  }

  // No path found
  return [];
}

// ─── Path reconstruction ──────────────────────────────────────────────────────

function reconstructPath(node: AStarNode): GridPos[] {
  const path: GridPos[] = [];
  let current: AStarNode | null = node;
  while (current !== null) {
    path.push(current.pos);
    current = current.parent;
  }
  path.reverse();
  // Drop index 0 (that's the start position itself); return start→goal path
  return path.slice(1);
}

// ─── Smoke-test helper (dev only) ────────────────────────────────────────────

/**
 * Logs a quick sanity-check path to the console.
 * Call from a browser console or a dev script:
 *   import { smokeTestAStar } from './engine/astar';
 *   smokeTestAStar();
 */
export function smokeTestAStar(): void {
  const { PICKUP_STATIONS, DROPOFF_STATIONS } = {
    PICKUP_STATIONS: [
      { x: 1,  y: 2  },
      { x: 1,  y: 7  },
      { x: 1,  y: 11 },
    ],
    DROPOFF_STATIONS: [
      { x: 18, y: 2  },
      { x: 18, y: 7  },
      { x: 18, y: 11 },
    ],
  };

  const tests = [
    { start: PICKUP_STATIONS[0], goal: DROPOFF_STATIONS[0], label: 'R1: P1 → D1' },
    { start: PICKUP_STATIONS[1], goal: DROPOFF_STATIONS[1], label: 'R2: P2 → D2' },
    { start: PICKUP_STATIONS[2], goal: DROPOFF_STATIONS[2], label: 'R3: P3 → D3' },
  ];

  for (const t of tests) {
    const path = aStar(t.start, t.goal);
    console.log(
      `[A*] ${t.label} → ${path.length > 0 ? `${path.length} steps` : '❌ NO PATH'}`
    );
    if (path.length > 0) {
      console.log(`  First 5 steps:`, path.slice(0, 5));
    }
  }
}
