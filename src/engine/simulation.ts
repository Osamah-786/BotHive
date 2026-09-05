import { aStar, type GridPos } from './astar';
import type { PeerHealth, Robot, SimMetrics } from './types';
import { CHARGING_STATIONS, DROPOFF_STATIONS, PICKUP_STATIONS } from './warehouse';

/** Duration of one logical simulation step at 1× speed. */
export const BASE_TICK_MS = 200;
export const HEARTBEAT_SUSPECT_TICKS = 2;
export const HEARTBEAT_TIMEOUT_TICKS = 5;

export interface EngineResult {
  robots: Robot[];
  metrics: SimMetrics;
  remainingBoxes: number;
  stackBoxes: number[];
}

export function cellKey(position: GridPos): string {
  return `${position.x},${position.y}`;
}

export function sameCell(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function taskTarget(robot: Robot): GridPos {
  if (
    (robot.state === 'goingToCharge' || robot.state === 'charging') &&
    robot.chargingStationIndex !== undefined
  ) {
    return CHARGING_STATIONS[robot.chargingStationIndex];
  }
  // A robot in rescue mode must first reach the death position of the killed
  // robot to "pick up" the stranded cargo before heading to the dropoff station.
  if (robot.rescueFromPosition) return robot.rescueFromPosition;
  if (robot.pendingTransportTask) {
    return robot.task === 'pickup'
      ? robot.pendingTransportTask.pickup
      : robot.pendingTransportTask.dropoff;
  }
  const stations = robot.task === 'pickup' ? PICKUP_STATIONS : DROPOFF_STATIONS;
  return stations[robot.stationIndex];
}

/**
  * Derives the robot's immutable original home starting position from its ID.
  * R1 -> P1 (PICKUP_STATIONS[0]), R2 -> P2 (PICKUP_STATIONS[1]), R3 -> P3 (PICKUP_STATIONS[2]).
  */
export function originalHomePosition(robot: Robot): GridPos {
  const index = Math.max(0, parseInt(robot.id.replace(/\D/g, ''), 10) - 1);
  return PICKUP_STATIONS[index] ?? PICKUP_STATIONS[0];
}

/**
  * Evaluates whether a robot has completed all active work and should return to start.
  */
export function isWorkFinished(
  robot: Robot,
  remainingBoxes: number,
  stackBoxes: number[],
): boolean {
  if (robot.rescueFromPosition !== undefined) return false;
  if (robot.returningHomeAfterTransport) return true;
  if (robot.pendingTransportTask !== undefined) return false;
  if (robot.task === 'dropoff') return false;
  if (robot.tasksCompleted >= MAX_TASKS) return true;
  if (remainingBoxes <= 0) return true;
  if (robot.battery < ENERGY_PER_TASK) return true;
  if (!hasAvailablePickupBox(robot, stackBoxes)) return true;
  return false;
}


export const LOW_BATTERY_THRESHOLD = 20;
export const CHARGE_TARGET_BATTERY = 100;
export const CHARGE_RATE_PER_TICK = 10;

export function selectChargingStation(
  robot: Robot,
  blockedCells: Set<string>,
  reservedStations: Set<number> = new Set(),
): { index: number; path: GridPos[] } | undefined {
  const routes = CHARGING_STATIONS.map((station, index) => ({
    index,
    path: aStar(robot.position, station, navigationBlockedCells(robot, blockedCells)),
  })).filter(
    ({ path, index }) =>
      (index === robot.chargingStationIndex || !reservedStations.has(index)) &&
      (path.length > 0 || sameCell(robot.position, CHARGING_STATIONS[index])),
  );

  return routes.sort((first, second) => first.path.length - second.path.length)[0];
}

export function reservedChargingStations(robots: Robot[]): Set<number> {
  return new Set(
    robots
      .filter(
        (robot) =>
          robot.state !== 'killed' &&
          robot.state !== 'failed' &&
          (robot.state === 'goingToCharge' || robot.state === 'charging') &&
          robot.chargingStationIndex !== undefined,
      )
      .map((robot) => robot.chargingStationIndex!),
  );
}

export function beginCharging(robot: Robot, stationIndex: number): Robot {
  return {
    ...robot,
    state: 'goingToCharge',
    chargingStationIndex: stationIndex,
    path: [],
  };
}

export function enterCharging(robot: Robot): Robot {
  return { ...robot, state: 'charging', path: [] };
}

export function advanceCharging(robot: Robot): Robot {
  if (robot.state !== 'charging') return robot;
  const battery = Math.min(CHARGE_TARGET_BATTERY, robot.battery + CHARGE_RATE_PER_TICK);
  return battery >= CHARGE_TARGET_BATTERY
    ? { ...robot, battery, state: 'moving', chargingStationIndex: undefined, path: [] }
    : { ...robot, battery, path: [] };
}

export function hasAvailablePickupBox(robot: Robot, stackBoxes: number[]): boolean {
  return (stackBoxes[robot.stationIndex] ?? 0) > 0;
}

/** Only the designated cargo rescuer may enter its failed peer's cell. */
export function navigationBlockedCells(robot: Robot, blockedCells: Set<string>): Set<string> {
  if (!robot.coveringForRobotId || !robot.rescueFromPosition) return blockedCells;
  const rescuerBlockedCells = new Set(blockedCells);
  rescuerBlockedCells.delete(cellKey(robot.rescueFromPosition));
  return rescuerBlockedCells;
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
    peerHealth: robot.peerHealth
      ? Object.fromEntries(
          Object.entries(robot.peerHealth).map(([id, health]) => [
            id,
            {
              ...health,
              lastKnownPosition: { ...health.lastKnownPosition },
            },
          ]),
        )
      : {},
  };
}

/**
 * Exchanges the existing per-tick robot state as a heartbeat and evaluates
 * peer liveness independently for every robot.
 */
export function updatePeerHealth(
  robots: Robot[],
  tick: number,
  killedRobots: Set<string>,
  unresponsiveRobots: Set<string> = new Set(),
): Robot[] {
  return robots.map((robot) => {
    const peerHealth: Record<string, PeerHealth> = { ...(robot.peerHealth ?? {}) };

    for (const peer of robots) {
      if (peer.id === robot.id) continue;

      const previous = peerHealth[peer.id];
      const responding =
        !killedRobots.has(peer.id) &&
        !unresponsiveRobots.has(peer.id) &&
        peer.state !== 'killed';
      if (responding) {
        peerHealth[peer.id] = {
          lastSeenTick: tick,
          lastHeartbeatSeq: tick,
          lastKnownPosition: { ...peer.position },
          lastKnownState: peer.state,
          status: 'online',
        };
        continue;
      }

      const lastSeenTick = previous?.lastSeenTick ?? Math.max(0, tick - 1);
      const missedTicks = tick - lastSeenTick;
      peerHealth[peer.id] = {
        lastSeenTick,
        lastHeartbeatSeq: previous?.lastHeartbeatSeq ?? 0,
        lastKnownPosition: previous?.lastKnownPosition ?? { ...peer.position },
        lastKnownState: peer.state,
        status:
          missedTicks >= HEARTBEAT_TIMEOUT_TICKS
            ? 'failed'
            : missedTicks >= HEARTBEAT_SUSPECT_TICKS
              ? 'suspected'
              : 'online',
      };
    }

    return { ...robot, peerHealth };
  });
}

export function applyDetectedFailureState(
  robots: Robot[],
  failedPeerIds: Set<string>,
  unresponsiveRobots: Set<string>,
  killedRobots: Set<string>,
): Robot[] {
  return robots.map((robot) => {
    if (killedRobots.has(robot.id)) return robot;
    if (unresponsiveRobots.has(robot.id) && failedPeerIds.has(robot.id)) {
      return { ...robot, state: 'failed', path: [] };
    }
    if (!unresponsiveRobots.has(robot.id) && robot.state === 'failed') {
      const taskRecoveredByPeer = robots.some(
        (peer) => peer.coveringForRobotId === robot.id,
      );
      return {
        ...robot,
        state: taskRecoveredByPeer ? 'frozen' : 'moving',
        path: [],
        peerHealth: {},
      };
    }
    return robot;
  });
}

export const MAX_TASKS = 10;
export const TOTAL_BOXES = 6;
export const ENERGY_PER_TASK = 100 / MAX_TASKS;

function consumeTaskEnergy(battery: number): number {
  const nextBattery = Math.max(0, Math.min(100, battery - ENERGY_PER_TASK));
  return nextBattery < 0.000001 ? 0 : nextBattery;
}

export function advanceTaskAfterArrival(robot: Robot, tick: number): Robot {
  const arrivedAtDropoff = robot.task === 'dropoff';
  const newTasksCompleted = robot.tasksCompleted + (arrivedAtDropoff ? 1 : 0);
  const completedTransportTask = arrivedAtDropoff && robot.pendingTransportTask !== undefined;

  return {
    ...robot,
    task: arrivedAtDropoff ? 'pickup' : 'dropoff',
    path: [],
    pendingTransportTask: completedTransportTask ? undefined : robot.pendingTransportTask,
    returningHomeAfterTransport: completedTransportTask ? true : robot.returningHomeAfterTransport,
    urgency: urgencyFor(robot.id, tick),
    // Simulation ticks are deterministic; this timestamp is a stable tiebreaker.
    timestamp: tick * BASE_TICK_MS,
    tasksCompleted: newTasksCompleted,
    // Energy is consumed once, only when the box is delivered.
    battery: arrivedAtDropoff ? consumeTaskEnergy(robot.battery) : robot.battery,
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
 * Consumes boxes completed during this tick and stops the fleet when the
 * finite physical inventory is exhausted. A positive task-count delta is one
 * delivered box; recovery progress is not counted as a new delivery.
 */
export function finalizeBoxInventory(
  previousRobots: Robot[],
  robots: Robot[],
  remainingBoxes: number,
  stackBoxes: number[],
): { robots: Robot[]; remainingBoxes: number; stackBoxes: number[] } {
  const previousById = new Map(previousRobots.map((robot) => [robot.id, robot]));
  const completedThisTick = robots.reduce((total, robot) => {
    // Failed/killed robots mirror coverer progress for rendering and recovery
    // persistence; that mirrored delta is not another physical delivery.
    if (robot.state === 'killed' || robot.state === 'failed') return total;
    const previous = previousById.get(robot.id);
    return total + Math.max(0, robot.tasksCompleted - (previous?.tasksCompleted ?? robot.tasksCompleted));
  }, 0);
  const customCompletedThisTick = robots.reduce((total, robot) => {
    if (robot.state === 'killed' || robot.state === 'failed') return total;
    const previous = previousById.get(robot.id);
    return total + (
      previous?.pendingTransportTask !== undefined &&
      robot.pendingTransportTask === undefined &&
      robot.tasksCompleted > (previous?.tasksCompleted ?? robot.tasksCompleted)
        ? 1
        : 0
    );
  }, 0);
  const fixedCompletedThisTick = Math.max(0, completedThisTick - customCompletedThisTick);
  const nextRemaining = Math.max(0, remainingBoxes - fixedCompletedThisTick);
  const nextStackBoxes = [...stackBoxes];
  for (const robot of robots) {
    if (robot.state === 'killed' || robot.state === 'failed') continue;
    const previous = previousById.get(robot.id);
    const completed = Math.max(0, robot.tasksCompleted - (previous?.tasksCompleted ?? robot.tasksCompleted));
    const customCompleted =
      previous?.pendingTransportTask !== undefined &&
      robot.pendingTransportTask === undefined &&
      robot.tasksCompleted > (previous?.tasksCompleted ?? robot.tasksCompleted);
    if (completed > 0 && !customCompleted) {
      nextStackBoxes[robot.stationIndex] = Math.max(
        0,
        (nextStackBoxes[robot.stationIndex] ?? 0) - completed,
      );
    }
  }
  if (nextRemaining > 0) return { robots, remainingBoxes: nextRemaining, stackBoxes: nextStackBoxes };

  return {
    robots: robots.map((robot) => {
      if (robot.state === 'killed' || robot.state === 'failed') return robot;

      // With no source inventory left, only an in-progress drop-off (or cargo
      // rescue) may continue. Pickup work must not start another cycle.
      const activeDropoff = robot.task === 'dropoff' || robot.rescueFromPosition !== undefined;
      if (activeDropoff) return robot;
      const home = originalHomePosition(robot);
      return sameCell(robot.position, home)
        ? { ...robot, state: 'frozen', path: [], coveringForRobotId: undefined }
        : robot;
    }),
    remainingBoxes: 0,
    stackBoxes: nextStackBoxes,
  };
}

/**
 * Applies the current manual kill state and restores a robot when the
 * corresponding failure injection is cleared.
 * Task progress is always preserved so the covering robot inherits correctly.
 */
export function applyKillState(robots: Robot[], killedRobots: Set<string>): Robot[] {
  return robots.map((robot) => {
    if (!killedRobots.has(robot.id)) {
      if (robot.state !== 'killed') return robot;
      const taskRecoveredByPeer = robots.some(
        (peer) => peer.coveringForRobotId === robot.id,
      );
      return {
        ...robot,
        state: taskRecoveredByPeer ? 'frozen' : 'moving',
        path: [],
        peerHealth: {},
      };
    }
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
 * When a robot is killed or detected failed, an eligible robot that is not
 * already covering will inherit the failed robot's station assignment and
 * remaining work.
 *
 * Cargo-aware handoff:
 * - Killed on the PICKUP leg (no stock yet) → coverer goes straight to the
 *   pickup station as usual.
 * - Killed on the DROPOFF leg (carrying stock) → coverer first navigates to
 *   the death position to "collect" the stranded cargo (rescueFromPosition),
 *   then delivers to the dropoff station, then resumes normal cycles.
 */
export function applyTaskInheritance(
  robots: Robot[],
  killedRobots: Set<string>,
  failedRobots: Set<string> = new Set(),
  stackBoxes: number[] = [],
): Robot[] {
  const failedWithWork = robots.filter(
    (r) =>
      (killedRobots.has(r.id) || failedRobots.has(r.id)) &&
      (r.pendingTransportTask !== undefined ||
        r.task === 'dropoff' ||
        (r.task === 'pickup' && (stackBoxes[r.stationIndex] ?? 0) > 0)),
  );
  if (failedWithWork.length === 0) return robots;

  const alreadyCovered = new Set(
    robots.filter((r) => r.coveringForRobotId !== undefined).map((r) => r.coveringForRobotId!),
  );

  const result = robots.map((r) => ({ ...r }));
  const uncoveredFailed = failedWithWork.filter((failed) => !alreadyCovered.has(failed.id));

  for (const failedRobot of uncoveredFailed) {
    const eligibleCoverers = result.filter(
      (r) =>
        r.id !== failedRobot.id &&
        !killedRobots.has(r.id) &&
        !failedRobots.has(r.id) &&
        r.state !== 'goingToCharge' &&
        r.state !== 'charging' &&
        r.task !== 'dropoff' &&
        r.rescueFromPosition === undefined &&
        r.battery >= ENERGY_PER_TASK &&
        (stackBoxes[r.stationIndex] ?? 0) === 0 &&
        (r.state === 'moving' ||
          r.state === 'waiting' ||
          (r.state === 'frozen' && r.task === 'pickup' && !r.rescueFromPosition)) &&
        r.coveringForRobotId === undefined,
    );
    const coverer = chooseRecoveryRobot(eligibleCoverers, failedRobot);
    if (!coverer) continue;

    const covererIndex = result.findIndex((r) => r.id === coverer.id);
    if (covererIndex === -1) continue;

    const wasCarryingStock = failedRobot.task === 'dropoff';

    result[covererIndex] = {
      ...result[covererIndex],
      stationIndex: failedRobot.stationIndex,
      coveringForRobotId: failedRobot.id,
      path: [],
      state: 'moving',
      task: wasCarryingStock ? 'pickup' : failedRobot.task,
      pendingTransportTask: failedRobot.pendingTransportTask
        ? {
            pickup: { ...failedRobot.pendingTransportTask.pickup },
            dropoff: { ...failedRobot.pendingTransportTask.dropoff },
          }
        : undefined,
      rescueFromPosition: wasCarryingStock
        ? { x: failedRobot.position.x, y: failedRobot.position.y }
        : undefined,
    };
  }

  return result;
}

function chooseRecoveryRobot(candidates: Robot[], failedRobot: Robot): Robot | undefined {
  return [...candidates].sort((first, second) => {
    const firstCost = recoveryCost(first, failedRobot);
    const secondCost = recoveryCost(second, failedRobot);
    if (firstCost !== secondCost) return firstCost - secondCost;
    if (first.battery !== second.battery) return second.battery - first.battery;
    if (first.urgency !== second.urgency) return second.urgency - first.urgency;
    return first.id.localeCompare(second.id);
  })[0];
}

function recoveryCost(candidate: Robot, failedRobot: Robot): number {
  const target = failedRobot.rescueFromPosition ?? taskTarget(failedRobot);
  return (
    Math.abs(candidate.position.x - target.x) +
    Math.abs(candidate.position.y - target.y)
  );
}

/**
 * If a coverer picks up stranded cargo, update the failed robot to 'pickup'.
 */
export function applyCargoHandoffCleanup(robots: Robot[]): Robot[] {
  const activeCoverers = new Map(
    robots.filter((r) => r.coveringForRobotId).map((r) => [r.coveringForRobotId!, r]),
  );
  return robots.map((robot) => {
    if (robot.state === 'killed' || robot.state === 'failed') {
      const coverer = activeCoverers.get(robot.id);
      if (coverer) {
        let updated = robot;
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
