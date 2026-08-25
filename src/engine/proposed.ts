import { aStar, type GridPos } from './astar';
import {
  advanceTaskAfterArrival,
  cloneRobot,
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
  const yielding = new Set<string>();
  const links: P2PLink[] = [];
  let conflictEvents = 0;

  for (let left = 0; left < planned.length; left++) {
    for (let right = left + 1; right < planned.length; right++) {
      const first = planned[left];
      const second = planned[right];
      const communicating = isWithinBroadcastRange(first, second);
      if (communicating) links.push({ from: first.id, to: second.id });
      if (!pathsConflictSoon(first, second)) continue;

      conflictEvents += 1;
      // A predicted collision promotes a direct peer exchange even out of range.
      if (!communicating) links.push({ from: first.id, to: second.id });
      const winner = comparePriority(first, second) >= 0 ? first : second;
      const loser = winner === first ? second : first;
      yielding.add(loser.id);
    }
  }

  const robots = planned.map((robot) =>
    yielding.has(robot.id)
      ? {
          ...robot,
          state: 'waiting' as const,
          idleTime: robot.idleTime + 1,
          conflictsResolved: robot.conflictsResolved + 1,
        }
      : moveOneCell(robot, tick),
  );

  return {
    robots,
    metrics: metricsAfterTick(side.metrics, robots, conflictEvents, tick),
    p2pLinks: links,
  };
}

function prepareRobot(source: Robot, blockedCells: Set<string>, tick: number): Robot {
  let robot = cloneRobot(source);
  if (sameCell(robot.position, taskTarget(robot)) && robot.path.length === 0) {
    robot = advanceTaskAfterArrival(robot, tick);
  }

  // Local planning runs every tick, so a new obstacle is propagated immediately.
  if (robot.path.length === 0 || robot.path.some((cell) => blockedCells.has(`${cell.x},${cell.y}`))) {
    robot = { ...robot, path: aStar(robot.position, taskTarget(robot), blockedCells) };
  }
  return robot;
}

function pathsConflictSoon(first: Robot, second: Robot): boolean {
  const firstFuture = lookAhead(first, 3);
  const secondFuture = lookAhead(second, 3);
  return firstFuture.some((cell, index) => sameCell(cell, secondFuture[index]));
}

function lookAhead(robot: Robot, steps: number): GridPos[] {
  const future: GridPos[] = [];
  let current = robot.position;
  for (let index = 0; index < steps; index++) {
    current = robot.path[index] ?? current;
    future.push(current);
  }
  return future;
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

function moveOneCell(robot: Robot, tick: number): Robot {
  const next = robot.path[0];
  if (!next) return { ...robot, state: 'waiting', idleTime: robot.idleTime + 1 };

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
