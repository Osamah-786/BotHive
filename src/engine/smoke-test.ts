// Quick smoke test — run with: bunx tsx src/engine/smoke-test.ts
import { aStar } from './astar';
import { PICKUP_STATIONS, DROPOFF_STATIONS, WAREHOUSE_GRID, GRID_COLS, GRID_ROWS } from './warehouse';

console.log(`\n=== AMR Engine Smoke Test ===`);
console.log(`Grid: ${GRID_COLS} cols × ${GRID_ROWS} rows\n`);

// Print a simple ASCII map of the grid
const symbols: Record<string, string> = {
  floor:   '.',
  shelf:   '█',
  pickup:  'P',
  dropoff: 'D',
  blocked: 'X',
};
for (let y = 0; y < GRID_ROWS; y++) {
  const row = WAREHOUSE_GRID[y].map(c => symbols[c.type] ?? '?').join(' ');
  console.log(`row ${String(y).padStart(2)}: ${row}`);
}

console.log('\n=== A* Path Tests ===\n');

const tests = [
  { start: PICKUP_STATIONS[0], goal: DROPOFF_STATIONS[0], label: 'R1: P1→D1' },
  { start: PICKUP_STATIONS[1], goal: DROPOFF_STATIONS[1], label: 'R2: P2→D2' },
  { start: PICKUP_STATIONS[2], goal: DROPOFF_STATIONS[2], label: 'R3: P3→D3' },
  // Reverse paths too
  { start: DROPOFF_STATIONS[0], goal: PICKUP_STATIONS[0], label: 'R1: D1→P1 (reverse)' },
  // With a blocked cell in the middle
  { start: PICKUP_STATIONS[0], goal: DROPOFF_STATIONS[0], label: 'R1 P1→D1 (col 9 row 2 blocked)', blocked: '9,2' },
];

let allPassed = true;
for (const t of tests) {
  const blocked = t.blocked ? new Set([t.blocked]) : new Set<string>();
  const path = aStar(t.start, t.goal, blocked);
  const ok = path.length > 0;
  if (!ok) allPassed = false;
  console.log(`${ok ? '✅' : '❌'} ${t.label}: ${ok ? path.length + ' steps' : 'NO PATH FOUND'}`);
  if (ok) console.log(`   start=${JSON.stringify(t.start)}  goal=${JSON.stringify(t.goal)}  first3=${JSON.stringify(path.slice(0,3))}`);
}

console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}\n`);
