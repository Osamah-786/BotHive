import { aStar } from './astar';
import { findConflictingPairs, resolveRobotMoves } from './conflictResolution';
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
  resolved = applyCargoHandoffCleanup(resolved);

  const conflictEvents = findConflictingPairs(activePlanned, 3, blockedCells).length;

  return {
    robots: resolved,
    metrics: metricsAfterTick(side.metrics, resolved, conflictEvents, tick),
    p2pLinks: links,
  };
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
