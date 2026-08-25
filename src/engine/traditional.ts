import { aStar, type GridPos } from './astar';
import {
  advanceTaskAfterArrival,
  cloneRobot,
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
  const planned = side.robots.map((source) => prepareRobot(source, shouldPlan, tick));
  const yielding = new Set<string>();
  const blockedByAisle = new Set(
    planned
      .filter((robot) => {
        const next = robot.path[0];
        return next !== undefined && blockedCells.has(`${next.x},${next.y}`);
      })
      .map((robot) => robot.id),
  );
  let conflictEvents = 0;

  for (let left = 0; left < planned.length; left++) {
    for (let right = left + 1; right < planned.length; right++) {
      const first = planned[left];
      const second = planned[right];
      const firstNext = first.path[0];
      const secondNext = second.path[0];
      if (!firstNext || !secondNext) continue;

      const sameDestination = sameCell(firstNext, secondNext);
      const swappingCells =
        sameCell(firstNext, second.position) && sameCell(secondNext, first.position);
      if (!sameDestination && !swappingCells) continue;

      conflictEvents += 1;
      const winner = first.id.localeCompare(second.id) <= 0 ? first : second;
      const loser = winner === first ? second : first;
      yielding.add(loser.id);
    }
  }

  const robots = planned.map((robot) =>
    yielding.has(robot.id) || blockedByAisle.has(robot.id)
      ? waitForTurn(robot, conflictEvents > 0)
      : moveOneCell(robot, tick),
  );

  return { robots, metrics: metricsAfterTick(side.metrics, robots, conflictEvents, tick) };
}

function prepareRobot(
  source: Robot,
  shouldPlan: boolean,
  tick: number,
): Robot {
  let robot = cloneRobot(source);
  const target = taskTarget(robot);

  // At a station, immediately assign the next leg of the pickup → dropoff cycle.
  if (sameCell(robot.position, target) && robot.path.length === 0) {
    robot = advanceTaskAfterArrival(robot, tick);
  }

  if (shouldPlan && robot.path.length === 0) {
    // The centralized cloud is intentionally unaware of newly blocked aisles.
    // It keeps dispatching its last known warehouse map; when a robot reaches an
    // injected obstacle, the blocked next waypoint remains in its route and it
    // waits there until the aisle is cleared instead of locally rerouting.
    robot = { ...robot, path: aStar(robot.position, taskTarget(robot)) };
  }

  return robot;
}

function waitForTurn(robot: Robot, hadConflict: boolean): Robot {
  return {
    ...robot,
    state: 'waiting',
    idleTime: robot.idleTime + 1,
    conflictsResolved: robot.conflictsResolved + (hadConflict ? 1 : 0),
  };
}

function moveOneCell(robot: Robot, tick: number): Robot {
  const next: GridPos | undefined = robot.path[0];
  if (!next) {
    return { ...robot, state: 'waiting', idleTime: robot.idleTime + 1 };
  }

  let moved: Robot = {
    ...robot,
    position: { ...next },
    path: robot.path.slice(1),
    state: 'moving',
    battery: Math.max(0, robot.battery - 0.5),
  };

  if (sameCell(moved.position, taskTarget(moved))) {
    moved = advanceTaskAfterArrival(moved, tick);
  }

  return moved;
}
