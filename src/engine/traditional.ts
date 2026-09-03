import { aStar } from './astar';
import { resolveRobotMoves } from './conflictResolution';
import {
  advanceTaskAfterArrival,
  cloneRobot,
  MAX_TASKS,
  metricsAfterTick,
  sameCell,
  taskTarget,
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
 *
 * When a robot is individually killed, the cloud model cannot self-heal:
 * the dead robot stays frozen and its tasks are abandoned (cloud doesn't
 * redistribute work), contrasting starkly with the P2P model's behaviour.
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

  const shouldPlan = tick % Math.max(1, plannerInterval) === 0;
  const planned = side.robots.map((source) => prepareRobot(source, shouldPlan, tick, killedRobots));
  const resolved = resolveRobotMoves(planned, {
    blockedCells,
    tick,
    horizon: 1,
    allowReroute: false,
    comparePriority: (first, second) => second.id.localeCompare(first.id),
  });

  return { robots: resolved.robots, metrics: metricsAfterTick(side.metrics, resolved.robots, resolved.conflictEvents, tick) };
}

function prepareRobot(
  source: Robot,
  shouldPlan: boolean,
  tick: number,
  killedRobots: Set<string>,
): Robot {
  // A killed robot stays frozen — the centralized cloud cannot detect or
  // redistribute its work. This is the critical contrast with the P2P model.
  if (killedRobots.has(source.id)) {
    return { ...cloneRobot(source), state: 'killed', path: [] };
  }

  if (source.tasksCompleted >= MAX_TASKS) {
    return { ...source, state: 'frozen', path: [] };
  }

  let robot = cloneRobot(source);
  const target = taskTarget(robot);

  // At a station, immediately assign the next leg of the pickup → dropoff cycle.
  if (sameCell(robot.position, target) && robot.path.length === 0) {
    robot = advanceTaskAfterArrival(robot, tick);
  }

  if (shouldPlan && robot.path.length === 0 && robot.tasksCompleted < MAX_TASKS) {
    // The centralized cloud is intentionally unaware of newly blocked aisles.
    // It keeps dispatching its last known warehouse map; when a robot reaches an
    // injected obstacle, the blocked next waypoint remains in its route and it
    // waits there until the aisle is cleared instead of locally rerouting.
    robot = { ...robot, path: aStar(robot.position, taskTarget(robot)) };
  }

  return robot;
}
