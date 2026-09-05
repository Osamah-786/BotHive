import { aStar, type GridPos } from './astar';
import {
  advanceTaskAfterArrival,
  advanceCharging,
  enterCharging,
  MAX_TASKS,
  hasAvailablePickupBox,
  navigationBlockedCells,
  sameCell,
  taskTarget,
} from './simulation';
import { isPassable, neighbours } from './warehouse';
import type { Robot } from './types';

/**
 * Short reservation horizon used by the coordination layer. Robots still
 * advance one grid cell per tick, but reserve a few future cells so a robot
 * cannot enter a conflict that is already visible a couple of steps away.
 */
export const RESERVATION_HORIZON = 3;

export interface ConflictResolutionOptions {
  blockedCells: Set<string>;
  tick: number;
  /** Higher values win. */
  comparePriority: (first: Robot, second: Robot) => number;
  /** P2P robots may ask A* for a route around a reserved cell. */
  allowReroute: boolean;
  /** Traditional cloud coordination intentionally only looks one step ahead. */
  horizon?: number;
  stackBoxes?: number[];
  /** True when the warehouse power grid is down — charging robots hold position without +10%/tick. */
  powerOutage?: boolean;
}

export interface ConflictResolutionResult {
  robots: Robot[];
  conflictEvents: number;
}

interface Reservation {
  robotId: string;
  trajectory: GridPos[];
}

interface MoveCandidate {
  position: GridPos;
  route: GridPos[];
  score: number;
}

/**
 * Resolves a tick atomically using prioritized space-time reservations.
 *
 * A reservation contains the robot's current cell plus its predicted cells
 * through the horizon. The resolver rejects both:
 *   1. two robots reserving the same cell at the same time; and
 *   2. two robots swapping cells in one tick.
 *
 * This is deliberately pure: all returned Robot objects are new values, so
 * the simulation loop can commit both sides together without render timing
 * affecting safety.
 */
export function resolveRobotMoves(
  plannedRobots: Robot[],
  options: ConflictResolutionOptions,
): ConflictResolutionResult {
  const horizon = options.horizon ?? RESERVATION_HORIZON;
  const predictedPairs = findConflictingPairs(plannedRobots, horizon, options.blockedCells);
  const conflictParticipants = new Set<string>();
  for (const [first, second] of predictedPairs) {
    conflictParticipants.add(first.id);
    conflictParticipants.add(second.id);
  }

  // The serialized cloud reservations can deadlock when two robots request
  // each other's current cells in the same tick. Use the existing joint
  // solver for that tick so priority can make one robot yield and re-plan.
  if (
    !options.allowReroute &&
    (hasDirectSwap(plannedRobots, options.blockedCells) || predictedPairs.length > 0)
  ) {
    return resolveCooperativeMoves(
      plannedRobots,
      { ...options, allowReroute: true },
      conflictParticipants,
      predictedPairs.length,
    );
  }

  // The decentralized side has peer visibility, so it can solve all three
  // moves together instead of making an isolated pairwise wait decision.
  // This is what breaks circular waits at a one-cell aisle or the bottom lane.
  if (options.allowReroute) {
    return resolveCooperativeMoves(
      plannedRobots,
      options,
      conflictParticipants,
      predictedPairs.length,
    );
  }

  const reservations: Reservation[] = [];
  const resolvedById = new Map<string, Robot>();
  const priorityOrder = [...plannedRobots].sort((first, second) =>
    options.comparePriority(second, first),
  );

  for (const robot of priorityOrder) {
    if (robot.state === 'charging') {
      reservations.push({ robotId: robot.id, trajectory: holdTrajectory(robot.position, horizon) });
      resolvedById.set(
        robot.id,
        options.powerOutage
          ? { ...robot, path: [] }
          : advanceCharging(robot),
      );
      continue;
    }
    if (robot.tasksCompleted >= MAX_TASKS) {
      reservations.push({ robotId: robot.id, trajectory: holdTrajectory(robot.position, horizon) });
      resolvedById.set(robot.id, { ...robot, state: 'frozen', path: [] });
      continue;
    }
    if (robot.returningHomeAfterTransport && sameCell(robot.position, taskTarget(robot))) {
      reservations.push({ robotId: robot.id, trajectory: holdTrajectory(robot.position, horizon) });
      resolvedById.set(robot.id, { ...robot, state: 'frozen', path: [] });
      continue;
    }

    const robotBlockedCells = navigationBlockedCells(robot, options.blockedCells);
    const route = usableRoute(robot.path, robotBlockedCells);
    const trajectory = buildTrajectory(robot, route, horizon, robotBlockedCells);
    const hasReservationConflict = conflictsWithReservations(trajectory, reservations);

    reservations.push({ robotId: robot.id, trajectory });
    resolvedById.set(
      robot.id,
      hasReservationConflict
        ? waitRobot(robot, conflictParticipants.has(robot.id))
        : advanceRobot(robot, route, robotBlockedCells, options.tick, options.stackBoxes),
    );
  }

  const resolvedRobots = plannedRobots.map((robot) => resolvedById.get(robot.id) ?? robot);

  // A lower-priority robot may be allowed to leave its cell before a higher-
  // priority follower enters it. If that lower-priority robot was later
  // forced to wait by another reservation, cancel the follower's move here.
  // This final atomic check is the last line of defence against overlap.
  return {
    robots: enforceUniquePositions(plannedRobots, resolvedRobots, conflictParticipants),
    conflictEvents: predictedPairs.length,
  };
}

/**
 * Chooses a safe joint action for the full P2P fleet. With three robots this
 * is tiny (at most 5³ candidate combinations), but it handles dependency
 * chains that pairwise reservation cannot: A may enter B's cell only when B
 * leaves it, and B may leave only when C clears the next cell.
 */
function resolveCooperativeMoves(
  robots: Robot[],
  options: ConflictResolutionOptions,
  conflictParticipants: Set<string>,
  conflictEvents: number,
): ConflictResolutionResult {
  const priorityOrder = [...robots].sort((first, second) =>
    options.comparePriority(second, first),
  );
  const priorityWeight = new Map(
    priorityOrder.map((robot, index) => [robot.id, robots.length - index]),
  );
  const candidates = robots.map((robot) =>
    buildMoveCandidates(robot, robots, options.blockedCells, priorityWeight.get(robot.id) ?? 1),
  );
  const selected = chooseJointMoves(robots, candidates);

  const resolved = robots.map((robot, index) => {
    if (robot.state === 'charging') {
      return options.powerOutage
        ? { ...robot, path: [] }
        : advanceCharging(robot);
    }
    if (robot.tasksCompleted >= MAX_TASKS) return { ...robot, state: 'frozen' as const, path: [] };
    if (robot.returningHomeAfterTransport && sameCell(robot.position, taskTarget(robot))) {
      return { ...robot, state: 'frozen' as const, path: [] };
    }
    const candidate = selected[index];
    if (!candidate || sameCell(candidate.position, robot.position)) {
      return waitRobot(robot, conflictParticipants.has(robot.id));
    }
    return advanceRobot(
      robot,
      candidate.route,
      navigationBlockedCells(robot, options.blockedCells),
      options.tick,
      options.stackBoxes,
    );
  });

  return {
    robots: enforceUniquePositions(robots, resolved, conflictParticipants),
    conflictEvents,
  };
}

function buildMoveCandidates(
  robot: Robot,
  robots: Robot[],
  blockedCells: Set<string>,
  priorityWeight: number,
): MoveCandidate[] {
  if (robot.tasksCompleted >= MAX_TASKS) {
    return [{ position: { ...robot.position }, route: [], score: 0 }];
  }

  const robotBlockedCells = navigationBlockedCells(robot, blockedCells);
  const target = taskTarget(robot);
  const currentDistance = routeDistance(robot.position, target, robotBlockedCells);
  const others = new Set(robotBlockedCells);
  for (const other of robots) {
    if (other.id !== robot.id) others.add(cellKey(other.position));
  }

  const candidates: MoveCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (position: GridPos, preferredRoute?: GridPos[]) => {
    const key = cellKey(position);
    if (seen.has(key)) return;
    seen.add(key);

    if (sameCell(position, robot.position)) {
      candidates.push({ position: { ...position }, route: robot.path, score: -1 });
      return;
    }

    const localRoute = preferredRoute ?? routeFromMove(position, target, others, robotBlockedCells);
    const nextDistance = routeDistance(position, target, robotBlockedCells);
    const progress = currentDistance - nextDistance;
    const isPreferred = robot.path[0] !== undefined && sameCell(position, robot.path[0]);
    candidates.push({
      position: { ...position },
      route: localRoute,
      // Progress decides who gets a contested route; the movement bonus lets a
      // lower-priority robot temporarily reverse to clear a blocked aisle.
      // A legal retreat must beat waiting when robots face one another in a
      // one-cell corridor; otherwise both robots can remain waiting forever.
      score: Math.max(0, 2 + progress * 10 * priorityWeight) +
        (isPreferred ? 4 * priorityWeight : 0),
    });
  };

  const primary = robot.path[0];

  // If there is no planned path and the robot isn't at its target, it is
  // completely blocked (A* found no route). Only offer staying in place so
  // the cooperative solver doesn't score random neighbor moves and cause jitter.
  if (!primary && !sameCell(robot.position, target)) {
    return [{ position: { ...robot.position }, route: [], score: -1 }];
  }

  if (primary && isPassable(primary.x, primary.y, robotBlockedCells)) {
    addCandidate(primary, usableRoute(robot.path, robotBlockedCells));
  }
  for (const neighbour of neighbours(robot.position.x, robot.position.y)) {
    if (isPassable(neighbour.x, neighbour.y, robotBlockedCells)) addCandidate(neighbour);
  }
  addCandidate(robot.position);
  return candidates;
}

function routeFromMove(
  position: GridPos,
  target: GridPos,
  temporaryBlocks: Set<string>,
  blockedCells: Set<string>,
): GridPos[] {
  if (sameCell(position, target)) return [position];
  const detour = aStar(position, target, temporaryBlocks);
  const fallback = detour.length > 0 ? detour : aStar(position, target, blockedCells);
  return [{ ...position }, ...fallback];
}

function routeDistance(position: GridPos, target: GridPos, blockedCells: Set<string>): number {
  if (sameCell(position, target)) return 0;
  const path = aStar(position, target, blockedCells);
  return path.length > 0 ? path.length : 1_000;
}

function chooseJointMoves(robots: Robot[], candidatesByRobot: MoveCandidate[][]): MoveCandidate[] {
  let best: MoveCandidate[] | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  const selected: MoveCandidate[] = [];

  const search = (index: number, score: number) => {
    if (index === robots.length) {
      if (score > bestScore) {
        bestScore = score;
        best = [...selected];
      }
      return;
    }

    for (const candidate of candidatesByRobot[index]) {
      if (!isCompatibleMove(robots[index], candidate, robots, selected)) continue;
      selected.push(candidate);
      search(index + 1, score + candidate.score);
      selected.pop();
    }
  };

  search(0, 0);
  return best ?? robots.map((robot) => ({ position: { ...robot.position }, route: robot.path, score: -1 }));
}

function isCompatibleMove(
  robot: Robot,
  candidate: MoveCandidate,
  robots: Robot[],
  selected: MoveCandidate[],
): boolean {
  for (let index = 0; index < selected.length; index += 1) {
    const other = robots[index];
    const otherCandidate = selected[index];
    if (sameCell(candidate.position, otherCandidate.position)) return false;
    if (
      sameCell(candidate.position, other.position) &&
      sameCell(otherCandidate.position, robot.position)
    ) {
      return false;
    }
  }
  return true;
}

/** Returns each pair whose predicted trajectories intersect in space-time. */
export function findConflictingPairs(
  robots: Robot[],
  horizon: number,
  blockedCells: Set<string>,
): [Robot, Robot][] {
  const pairs: [Robot, Robot][] = [];
  for (let left = 0; left < robots.length; left += 1) {
    for (let right = left + 1; right < robots.length; right += 1) {
      const first = robots[left];
      const second = robots[right];
      const firstTrajectory = buildTrajectory(
      first,
      usableRoute(first.path, navigationBlockedCells(first, blockedCells)),
      horizon,
      navigationBlockedCells(first, blockedCells),
      );
      const secondTrajectory = buildTrajectory(
      second,
      usableRoute(second.path, navigationBlockedCells(second, blockedCells)),
      horizon,
      navigationBlockedCells(second, blockedCells),
      );
      if (trajectoriesConflict(firstTrajectory, secondTrajectory)) pairs.push([first, second]);
    }
  }
  return pairs;
}

function usableRoute(path: GridPos[], blockedCells: Set<string>): GridPos[] {
  const firstBlocked = path.findIndex((cell) => blockedCells.has(cellKey(cell)));
  return firstBlocked === -1 ? path : path.slice(0, firstBlocked);
}

function buildTrajectory(
  robot: Robot,
  route: GridPos[],
  horizon: number,
  blockedCells: Set<string>,
): GridPos[] {
  const trajectory: GridPos[] = [{ ...robot.position }];
  let current = robot.position;
  for (let step = 0; step < horizon; step += 1) {
    const next = route[step];
    if (!next || blockedCells.has(cellKey(next))) {
      trajectory.push({ ...current });
      continue;
    }
    current = next;
    trajectory.push({ ...current });
  }
  return trajectory;
}

function holdTrajectory(position: GridPos, horizon: number): GridPos[] {
  return Array.from({ length: horizon + 1 }, () => ({ ...position }));
}

function conflictsWithReservations(trajectory: GridPos[], reservations: Reservation[]): boolean {
  return reservations.some((reservation) => trajectoriesConflict(trajectory, reservation.trajectory));
}

function trajectoriesConflict(first: GridPos[], second: GridPos[]): boolean {
  const length = Math.min(first.length, second.length);
  for (let step = 0; step < length; step += 1) {
    if (sameCell(first[step], second[step])) return true;
    if (
      step > 0 &&
      sameCell(first[step - 1], second[step]) &&
      sameCell(first[step], second[step - 1])
    ) {
      return true;
    }

  }
  return false;
}

function hasDirectSwap(robots: Robot[], blockedCells: Set<string>): boolean {
  for (let left = 0; left < robots.length; left += 1) {
    for (let right = left + 1; right < robots.length; right += 1) {
      const first = robots[left];
      const second = robots[right];
      const firstRoute = usableRoute(first.path, navigationBlockedCells(first, blockedCells));
      const secondRoute = usableRoute(second.path, navigationBlockedCells(second, blockedCells));
      const firstNext = firstRoute[0];
      const secondNext = secondRoute[0];
      if (
        firstNext &&
        secondNext &&
        sameCell(firstNext, second.position) &&
        sameCell(secondNext, first.position)
      ) {
        return true;
      }
    }
  }
  return false;
}

function advanceRobot(
  robot: Robot,
  route: GridPos[],
  blockedCells: Set<string>,
  tick: number,
  stackBoxes?: number[],
): Robot {
  const next = route[0];
  if (!next || blockedCells.has(cellKey(next))) {
    if (robot.state === 'goingToCharge' && sameCell(robot.position, taskTarget(robot))) {
      return enterCharging(robot);
    }
    return waitRobot(robot, false);
  }

  let moved: Robot = {
    ...robot,
    position: { ...next },
    path: route.slice(1),
    state: robot.state === 'goingToCharge' ? 'goingToCharge' : 'moving',
  };

  if (sameCell(moved.position, taskTarget(moved))) {
    if (moved.state === 'goingToCharge') {
      moved = enterCharging(moved);
    } else if (moved.rescueFromPosition) {
      // ── Rescue pickup: arrived at the death position ───────────────────
      // This is NOT a completed task — the coverer is merely picking up the
      // stranded cargo the killed robot was carrying. Switch to dropoff mode
      // and clear the rescue waypoint immediately so the next A* call targets
      // the real dropoff station. DO NOT call advanceTaskAfterArrival (that
      // would phantom-increment tasksCompleted).
      moved = { ...moved, task: 'dropoff', rescueFromPosition: undefined, path: [] };
    } else if (moved.returningHomeAfterTransport) {
      moved = { ...moved, state: 'frozen', path: [] };
    } else if (
      moved.task === 'pickup' &&
      moved.pendingTransportTask === undefined &&
      stackBoxes &&
      !hasAvailablePickupBox(moved, stackBoxes)
    ) {
      moved = { ...moved, state: 'frozen', path: [] };
    } else {
      moved = advanceTaskAfterArrival(moved, tick);
    }
  }
  return moved;
}

function waitRobot(robot: Robot, hadConflict: boolean): Robot {
  return {
    ...robot,
    state: robot.tasksCompleted >= MAX_TASKS ? 'frozen' : 'waiting',
    idleTime: robot.idleTime + 1,
    conflictsResolved: robot.conflictsResolved + (hadConflict ? 1 : 0),
  };
}

function enforceUniquePositions(
  plannedRobots: Robot[],
  resolvedRobots: Robot[],
  conflictParticipants: Set<string>,
): Robot[] {
  const byCell = new Map<string, Robot[]>();
  for (const robot of resolvedRobots) {
    const key = cellKey(robot.position);
    const occupants = byCell.get(key) ?? [];
    occupants.push(robot);
    byCell.set(key, occupants);
  }

  const sourceById = new Map(plannedRobots.map((robot) => [robot.id, robot]));
  const corrected = new Map(resolvedRobots.map((robot) => [robot.id, robot]));
  for (const occupants of byCell.values()) {
    if (occupants.length < 2) continue;

    // A robot that stayed in place owns that cell. Otherwise retain the
    // highest-priority result and stop all other movers at their source cell.
    const stationary = occupants.find((robot) => {
      const source = sourceById.get(robot.id);
      return source !== undefined && sameCell(source.position, robot.position);
    });
    const keeper = stationary ?? occupants[0];
    for (const occupant of occupants) {
      if (occupant.id === keeper.id) continue;
      const source = sourceById.get(occupant.id);
      if (!source) continue;
      corrected.set(
        occupant.id,
        waitRobot(source, conflictParticipants.has(occupant.id)),
      );
    }
  }
  return plannedRobots.map((robot) => corrected.get(robot.id) ?? robot);
}

function cellKey(position: GridPos): string {
  return `${position.x},${position.y}`;
}
