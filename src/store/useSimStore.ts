import { create } from 'zustand';
import type { Robot, SimMetrics, P2PLink } from '../engine/types';
import { TOTAL_BOXES, urgencyFor } from '../engine/simulation';
import {
  PICKUP_STATIONS,
  DROPOFF_STATIONS,
  CHARGING_STATIONS,
} from '../engine/warehouse';

// ─── Colour palette (matches plan) ───────────────────────────────────────────

const ROBOT_COLORS = ['#3b82f6', '#22c55e', '#eab308'] as const; // blue, green, yellow

// ─── Initial robot factory ────────────────────────────────────────────────────

function makeRobots(): Robot[] {
  return PICKUP_STATIONS.map((station, i) => ({
    id: `R${i + 1}`,
    color: ROBOT_COLORS[i],
    position: { x: station.x, y: station.y },
    path: [],
    task: 'pickup' as const,
    stationIndex: i,
    battery: 100,
    urgency: urgencyFor(`R${i + 1}`, 0),
    timestamp: 0,
    state: 'moving' as const,
    peerHealth: {},
    conflictsResolved: 0,
    idleTime: 0,
    tasksCompleted: 0,
  }));
}

function makeMetrics(): SimMetrics {
  return {
    totalTasksCompleted: 0,
    totalIdleTime: 0,
    conflictCount: 0,
    history: [],
  };
}

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface SimStore {
  // ── Simulation control ──────────────────────────────────────────────────────
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  tick: number;

  // ── Chaos state ─────────────────────────────────────────────────────────────
  cloudKilled: boolean;
  blockedCells: Set<string>;   // "x,y" keys
  latencyMs: number;           // 20 – 2000
  /** Set of robot IDs that have been manually killed (hardware failure scenario). */
  killedRobots: Set<string>;
  /** Proposed-side robots in a simulated communication blackout. */
  unresponsiveRobots: Set<string>;

  // ── Simulation sides ────────────────────────────────────────────────────────
  traditional: {
    robots: Robot[];
    metrics: SimMetrics;
    remainingBoxes: number;
    stackBoxes: number[];
  };
  proposed: {
    robots: Robot[];
    metrics: SimMetrics;
    remainingBoxes: number;
    stackBoxes: number[];
    p2pLinks: P2PLink[];
  };

  // ── Actions (Phase 3+ will fill these in) ───────────────────────────────────
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (s: 0.5 | 1 | 2 | 4) => void;

  killCloud: () => void;
  restoreCloud: () => void;
  toggleBlockCell: (x: number, y: number) => void;
  setLatency: (ms: number) => void;

  /** Simulate a hardware failure for a specific robot ID. */
  killRobot: (id: string) => void;
  /** Bring a manually killed robot back online without restarting the simulation. */
  reviveRobot: (id: string) => void;
  toggleRobotUnresponsive: (id: string) => void;
  decreaseRobotBattery: (id: string, amount: number) => void;

  /** Called each engine tick to advance the tick counter */
  setTick: (t: number) => void;

  /** Called by the engines after computing a new frame */
  setTraditionalState: (robots: Robot[], metrics: SimMetrics, remainingBoxes: number, stackBoxes: number[]) => void;
  setProposedState: (robots: Robot[], metrics: SimMetrics, remainingBoxes: number, stackBoxes: number[], p2pLinks: P2PLink[]) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSimStore = create<SimStore>((set) => ({
  // ── Control ─────────────────────────────────────────────────────────────────
  // There are no visible controls until Phase 4, so Phase 3 starts autonomously.
  isPlaying: true,
  speed: 1,
  tick: 0,

  // ── Chaos defaults ──────────────────────────────────────────────────────────
  cloudKilled: false,
  blockedCells: new Set<string>(),
  latencyMs: 200,
  killedRobots: new Set<string>(),
  unresponsiveRobots: new Set<string>(),

  // ── Initial side states ─────────────────────────────────────────────────────
  traditional: {
    robots: makeRobots(),
    metrics: makeMetrics(),
    remainingBoxes: TOTAL_BOXES,
    stackBoxes: [2, 2, 2],
  },
  proposed: {
    robots: makeRobots(),
    metrics: makeMetrics(),
    remainingBoxes: TOTAL_BOXES,
    stackBoxes: [2, 2, 2],
    p2pLinks: [],
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  restart: () =>
    set({
      isPlaying: true,
      tick: 0,
      cloudKilled: false,
      blockedCells: new Set<string>(),
      latencyMs: 200,
      killedRobots: new Set<string>(),
      unresponsiveRobots: new Set<string>(),
      traditional: { robots: makeRobots(), metrics: makeMetrics(), remainingBoxes: TOTAL_BOXES, stackBoxes: [2, 2, 2] },
      proposed:    { robots: makeRobots(), metrics: makeMetrics(), remainingBoxes: TOTAL_BOXES, stackBoxes: [2, 2, 2], p2pLinks: [] },
    }),

  setSpeed: (s) => set({ speed: s }),

  killCloud:    () => set({ cloudKilled: true }),
  restoreCloud: () => set({ cloudKilled: false }),

  toggleBlockCell: (x, y) =>
    set((state) => {
      const next = new Set(state.blockedCells);
      const key = `${x},${y}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { blockedCells: next };
    }),

  setLatency: (ms) => set({ latencyMs: ms }),

  killRobot: (id) =>
    set((state) => {
      const next = new Set(state.killedRobots);
      next.add(id);
      return { killedRobots: next };
    }),

  reviveRobot: (id) =>
    set((state) => {
      const killed = new Set(state.killedRobots);
      killed.delete(id);
      const unresponsive = new Set(state.unresponsiveRobots);
      unresponsive.delete(id);
      return { killedRobots: killed, unresponsiveRobots: unresponsive };
    }),

  toggleRobotUnresponsive: (id) =>
    set((state) => {
      const next = new Set(state.unresponsiveRobots);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { unresponsiveRobots: next };
    }),

  decreaseRobotBattery: (id, amount) =>
    set((state) => ({
      traditional: {
        ...state.traditional,
        robots: state.traditional.robots.map((robot) =>
          robot.id === id ? { ...robot, battery: Math.max(0, robot.battery - amount) } : robot,
        ),
      },
      proposed: {
        ...state.proposed,
        robots: state.proposed.robots.map((robot) =>
          robot.id === id ? { ...robot, battery: Math.max(0, robot.battery - amount) } : robot,
        ),
      },
    })),

  setTick: (t) => set({ tick: t }),

  setTraditionalState: (robots, metrics, remainingBoxes, stackBoxes) =>
    set((s) => ({ traditional: { ...s.traditional, robots, metrics, remainingBoxes, stackBoxes } })),

  setProposedState: (robots, metrics, remainingBoxes, stackBoxes, p2pLinks) =>
    set({ proposed: { robots, metrics, remainingBoxes, stackBoxes, p2pLinks } }),
}));

// ─── Convenience re-exports ───────────────────────────────────────────────────

export { PICKUP_STATIONS, DROPOFF_STATIONS, CHARGING_STATIONS };
