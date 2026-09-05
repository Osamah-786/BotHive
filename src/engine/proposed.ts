import { aStar } from './astar';
import { findConflictingPairs, resolveRobotMoves } from './conflictResolution';
import {
  advanceTaskAfterArrival,
  beginCharging,
  cloneRobot,
  enterCharging,
  ENERGY_PER_TASK,
  LOW_BATTERY_THRESHOLD,
  MAX_TASKS,
  metricsAfterTick,
  navigationBlockedCells,
  reservedChargingStations,
  sameCell,
  selectChargingStation,
  taskTarget,
  applyKillState,
  applyTaskInheritance,
  applyCargoHandoffCleanup,
  applyDetectedFailureState,
  updatePeerHealth,
  finalizeBoxInventory,
  hasAvailablePickupBox,
} from './simulation';
import type { EngineResult } from './simulation';
import type { P2PLink, ProposedSideState, Robot } from './types';

export interface ProposedTickOptions {
  tick: number;
  blockedCells?: Set<string>;
  killedRobots?: Set<string>;
  unresponsiveRobots?: Set<string>;
  /** True when the warehouse power grid is down (chargers unavailable). */
  powerOutage?: boolean;
}

export interface ProposedTickResult extends EngineResult {
  p2pLinks: P2PLink[];
}

/**
 * Advances the decentralized model by one logical tick.
 * Every robot plans locally, predicts conflicts three steps ahead, and yields
 * according to the priority-token order: urgency → battery → oldest task.
 *
 * Robot failure handling (P2P self-healing):
 * - A killed robot freezes with state='killed'.
 * - An eligible robot detects a failed peer with unfinished work, then inherits
 *   that robot's station assignment and resumes from where it left off.
 */
export function proposedTick(
  side: ProposedSideState,
  {
    tick,
    blockedCells = new Set<string>(),
    killedRobots = new Set<string>(),
    unresponsiveRobots = new Set<string>(),
    powerOutage = false,
  }: ProposedTickOptions,
): ProposedTickResult {
  // ── Step 1: Exchange existing tick state as heartbeats and detect peers ───
  const withPeerHealth = updatePeerHealth(side.robots, tick, killedRobots, unresponsiveRobots);

  // ── Step 2: Apply permanent kill state ────────────────────────────────────
  // ── Step 3: Check for task inheritance opportunity ────────────────────────
  const failedPeerIds = new Set(
    withPeerHealth.flatMap((robot) =>
      Object.entries(robot.peerHealth ?? {})
        .filter(([, health]) => health.status === 'failed')
        .map(([peerId]) => peerId),
    ),
  );
  const withFailureState = applyDetectedFailureState(
    withPeerHealth,
    failedPeerIds,
    unresponsiveRobots,
    killedRobots,
  );
  const withInheritance = applyTaskInheritance(
    withFailureState,
    killedRobots,
    failedPeerIds,
    side.stackBoxes,
  );
  const withKillState = applyKillState(withInheritance, killedRobots);

  // Failed robots remain physically present at their last position. Keep those
  // cells in the same dynamic obstacle set used by A* and conflict resolution,
  // while leaving failed robots out of active movement decisions below.
  const occupiedCells = new Set(blockedCells);
  for (const robot of withKillState) {
    if (robot.state === 'killed' || robot.state === 'failed') {
      occupiedCells.add(`${robot.position.x},${robot.position.y}`);
    }
  }
  const chargingReservations = reservedChargingStations(withKillState);

  // ── Step 4: Prepare each robot's path for this tick ───────────────────────
  const planned = withKillState.map((source) =>
    unresponsiveRobots.has(source.id)
      ? cloneRobot(source)
      : prepareRobot(
          source,
          occupiedCells,
          tick,
          side.stackBoxes,
          side.remainingBoxes,
          chargingReservations,
          powerOutage,
        ),
  );

  // ── Step 5: Compute P2P communication links for rendering ─────────────────
  const links: P2PLink[] = [];
  const conflictPairs = findConflictingPairs(planned, 3, occupiedCells);
  const conflictPairKeys = new Set(
    conflictPairs.map(([first, second]) => `${first.id}:${second.id}`),
  );
  for (let left = 0; left < planned.length; left += 1) {
    for (let right = left + 1; right < planned.length; right += 1) {
      const first = planned[left];
      const second = planned[right];
      if (unresponsiveRobots.has(first.id) || unresponsiveRobots.has(second.id)) continue;
      const communicating = isWithinBroadcastRange(first, second);
      const pairKey = `${first.id}:${second.id}`;
      if (communicating || conflictPairKeys.has(pairKey)) {
        links.push({ from: first.id, to: second.id });
      }
    }
  }

  // ── Step 6: Resolve moves (skip killed robots — they don't move) ──────────
  const activePlanned = planned.filter(
    (r) => r.state !== 'killed' && r.state !== 'failed' && !unresponsiveRobots.has(r.id),
  );
  const inactivePlanned = planned.filter(
    (r) => r.state === 'killed' || r.state === 'failed' || unresponsiveRobots.has(r.id),
  );

  let resolvedActive: Robot[] = activePlanned;
  if (activePlanned.length > 0) {
    const resolution = resolveRobotMoves(activePlanned, {
      blockedCells: occupiedCells,
      tick,
      allowReroute: true,
      comparePriority,
      stackBoxes: side.stackBoxes,
    });
    resolvedActive = resolution.robots;
  }

  // Merge killed and intentionally unresponsive robots back unchanged.
  const resolvedMap = new Map(resolvedActive.map((r) => [r.id, r]));
  for (const inactive of inactivePlanned) resolvedMap.set(inactive.id, inactive);
  let resolved = side.robots.map((r) => resolvedMap.get(r.id) ?? r);

  // ── Step 7: Cargo handoff cleanup ─────────────────────────────────────────
  resolved = applyCargoHandoffCleanup(resolved);
  const inventory = finalizeBoxInventory(side.robots, resolved, side.remainingBoxes, side.stackBoxes);

  const conflictEvents = findConflictingPairs(activePlanned, 3, occupiedCells).length;

  return {
    robots: inventory.robots,
    metrics: metricsAfterTick(side.metrics, inventory.robots, conflictEvents, tick),
    remainingBoxes: inventory.remainingBoxes,
    stackBoxes: inventory.stackBoxes,
    p2pLinks: links,
  };
}


function prepareRobot(
  source: Robot,
  blockedCells: Set<string>,
  tick: number,
  stackBoxes: number[],
  remainingBoxes: number,
  chargingReservations: Set<number>,
  powerOutage: boolean,
): Robot {
  // Killed robots are frozen — no path planning, no movement.
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
      return enterCharging(robot);
    }
    if (robot.path.length === 0) {
      const station = selectChargingStation(robot, blockedCells, chargingReservations);
      if (station?.index !== robot.chargingStationIndex) {
        return station
          ? (() => {
              chargingReservations.add(station.index);
              return { ...robot, chargingStationIndex: station.index, path: station.path };
            })()
          : { ...robot, state: 'waiting', path: [] };
      }
      return {
        ...robot,
        path: station?.path ?? [],
      };
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
  if (remainingBoxes <= 0 && source.task === 'pickup' && !source.rescueFromPosition) {
    return { ...source, state: 'frozen', path: [] };
  }

  // A reconnected robot whose unfinished task is already covered must remain
  // parked until recovery ownership is released; otherwise it could duplicate
  // the coverer's work.
  if (source.state === 'frozen' && source.tasksCompleted < MAX_TASKS) {
    return { ...source, path: [] };
  }

  if (source.tasksCompleted >= MAX_TASKS) {
    return { ...source, state: 'frozen', path: [], coveringForRobotId: undefined };
  }
  if (source.task === 'pickup' && !source.rescueFromPosition && source.battery < ENERGY_PER_TASK) {
    return { ...source, state: 'frozen', path: [] };
  }

  let robot = cloneRobot(source);

  if (sameCell(robot.position, taskTarget(robot)) && robot.path.length === 0) {
    if (robot.rescueFromPosition) {
      // ── Rescue pickup: arrived at the death position ───────────────────
      // We are just picking up stranded cargo. Switch to dropoff mode and clear
      // rescue location. DO NOT call advanceTaskAfterArrival.
      robot = { ...robot, task: 'dropoff', rescueFromPosition: undefined };
    } else if (robot.task === 'pickup' && !hasAvailablePickupBox(robot, stackBoxes)) {
      return { ...robot, state: 'frozen', path: [] };
    } else {
      robot = advanceTaskAfterArrival(robot, tick);
    }
  }

  if (robot.task === 'pickup' && robot.path.length === 0 && !hasAvailablePickupBox(robot, stackBoxes)) {
    return { ...robot, state: 'frozen', path: [] };
  }

  // ── Local path planning ───────────────────────────────────────────────────
  // Runs every tick; a new obstacle or cleared rescueFromPosition propagates
  // immediately because taskTarget() is called fresh here.
  const needsPath =
    robot.tasksCompleted < MAX_TASKS &&
    (robot.path.length === 0 ||
      robot.path.some((cell) => blockedCells.has(`${cell.x},${cell.y}`)));

  if (needsPath) {
    const newPath = aStar(
      robot.position,
      taskTarget(robot),
      navigationBlockedCells(robot, blockedCells),
    );
    // If no path found, keep the robot waiting in place — don't let it oscillate.
    if (newPath.length === 0 && !sameCell(robot.position, taskTarget(robot))) {
      return { ...robot, path: [], state: 'waiting' };
    }
    robot = { ...robot, path: newPath };
  }

  // If a coverer finishes all tasks, clear its coverage so it can cover another
  if (robot.tasksCompleted >= MAX_TASKS && robot.coveringForRobotId !== undefined) {
    robot = { ...robot, coveringForRobotId: undefined };
  }

  return robot;
}

function isWithinBroadcastRange(first: Robot, second: Robot): boolean {
  const distance =
    Math.abs(first.position.x - second.position.x) +
    Math.abs(first.position.y - second.position.y);
  return distance <= 10;
}

/** Positive means first wins; timestamps prefer the robot waiting longer. */
function comparePriority(first: Robot, second: Robot): number {
  if (first.urgency !== second.urgency) return first.urgency - second.urgency;
  if (first.battery !== second.battery) return first.battery - second.battery;
  if (first.timestamp !== second.timestamp) return second.timestamp - first.timestamp;
  return second.id.localeCompare(first.id);
}
