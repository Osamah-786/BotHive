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
  // A robot in rescue mode must first reach the death position of the killed
  // robot to "pick up" the stranded cargo before heading to the dropoff station.
  if (robot.rescueFromPosition) return robot.rescueFromPosition;
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

export const MAX_TASKS = 6;

export function advanceTaskAfterArrival(robot: Robot, tick: number): Robot {
  const arrivedAtDropoff = robot.task === 'dropoff';
  const newTasksCompleted = robot.tasksCompleted + (arrivedAtDropoff ? 1 : 0);

  if (newTasksCompleted >= MAX_TASKS) {
    return {
      ...robot,
      path: [],
      tasksCompleted: newTasksCompleted,
      state: 'frozen',
      battery: 100,
    };
  }

  return {
    ...robot,
    task: arrivedAtDropoff ? 'pickup' : 'dropoff',
    path: [],
    urgency: urgencyFor(robot.id, tick),
    // Simulation ticks are deterministic; this timestamp is a stable tiebreaker.
    timestamp: tick * BASE_TICK_MS,
    tasksCompleted: newTasksCompleted,
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

/**
 * Applies permanent kill state. Once a robot is in killedRobots it stays
 * killed for the duration of the session. Only Restart can clear it.
 * Task progress is always preserved so the covering robot inherits correctly.
 */
export function applyKillState(robots: Robot[], killedRobots: Set<string>): Robot[] {
  return robots.map((robot) => {
    if (!killedRobots.has(robot.id)) return robot;
    // Newly killed: freeze in place, preserve task progress, clear path.
    // Already killed: just ensure state is right (idempotent).
    if (robot.state !== 'killed') {
      return { ...cloneRobot(robot), state: 'killed', path: [] };
    }
    return { ...robot, state: 'killed', path: [] };
  });
}

/**
 * Task inheritance: self-healing fallback.
 *
 * When a robot is killed, the first robot in the fleet that has completed
 * ALL of its own tasks (MAX_TASKS) and isn't already covering will inherit
 * the killed robot's station assignment and remaining work.
 *
 * Cargo-aware handoff:
 * - Killed on the PICKUP leg (no stock yet) → coverer goes straight to the
 *   pickup station as usual.
 * - Killed on the DROPOFF leg (carrying stock) → coverer first navigates to
 *   the death position to "collect" the stranded cargo (rescueFromPosition),
 *   then delivers to the dropoff station, then resumes normal cycles.
 */
export function applyTaskInheritance(robots: Robot[], killedRobots: Set<string>): Robot[] {
  const killedWithWork = robots.filter((r) => killedRobots.has(r.id) && r.tasksCompleted < MAX_TASKS);
  if (killedWithWork.length === 0) return robots;

  const alreadyCovered = new Set(
    robots.filter((r) => r.coveringForRobotId !== undefined).map((r) => r.coveringForRobotId!),
  );

  const eligibleCoverers = robots.filter(
    (r) => !killedRobots.has(r.id) && r.tasksCompleted >= MAX_TASKS && r.coveringForRobotId === undefined,
  );

  if (eligibleCoverers.length === 0) return robots;

  const result = robots.map((r) => ({ ...r }));
  const uncoveredKilled = killedWithWork.filter((kr) => !alreadyCovered.has(kr.id));

  for (const killedRobot of uncoveredKilled) {
    if (eligibleCoverers.length === 0) break;
    const coverer = eligibleCoverers.shift()!;

    const covererIndex = result.findIndex((r) => r.id === coverer.id);
    if (covererIndex === -1) continue;

    const wasCarryingStock = killedRobot.task === 'dropoff';

    result[covererIndex] = {
      ...result[covererIndex],
      stationIndex: killedRobot.stationIndex,
      tasksCompleted: killedRobot.tasksCompleted,
      coveringForRobotId: killedRobot.id,
      path: [],
      state: 'moving',
      task: wasCarryingStock ? 'pickup' : killedRobot.task,
      rescueFromPosition: wasCarryingStock
        ? { x: killedRobot.position.x, y: killedRobot.position.y }
        : undefined,
    };
  }

  return result;
}

/**
 * Sync covered robots.
 * 1. Cargo handoff: If a coverer picks up stranded cargo, update the killed robot to 'pickup'.
 * 2. Progress sync: Keep the killed robot's tasksCompleted in sync with the coverer.
 *    This ensures that if the coverer finishes and moves on to cover a THIRD robot,
 *    the first killed robot's rack remains visually completed.
 */
export function applyCargoHandoffCleanup(robots: Robot[]): Robot[] {
  const activeCoverers = new Map(
    robots.filter((r) => r.coveringForRobotId).map((r) => [r.coveringForRobotId!, r]),
  );
  return robots.map((robot) => {
    if (robot.state === 'killed') {
      const coverer = activeCoverers.get(robot.id);
      if (coverer) {
        let updated = robot;
        // Sync progress back so it persists if the coverer leaves
        if (coverer.tasksCompleted > robot.tasksCompleted) {
          updated = { ...updated, tasksCompleted: coverer.tasksCompleted };
        }
        // Cargo handoff
        if (robot.task === 'dropoff' && !coverer.rescueFromPosition) {
          updated = { ...updated, task: 'pickup' };
        }
        return updated;
      }
    }
    return robot;
  });
}
