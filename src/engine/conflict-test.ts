import { resolveRobotMoves } from './conflictResolution';
import type { Robot } from './types';

function robot(
  id: string,
  x: number,
  y: number,
  path: { x: number; y: number }[],
  urgency: number,
  stationIndex = 0,
): Robot {
  return {
    id,
    color: '#ffffff',
    position: { x, y },
    path,
    task: 'dropoff',
    stationIndex,
    battery: 100,
    urgency,
    timestamp: 0,
    state: 'moving',
    conflictsResolved: 0,
    idleTime: 0,
    tasksCompleted: 0,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ ${message}`);
}

function assertUnique(robots: Robot[], message: string): void {
  const cells = robots.map((candidate) => `${candidate.position.x},${candidate.position.y}`);
  assert(new Set(cells).size === cells.length, message);
}

const noBlocks = new Set<string>();
const priority = (first: Robot, second: Robot) => first.urgency - second.urgency;

// Two robots request the same cell: the higher-priority robot owns it.
const sameDestination = resolveRobotMoves(
  [
    robot('R1', 5, 2, [{ x: 6, y: 2 }], 0.9),
    robot('R2', 7, 2, [{ x: 6, y: 2 }], 0.1),
  ],
  { blockedCells: noBlocks, tick: 1, horizon: 1, allowReroute: false, comparePriority: priority },
);
assertUnique(sameDestination.robots, 'same-destination resolution produced an overlap');
assert(sameDestination.robots[0].state === 'moving', 'winner did not advance into the reserved cell');
assert(sameDestination.robots[1].state === 'waiting', 'loser did not yield the reserved cell');

// A head-on swap is rejected even though the two next cells differ.
const headOnSwap = resolveRobotMoves(
  [
    robot('R1', 5, 2, [{ x: 6, y: 2 }], 0.9),
    robot('R2', 6, 2, [{ x: 5, y: 2 }], 0.1),
  ],
  { blockedCells: noBlocks, tick: 1, horizon: 1, allowReroute: false, comparePriority: priority },
);
assertUnique(headOnSwap.robots, 'head-on swap produced an overlap');
assert(headOnSwap.robots.every((candidate) => candidate.state === 'waiting'), 'head-on swap was not stopped');

// A safe convoy is allowed to advance: the follower enters the leader's
// previous cell only after the leader has reserved its next cell.
const convoy = resolveRobotMoves(
  [
    robot('R1', 5, 10, [{ x: 6, y: 10 }, { x: 7, y: 10 }], 0.9, 2),
    robot('R2', 6, 10, [{ x: 7, y: 10 }, { x: 8, y: 10 }], 0.1, 2),
  ],
  { blockedCells: noBlocks, tick: 1, horizon: 3, allowReroute: false, comparePriority: priority },
);
assertUnique(convoy.robots, 'safe convoy produced an overlap');
assert(convoy.robots.every((candidate) => candidate.state === 'moving'), 'safe convoy was deadlocked');

// A three-robot dependency in the lower transfer lane is solved as one joint
// move: R1 advances, R2 backs out, and R3 clears the cell behind R2.
const lowerLaneRecovery = resolveRobotMoves(
  [
    robot('R1', 5, 10, [{ x: 6, y: 10 }], 0.9, 2),
    robot('R2', 6, 10, [{ x: 5, y: 10 }], 0.1, 2),
    robot('R3', 7, 10, [{ x: 6, y: 10 }], 0.2, 2),
  ],
  { blockedCells: noBlocks, tick: 1, horizon: 3, allowReroute: true, comparePriority: priority },
);
assertUnique(lowerLaneRecovery.robots, 'lower-lane recovery produced an overlap');
assert(
  lowerLaneRecovery.robots.every((candidate) => candidate.state === 'moving'),
  'lower-lane dependency was not released',
);

// A future conflict is detected within the P2P reservation window.
const futureConflict = resolveRobotMoves(
  [
    robot('R1', 2, 2, [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }], 0.9),
    robot('R2', 6, 2, [{ x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }], 0.1),
  ],
  { blockedCells: noBlocks, tick: 1, horizon: 3, allowReroute: false, comparePriority: priority },
);
assertUnique(futureConflict.robots, 'future reservation conflict produced an overlap');
assert(futureConflict.conflictEvents === 1, 'future reservation conflict was not counted');

console.log('✅ Conflict-resolution checks passed: destination, swap, convoy, lower-lane recovery, and look-ahead.');
