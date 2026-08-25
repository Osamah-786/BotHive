// ─── Cell Types ───────────────────────────────────────────────────────────────

export type CellType = 'floor' | 'shelf' | 'pickup' | 'dropoff' | 'blocked';

export interface Cell {
  x: number; // column index (0 = leftmost)
  y: number; // row index    (0 = topmost)
  type: CellType;
  /** Optional label shown in the UI, e.g. "P1", "D2" */
  label?: string;
}

// ─── Robot ────────────────────────────────────────────────────────────────────

export type RobotState = 'moving' | 'waiting' | 'frozen';
export type RobotTask = 'pickup' | 'dropoff';

export interface Robot {
  id: string; // "R1" | "R2" | "R3"
  color: string; // hex color string

  /** Current grid position (grid-space integers) */
  position: { x: number; y: number };

  /** Remaining A* waypoints to the current target (excludes current position) */
  path: { x: number; y: number }[];

  /** Which leg of the cycle the robot is currently on */
  task: RobotTask;

  /** Index into PICKUP_STATIONS / DROPOFF_STATIONS that this robot is assigned to */
  stationIndex: number;

  /** Battery level 0–100 %. Drains 0.5 % per tick while moving. */
  battery: number;

  /**
   * Urgency 0–1.  Set randomly when a new task cycle begins.
   * Used as the highest-priority field in the proposed token protocol.
   */
  urgency: number;

  /** Epoch ms when the *current task cycle* started — used as tiebreaker */
  timestamp: number;

  /** Lifecycle state */
  state: RobotState;

  /** Total number of conflict-resolution events this robot has participated in */
  conflictsResolved: number;

  /** Accumulated ticks spent in 'waiting' or 'frozen' state */
  idleTime: number;

  /** Total pick→drop cycles completed */
  tasksCompleted: number;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface SimMetrics {
  /** Running tally of tasks completed across all robots */
  totalTasksCompleted: number;

  /** Sum of idle ticks across all robots this session */
  totalIdleTime: number;

  /** Total conflict-resolution events fired */
  conflictCount: number;

  /**
   * Snapshot history for Recharts — one entry pushed per tick.
   * Kept sparse: only pushed every METRICS_SAMPLE_INTERVAL ticks.
   */
  history: MetricsSnapshot[];
}

export interface MetricsSnapshot {
  tick: number;
  tasksCompleted: number;
  idleTime: number;
  conflicts: number;
}

// ─── P2P ──────────────────────────────────────────────────────────────────────

/**
 * Represents an active P2P communication link between two robots (Proposed side).
 * Used purely for rendering the green mesh lines.
 */
export interface P2PLink {
  from: string; // robot id
  to: string; // robot id
}

// ─── Simulation-side state (held in the Zustand store) ───────────────────────

export interface SideState {
  robots: Robot[];
  metrics: SimMetrics;
}

export interface ProposedSideState extends SideState {
  p2pLinks: P2PLink[];
}
