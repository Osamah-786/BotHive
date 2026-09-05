// ─── Cell Types ───────────────────────────────────────────────────────────────

export type CellType = 'floor' | 'shelf' | 'pickup' | 'dropoff' | 'charging' | 'blocked';

export interface Cell {
  x: number; // column index (0 = leftmost)
  y: number; // row index    (0 = topmost)
  type: CellType;
  /** Optional label shown in the UI, e.g. "P1", "D2", or "C1" */
  label?: string;
}

// ─── Robot ────────────────────────────────────────────────────────────────────

export type RobotState =
  | 'moving'
  | 'waiting'
  | 'frozen'
  | 'goingToCharge'
  | 'charging'
  | 'failed'
  | 'killed';
export type RobotTask = 'pickup' | 'dropoff';

export type PeerHealthStatus = 'online' | 'suspected' | 'failed';

export interface PeerHealth {
  lastSeenTick: number;
  lastHeartbeatSeq: number;
  lastKnownPosition: { x: number; y: number };
  lastKnownState: RobotState;
  status: PeerHealthStatus;
}

export interface TransportTask {
  pickup: { x: number; y: number };
  dropoff: { x: number; y: number };
}

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

  /** Battery level 0–100 %. Consumes one task's energy on completed delivery. */
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

  /** Selected charging station while going to or currently at a charger. */
  chargingStationIndex?: number;

  /** Last heartbeat/state observed for each peer, maintained locally. */
  peerHealth?: Record<string, PeerHealth>;

  /** Total number of conflict-resolution events this robot has participated in */
  conflictsResolved: number;

  /** Accumulated ticks spent in 'waiting' or 'frozen' state */
  idleTime: number;

  /** Total pick→drop cycles completed */
  tasksCompleted: number;

  /** One dashboard-created transport task waiting for this robot. */
  pendingTransportTask?: TransportTask;

  /** Set after a custom delivery until the robot reaches its immutable home. */
  returningHomeAfterTransport?: boolean;

  /**
   * If this robot is currently covering for a killed robot, this is the
   * killed robot's ID. Otherwise undefined. Used to track task inheritance.
   */
  coveringForRobotId?: string;

  /**
   * When a robot is killed mid-dropoff (carrying cargo), the covering robot
   * must first navigate to the death position to "pick up" the stranded stock
   * before heading to the dropoff station.
   * This field holds that intermediate rescue waypoint.
   * Cleared automatically once the robot arrives and transitions to 'dropoff'.
   */
  rescueFromPosition?: { x: number; y: number };
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
  remainingBoxes: number;
  stackBoxes: number[];
}

export interface ProposedSideState extends SideState {
  p2pLinks: P2PLink[];
}
