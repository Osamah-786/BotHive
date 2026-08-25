import type { GridPos } from './astar';
import type { Robot, SimMetrics } from './types';
import { DROPOFF_STATIONS, PICKUP_STATIONS } from './warehouse';

/** Duration of one logical simulation step at 1× speed. */
export const BASE_TICK_MS = 200;

export interface EngineResult {
  robots: Robot[];
  metrics: SimMetrics;
}

export function cellKey(position: GridPos): string {
  return `${position.x},${position.y}`;
}

export function sameCell(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function taskTarget(robot: Robot): GridPos {
  const stations = robot.task === 'pickup' ? PICKUP_STATIONS : DROPOFF_STATIONS;
  return stations[robot.stationIndex];
}

/**
 * A deterministic urgency score keeps identical restarts comparable on both sides.
 * It changes for every newly assigned leg while avoiding random work inside ticks.
 */
export function urgencyFor(robotId: string, tick: number): number {
  const idValue = robotId.charCodeAt(robotId.length - 1) || 0;
  return ((tick * 37 + idValue * 17) % 100) / 100;
}

export function cloneRobot(robot: Robot): Robot {
  return {
    ...robot,
    position: { ...robot.position },
    path: robot.path.map((waypoint) => ({ ...waypoint })),
  };
}

export function advanceTaskAfterArrival(robot: Robot, tick: number): Robot {
  const arrivedAtDropoff = robot.task === 'dropoff';

  return {
    ...robot,
    task: arrivedAtDropoff ? 'pickup' : 'dropoff',
    path: [],
    urgency: urgencyFor(robot.id, tick),
    // Simulation ticks are deterministic; this timestamp is a stable tiebreaker.
    timestamp: tick * BASE_TICK_MS,
    tasksCompleted: robot.tasksCompleted + (arrivedAtDropoff ? 1 : 0),
    // Robots recharge fully when they complete a delivery cycle (dropped off).
    // This keeps the battery readout live and meaningful across long demo runs.
    battery: arrivedAtDropoff ? 100 : robot.battery,
  };
}

export function metricsAfterTick(
  previous: SimMetrics,
  robots: Robot[],
  conflictEvents: number,
  tick: number,
): SimMetrics {
  const totalTasksCompleted = robots.reduce((sum, robot) => sum + robot.tasksCompleted, 0);
  const totalIdleTime = robots.reduce((sum, robot) => sum + robot.idleTime, 0);
  const conflictCount = previous.conflictCount + conflictEvents;
  const history = previous.history;

  // History is consumed by Phase 5 charts. Keep it bounded from the outset.
  const shouldSample = tick % 5 === 0;
  const nextHistory = shouldSample
    ? [
        ...history.slice(-239),
        { tick, tasksCompleted: totalTasksCompleted, idleTime: totalIdleTime, conflicts: conflictCount },
      ]
    : history;

  return { totalTasksCompleted, totalIdleTime, conflictCount, history: nextHistory };
}
