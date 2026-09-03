import { aStar } from './astar';
import { findConflictingPairs, resolveRobotMoves } from './conflictResolution';
import {
  advanceTaskAfterArrival,
  cloneRobot,
  MAX_TASKS,
  metricsAfterTick,
  sameCell,
  taskTarget,
} from './simulation';
import type { EngineResult } from './simulation';
import type { P2PLink, ProposedSideState, Robot } from './types';

export interface ProposedTickOptions {
  tick: number;
  blockedCells?: Set<string>;
  killedRobots?: Set<string>;
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
 * - The first robot that finishes ALL its own tasks (MAX_TASKS) detects there
 *   is a killed peer whose tasks are incomplete, then inherits that robot's
 *   stationIndex and remaining task count — resuming from exactly where the
 *   killed robot left off.
 */
export function proposedTick(
  side: ProposedSideState,
  { tick, blockedCells = new Set<string>(), killedRobots = new Set<string>() }: ProposedTickOptions,
): ProposedTickResult {
  // ── Step 1: Apply permanent kill state ────────────────────────────────────
  const withKillState = applyKillState(side.robots, killedRobots);

  // ── Step 2: Check for task inheritance opportunity ────────────────────────
  const withInheritance = applyTaskInheritance(withKillState, killedRobots);

  // ── Step 3: Prepare each robot's path for this tick ───────────────────────
  const planned = withInheritance.map((source) => prepareRobot(source, blockedCells, tick));

  // ── Step 4: Compute P2P communication links for rendering ─────────────────
  const links: P2PLink[] = [];
  const conflictPairs = findConflictingPairs(planned, 3, blockedCells);
  const conflictPairKeys = new Set(
    conflictPairs.map(([first, second]) => `${first.id}:${second.id}`),
  );
  for (let left = 0; left < planned.length; left += 1) {
    for (let right = left + 1; right < planned.length; right += 1) {
      const first = planned[left];
      const second = planned[right];
      const communicating = isWithinBroadcastRange(first, second);
      const pairKey = `${first.id}:${second.id}`;
      if (communicating || conflictPairKeys.has(pairKey)) {
        links.push({ from: first.id, to: second.id });
      }
    }
  }

  // ── Step 5: Resolve moves (skip killed robots — they don't move) ──────────
  const activePlanned = planned.filter((r) => r.state !== 'killed');
  const killedPlanned = planned.filter((r) => r.state === 'killed');

  let resolvedActive: Robot[] = activePlanned;
  if (activePlanned.length > 0) {
    const resolution = resolveRobotMoves(activePlanned, {
      blockedCells,
      tick,
      allowReroute: true,
      comparePriority,
    });
    resolvedActive = resolution.robots;
  }

  // Merge killed robots back (they stay in place)
  const resolvedMap = new Map(resolvedActive.map((r) => [r.id, r]));
  for (const kr of killedPlanned) resolvedMap.set(kr.id, kr);
  let resolved = side.robots.map((r) => resolvedMap.get(r.id) ?? r);

  // ── Step 6: Cargo handoff cleanup ─────────────────────────────────────────
  // If a coverer was rescuing stranded cargo, the moment it picks it up 
  // (rescueFromPosition clears), the killed robot must drop its cargo state
  // (switch to 'pickup') so we don't have duplicated stock.
  const activeCoverers = new Map(
    resolved.filter((r) => r.coveringForRobotId).map((r) => [r.coveringForRobotId!, r]),
  );
  resolved = resolved.map((robot) => {
    if (robot.state === 'killed' && robot.task === 'dropoff') {
      const coverer = activeCoverers.get(robot.id);
      // If a coverer exists and is no longer in rescue transit, the cargo is transferred!
      if (coverer && !coverer.rescueFromPosition) {
        return { ...robot, task: 'pickup' };
      }
    }
    return robot;
  });

  const conflictEvents = findConflictingPairs(activePlanned, 3, blockedCells).length;

  return {
    robots: resolved,
    metrics: metricsAfterTick(side.metrics, resolved, conflictEvents, tick),
    p2pLinks: links,
  };
}

/**
 * Applies permanent kill state. Once a robot is in killedRobots it stays
 * killed for the duration of the session. Only Restart can clear it.
 * Task progress is always preserved so the covering robot inherits correctly.
 */
function applyKillState(robots: Robot[], killedRobots: Set<string>): Robot[] {
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
 * Task inheritance: P2P self-healing.
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
function applyTaskInheritance(robots: Robot[], killedRobots: Set<string>): Robot[] {
  // Find killed robots whose tasks haven't all been completed
  const killedWithWork = robots.filter(
    (r) => killedRobots.has(r.id) && r.tasksCompleted < MAX_TASKS,
  );

  if (killedWithWork.length === 0) return robots;

  // Find the killed robot IDs that are already being covered by someone
  const alreadyCovered = new Set(
    robots.filter((r) => r.coveringForRobotId !== undefined).map((r) => r.coveringForRobotId!),
  );

  // Robots that have finished their own tasks and aren't covering yet
  const eligibleCoverers = robots.filter(
    (r) =>
      !killedRobots.has(r.id) &&
      r.tasksCompleted >= MAX_TASKS &&
      r.coveringForRobotId === undefined,
  );

  if (eligibleCoverers.length === 0) return robots;

  // Pair each uncovered killed robot with an eligible coverer (greedy)
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

      // ── Cargo-aware handoff ──────────────────────────────────────────────
      // If the killed robot was carrying stock (on the dropoff leg), the coverer
      // must first travel to the death position to "collect" the stranded cargo.
      // task stays 'pickup' so advanceTaskAfterArrival won't count a phantom
      // delivery; once the coverer arrives, it transitions to 'dropoff' naturally.
      //
      // If the killed robot had no stock yet (on the pickup leg), just inherit
      // the task directly — coverer heads to the pickup station as normal.
      task: wasCarryingStock ? 'pickup' : killedRobot.task,
      rescueFromPosition: wasCarryingStock
        ? { x: killedRobot.position.x, y: killedRobot.position.y }
        : undefined,
    };
  }

  return result;
}

function prepareRobot(source: Robot, blockedCells: Set<string>, tick: number): Robot {
  // Killed robots are frozen — no path planning, no movement.
  if (source.state === 'killed') return { ...source, path: [] };

  if (source.tasksCompleted >= MAX_TASKS && source.coveringForRobotId === undefined) {
    return { ...source, state: 'frozen', path: [] };
  }

  let robot = cloneRobot(source);

  if (sameCell(robot.position, taskTarget(robot)) && robot.path.length === 0) {
    if (robot.rescueFromPosition) {
      // ── Rescue pickup: arrived at the death position ───────────────────
      // We are just picking up stranded cargo. Switch to dropoff mode and clear
      // rescue location. DO NOT call advanceTaskAfterArrival.
      robot = { ...robot, task: 'dropoff', rescueFromPosition: undefined };
    } else {
      robot = advanceTaskAfterArrival(robot, tick);
    }
  }

  // ── Local path planning ───────────────────────────────────────────────────
  // Runs every tick; a new obstacle or cleared rescueFromPosition propagates
  // immediately because taskTarget() is called fresh here.
  const needsPath =
    robot.tasksCompleted < MAX_TASKS &&
    (robot.path.length === 0 ||
      robot.path.some((cell) => blockedCells.has(`${cell.x},${cell.y}`)));

  if (needsPath) {
    const newPath = aStar(robot.position, taskTarget(robot), blockedCells);
    // If no path found, keep the robot waiting in place — don't let it oscillate.
    if (newPath.length === 0 && !sameCell(robot.position, taskTarget(robot))) {
      return { ...robot, path: [], state: 'waiting' };
    }
    robot = { ...robot, path: newPath };
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
