import { aStar } from './astar';
import { resolveRobotMoves } from './conflictResolution';
import {
  advanceTaskAfterArrival,
  cloneRobot,
  MAX_TASKS,
  metricsAfterTick,
  sameCell,
  taskTarget,
  applyKillState,
  applyTaskInheritance,
  applyCargoHandoffCleanup,
} from './simulation';
import type { EngineResult } from './simulation';
import type { Robot, SideState } from './types';

export interface TraditionalTickOptions {
  tick: number;
  blockedCells?: Set<string>;
  cloudKilled?: boolean;
  killedRobots?: Set<string>;
  /** The centralized planner only refreshes routes on these tick boundaries. */
  plannerInterval?: number;
}

/**
 * Advances the centralized-cloud model by one logical tick.
 *
 * Static robot-ID priority deliberately models the basic stop-and-wait policy:
 * R1 always wins over R2, which always wins over R3.
 */
export function traditionalTick(
  side: SideState,
  {
    tick,
    blockedCells = new Set<string>(),
    cloudKilled = false,
    killedRobots = new Set<string>(),
    plannerInterval = 1,
  }: TraditionalTickOptions,
): EngineResult {
  if (cloudKilled) {
    const robots = side.robots.map((robot) => ({
      ...cloneRobot(robot),
      state: 'frozen' as const,
      idleTime: robot.idleTime + 1,
    }));
    return { robots, metrics: metricsAfterTick(side.metrics, robots, 0, tick) };
  }

  const withKillState = applyKillState(side.robots, killedRobots);
  const withInheritance = applyTaskInheritance(withKillState, killedRobots);

  const shouldPlan = tick % Math.max(1, plannerInterval) === 0;
  
  // Separate out killed from active
  const activeInheritance = withInheritance.filter((r) => r.state !== 'killed');
  const killedPlanned = withInheritance.filter((r) => r.state === 'killed');
  
  const planned = activeInheritance.map((source) => prepareRobot(source, shouldPlan, tick));
  
  let resolvedActive = planned;
  let conflictEvents = 0;
  if (planned.length > 0) {
    const resolution = resolveRobotMoves(planned, {
      blockedCells,
      tick,
      horizon: 1,
      allowReroute: false,
      comparePriority: (first, second) => second.id.localeCompare(first.id),
    });
    resolvedActive = resolution.robots;
    conflictEvents = resolution.conflictEvents;
  }

  // Merge killed robots back
  const resolvedMap = new Map(resolvedActive.map((r) => [r.id, r]));
  for (const kr of killedPlanned) resolvedMap.set(kr.id, kr);
  let resolved = side.robots.map((r) => resolvedMap.get(r.id) ?? r);

  resolved = applyCargoHandoffCleanup(resolved);

  return { robots: resolved, metrics: metricsAfterTick(side.metrics, resolved, conflictEvents, tick) };
}

function prepareRobot(
  source: Robot,
  shouldPlan: boolean,
  tick: number,
): Robot {
  if (source.tasksCompleted >= MAX_TASKS && source.coveringForRobotId === undefined) {
    return { ...source, state: 'frozen', path: [] };
  }

  let robot = cloneRobot(source);
  const target = taskTarget(robot);

  // At a station, immediately assign the next leg of the pickup → dropoff cycle.
  if (sameCell(robot.position, target) && robot.path.length === 0) {
    if (robot.rescueFromPosition) {
      robot = { ...robot, task: 'dropoff', rescueFromPosition: undefined };
    } else {
      robot = advanceTaskAfterArrival(robot, tick);
    }
  }

  if (shouldPlan && robot.path.length === 0 && robot.tasksCompleted < MAX_TASKS) {
    // The centralized cloud is intentionally unaware of newly blocked aisles.
    // It keeps dispatching its last known warehouse map; when a robot reaches an
    // injected obstacle, the blocked next waypoint remains in its route and it
    // waits there until the aisle is cleared instead of locally rerouting.
    robot = { ...robot, path: aStar(robot.position, taskTarget(robot)) };
  }

  // If a coverer finishes all tasks, clear its coverage so it can cover another
  if (robot.tasksCompleted >= MAX_TASKS && robot.coveringForRobotId !== undefined) {
    robot = { ...robot, coveringForRobotId: undefined };
  }

  return robot;
}
