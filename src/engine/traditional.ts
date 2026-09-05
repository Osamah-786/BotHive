import { aStar } from './astar';
import { resolveRobotMoves } from './conflictResolution';
import {
  advanceTaskAfterArrival,
  beginCharging,
  cloneRobot,
  isWorkFinished,
  LOW_BATTERY_THRESHOLD,
  MAX_TASKS,
  metricsAfterTick,
  navigationBlockedCells,
  originalHomePosition,
  reservedChargingStations,
  sameCell,
  selectChargingStation,
  taskTarget,
  applyKillState,
  applyTaskInheritance,
  applyCargoHandoffCleanup,
  finalizeBoxInventory,
  hasAvailablePickupBox,
} from './simulation';
import type { EngineResult } from './simulation';
import type { Robot, SideState } from './types';

export interface TraditionalTickOptions {
  tick: number;
  blockedCells?: Set<string>;
  cloudKilled?: boolean;
  killedRobots?: Set<string>;
  /** True when the warehouse power grid is down (chargers unavailable). */
  powerOutage?: boolean;
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
    powerOutage = false,
    plannerInterval = 1,
  }: TraditionalTickOptions,
): EngineResult {
  if (cloudKilled) {
    const robots = side.robots.map((robot) => ({
      ...cloneRobot(robot),
      state: 'frozen' as const,
      idleTime: robot.idleTime + 1,
    }));
    return {
      robots,
      metrics: metricsAfterTick(side.metrics, robots, 0, tick),
      remainingBoxes: side.remainingBoxes,
      stackBoxes: [...side.stackBoxes],
    };
  }

  const withInheritance = applyTaskInheritance(side.robots, killedRobots, new Set(), side.stackBoxes);
  const withKillState = applyKillState(withInheritance, killedRobots);

  const occupiedCells = new Set(blockedCells);
  for (const robot of withKillState) {
    if (robot.state === 'killed' || robot.state === 'failed') {
      occupiedCells.add(`${robot.position.x},${robot.position.y}`);
    }
  }
  const chargingReservations = reservedChargingStations(withKillState);

  const shouldPlan = tick % Math.max(1, plannerInterval) === 0;
  
  // Separate out killed from active
  const activeInheritance = withKillState.filter(
    (r) => r.state !== 'killed' && r.state !== 'failed',
  );
  const killedPlanned = withKillState.filter(
    (r) => r.state === 'killed' || r.state === 'failed',
  );
  
  const planned = activeInheritance.map((source) =>
    prepareRobot(
      source,
      shouldPlan,
      tick,
      occupiedCells,
      side.stackBoxes,
      side.remainingBoxes,
      chargingReservations,
      powerOutage,
    ),
  );
  
  let resolvedActive = planned;
  let conflictEvents = 0;
  if (planned.length > 0) {
    const resolution = resolveRobotMoves(planned, {
      blockedCells: occupiedCells,
      tick,
      horizon: 1,
      allowReroute: false,
      comparePriority: (first, second) => second.id.localeCompare(first.id),
      stackBoxes: side.stackBoxes,
    });
    resolvedActive = resolution.robots;
    conflictEvents = resolution.conflictEvents;
  }

  // Merge killed robots back
  const resolvedMap = new Map(resolvedActive.map((r) => [r.id, r]));
  for (const kr of killedPlanned) resolvedMap.set(kr.id, kr);
  let resolved = side.robots.map((r) => resolvedMap.get(r.id) ?? r);

  resolved = applyCargoHandoffCleanup(resolved);
  const inventory = finalizeBoxInventory(side.robots, resolved, side.remainingBoxes, side.stackBoxes);

  return {
    robots: inventory.robots,
    metrics: metricsAfterTick(side.metrics, inventory.robots, conflictEvents, tick),
    remainingBoxes: inventory.remainingBoxes,
    stackBoxes: inventory.stackBoxes,
  };
}

function prepareRobot(
  source: Robot,
  shouldPlan: boolean,
  tick: number,
  blockedCells: Set<string>,
  stackBoxes: number[],
  remainingBoxes: number,
  chargingReservations: Set<number>,
  powerOutage: boolean,
): Robot {
  if (source.state === 'killed' || source.state === 'failed') return { ...source, path: [] };
  if (source.state === 'charging') return source;

  // Power outage: robots en route to a charger abandon the charge attempt
  // and enter power-saving mode (waiting) — they do not enter a charger.
  if (powerOutage && source.state === 'goingToCharge') {
    return { ...source, state: 'waiting', chargingStationIndex: undefined, path: [] };
  }

  if (source.state === 'goingToCharge') {
    const robot = cloneRobot(source);
    if (sameCell(robot.position, taskTarget(robot)) && robot.path.length === 0) {
      return { ...robot, state: 'charging' };
    }
    if (robot.path.length === 0) {
      const station = selectChargingStation(robot, blockedCells, chargingReservations);
      return station
        ? (() => {
            chargingReservations.add(station.index);
            return { ...robot, chargingStationIndex: station.index, path: station.path };
          })()
        : { ...robot, state: 'waiting', path: [] };
    }
    return robot;
  }
  if (
    !powerOutage &&
    source.battery <= LOW_BATTERY_THRESHOLD &&
    source.task === 'pickup' &&
    !source.rescueFromPosition
  ) {
    const station = selectChargingStation(source, blockedCells, chargingReservations);
    return station
      ? (() => {
          chargingReservations.add(station.index);
          return { ...beginCharging(source, station.index), path: station.path };
        })()
      : { ...source, state: 'waiting', path: [] };
  }

  if (isWorkFinished(source, remainingBoxes, stackBoxes)) {
    const home = originalHomePosition(source);
    if (sameCell(source.position, home)) {
      return {
        ...source,
        state: 'frozen',
        path: [],
        coveringForRobotId: undefined,
      };
    }
    let robot = cloneRobot(source);
    robot.coveringForRobotId = undefined;
    robot.state = 'moving';
    if (shouldPlan && (robot.path.length === 0 || !sameCell(robot.path[robot.path.length - 1], home))) {
      robot.path = aStar(robot.position, home, navigationBlockedCells(robot, blockedCells));
    }
    return robot;
  }

  let robot = cloneRobot(source);
  const target = taskTarget(robot);

  // At a station, immediately assign the next leg of the pickup → dropoff cycle.
  if (sameCell(robot.position, target) && robot.path.length === 0) {
    if (robot.rescueFromPosition) {
      robot = { ...robot, task: 'dropoff', rescueFromPosition: undefined };
    } else if (
      robot.task === 'pickup' &&
      robot.pendingTransportTask === undefined &&
      !hasAvailablePickupBox(robot, stackBoxes)
    ) {
      return { ...robot, state: 'frozen', path: [] };
    } else {
      robot = advanceTaskAfterArrival(robot, tick);
    }

    if (
      robot.task === 'pickup' &&
      robot.pendingTransportTask === undefined &&
      robot.path.length === 0 &&
      !hasAvailablePickupBox(robot, stackBoxes)
    ) {
      return { ...robot, state: 'frozen', path: [] };
    }
  }

  if (shouldPlan && robot.path.length === 0 && robot.tasksCompleted < MAX_TASKS) {
    // The centralized cloud is intentionally unaware of newly blocked aisles.
    // It keeps dispatching its last known warehouse map; when a robot reaches an
    // injected obstacle, the blocked next waypoint remains in its route and it
    // waits there until the aisle is cleared instead of locally rerouting.
    robot = {
      ...robot,
      path: aStar(robot.position, taskTarget(robot), navigationBlockedCells(robot, blockedCells)),
    };
  }

  // If a coverer finishes all tasks, clear its coverage so it can cover another
  if (robot.tasksCompleted >= MAX_TASKS && robot.coveringForRobotId !== undefined) {
    robot = { ...robot, coveringForRobotId: undefined };
  }

  return robot;
}
