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
}

export interface ProposedTickResult extends EngineResult {
  p2pLinks: P2PLink[];
}

/**
 * Advances the decentralized model by one logical tick.
 * Every robot plans locally, predicts conflicts three steps ahead, and yields
 * according to the priority-token order: urgency → battery → oldest task.
 */
export function proposedTick(
  side: ProposedSideState,
  { tick, blockedCells = new Set<string>() }: ProposedTickOptions,
): ProposedTickResult {
  const planned = side.robots.map((source) => prepareRobot(source, blockedCells, tick));
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

  const resolved = resolveRobotMoves(planned, {
    blockedCells,
    tick,
    allowReroute: true,
    comparePriority,
  });

  return {
    robots: resolved.robots,
    metrics: metricsAfterTick(side.metrics, resolved.robots, resolved.conflictEvents, tick),
    p2pLinks: links,
  };
}

function prepareRobot(source: Robot, blockedCells: Set<string>, tick: number): Robot {
  if (source.tasksCompleted >= MAX_TASKS) return { ...source, state: 'frozen', path: [] };

  let robot = cloneRobot(source);
  if (sameCell(robot.position, taskTarget(robot)) && robot.path.length === 0) {
    robot = advanceTaskAfterArrival(robot, tick);
  }

  // Local planning runs every tick, so a new obstacle is propagated immediately.
  if (robot.tasksCompleted < MAX_TASKS && (robot.path.length === 0 || robot.path.some((cell) => blockedCells.has(`${cell.x},${cell.y}`)))) {
    robot = { ...robot, path: aStar(robot.position, taskTarget(robot), blockedCells) };
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
