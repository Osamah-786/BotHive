# VERCEL LINK:https://bot-hive-theta.vercel.app/

# EDGE FLEET

EDGE FLEET is a browser-based AMR warehouse simulation for comparing a
centralized planner with a simulated decentralized coordination model. It is
an application-level simulation only: it does not connect to physical robots,
hardware, a backend, a database, a cloud service, or a real P2P network.

## Current Features

### Branding and UI

- Bothive branding uses the existing [`logo/bothive.png`](./logo/bothive.png)
  asset.
- The shared Header provides:
  - Simulation and Dashboard navigation
  - Run/pause, restart, and speed controls
  - Chaos controls for cloud kill, robot KILL/ALIVE/SILENCE, battery reduction,
    aisle blocking, and Grid Power
  - Compact custom transport-task controls
  - Authenticated user/role display, profile dropdown, and logout
- `/` is the Simulation view. It displays one active warehouse viewport with
  tabs for Centralized Cloud planner and Decentralized P2P mesh. Both engines
  continue to advance while the tab selects the view.
- `/dashboard` displays live telemetry, charts, robot health, dispatch
  priority, utilization, reservation status, and simulated peer links.

### Authentication

- `/login` and `/signup` are provided by the shared login/signup component.
- `/` and `/dashboard` are protected routes and redirect to `/login` when
  unauthenticated.
- Demo accounts and newly created accounts are persisted in
  `sessionStorage` through Zustand under `edge-fleet-auth`.
- Email matching trims and lowercases the address; passwords are matched
  exactly.
- Roles are `admin` and `user`.
- Normal signup always creates a `user`.
- An authenticated admin can create another admin with Add Admin.
- The Header profile dropdown displays the current username, email, role, and
  a masked password (`••••••••`). It never displays the actual password.
- Logout clears the authenticated session and returns to `/login`.
- This is prototype/client-side authentication and is **not production-secure**:
  there is no backend, database, password hashing, server-side session
  validation, or production security boundary.

## Warehouse and Robots

- The logical warehouse is a canonical 20×14 grid.
- The fleet contains R1, R2, and R3 on both simulation sides.
- Fixed stations are:
  - Pickup: P1 `(1,2)`, P2 `(1,7)`, P3 `(1,11)`
  - Drop-off: D1 `(18,2)`, D2 `(18,7)`, D3 `(18,11)`
  - Charging: C1 `(2,12)`, C2 `(17,1)`
- The UI exposes six physical aisles:
  - Aisle 1 → `(1,2)`
  - Aisle 2 → `(1,7)`
  - Aisle 3 → `(1,11)`
  - Aisle 4 → `(18,2)`
  - Aisle 5 → `(18,7)`
  - Aisle 6 → `(18,11)`
- These are logical grid coordinates. Phaser converts them to visual positions;
  the UI does not use pixel coordinates for task assignment.

## Fixed Workload and Cargo

- The normal workload starts with two boxes at each pickup stack: six boxes
  total.
- `stackBoxes` stores per-stack inventory and `remainingBoxes` stores total
  undelivered fixed-workload boxes.
- Normal work follows pickup → carry → drop-off for the robot's station
  assignment. One robot carries one visible box at a time.
- Fixed inventory is consumed only by normal fixed deliveries. Completed robots
  return to their immutable starting pickup position and freeze.

## Custom Transport Tasks

- The Header form assigns one task to any robot:
  - R1, R2, or R3
  - one of the six pickup aisles
  - a different drop-off aisle
- Each robot stores at most one pending custom transport task.
- The lifecycle is pickup → carry → drop-off:
  1. Navigate to the selected pickup coordinate.
  2. Pick up exactly one visible box using the existing cargo mechanism.
  3. Carry it to the selected drop-off coordinate.
  4. Remove the cargo and count one completed custom task.
- Custom tasks do **not** decrement `stackBoxes` or `remainingBoxes`.
- After completion, the robot returns to its immutable home and freezes:
  - R1 → P1
  - R2 → P2
  - R3 → P3
- Custom tasks preserve the existing battery, failure, recovery, pathfinding,
  and collision behavior.

## Simulation Engines

Both engines receive the same logical tick from the React animation loop and
maintain separate robot/metric state.

### Traditional

- Centralized planner behavior is simulated locally in the browser.
- Planner refresh frequency is affected by the cloud-latency setting.
- It uses static robot-ID priority and a one-step reservation horizon.
- The cloud-kill control freezes the Traditional side.
- It does not represent a real cloud server or network request.

### Proposed

- Each robot plans locally with A* and uses simulated peer state.
- Peer health and heartbeat last-seen values are maintained in application
  state. SILENCE causes suspected/failed status after configured tick
  thresholds.
- Conflict resolution considers urgency, battery, task timestamp, and robot
  ID, and may choose cooperative moves or reroute around reservations.
- Simulated P2P links are rendered on the Proposed view.
- Cloud kill does not stop Proposed planning.
- This is not real decentralized networking: all communication, heartbeat
  handling, and failure detection run inside the browser/application.

## Collision and Deadlock Prevention

- A* uses the canonical grid and Manhattan-distance pathfinding.
- Shelves, dynamic blocked cells, and failed/killed robot cells are obstacles
  for ordinary navigation.
- The shared resolver prevents:
  - two robots entering the same physical cell
  - two robots directly swapping cells in one tick
- Reservations cover predicted trajectories. When conflicts occur, priority
  determines who proceeds; lower-priority robots yield, re-plan, or take a
  legal cooperative move when possible.
- This is deterministic grid simulation logic. ORCA and RVO2 are not
  implemented.

## Energy and Power

- Robots start at 100% battery.
- Each successful fixed delivery consumes 10 percentage points.
- At or below 20%, a robot on the pickup leg automatically selects an
  available charger using A*.
- Charging adds 10 percentage points per tick up to 100%.
- Charger reservations prevent multiple robots from claiming the same charger;
  contention causes a robot to wait and retry.
- Grid Power toggles the global warehouse power state:
  - chargers become unavailable
  - robots going to charge enter the existing `waiting` power-saving behavior
  - robots already charging stop gaining battery
  - active tasks, positions, and battery values are preserved
  - the Phaser warehouse dims and shows a power-off notification
- Restoring power resumes normal charging on later ticks.

## Failure and Recovery

- **KILL** freezes a selected robot and preserves its unfinished state.
- **SILENCE** stops simulated heartbeats for a selected robot on the Proposed
  side. Peers track last-seen ticks and eventually mark it failed.
- **ALIVE** clears the manual failure condition and permits reconnection.
- Killed and failed robots remain at their last physical cell and act as
  dynamic obstacles.
- Eligible peers inherit unfinished work. The inherited assignment preserves
  custom transport state when applicable.
- If a failed robot was carrying cargo, a coverer navigates to its last
  position, recovers the cargo, completes the drop-off, and continues.
- Recovery and handoff are local simulation behavior, not hardware or network
  recovery.

## Controls and Runtime

- Base logical tick: 200 ms at 1×.
- Available speeds: 0.5×, 1×, 2×, and 4×.
- Run/pause and restart control the shared simulation clock.
- The warehouse renderer is Phaser-based; charts use Recharts and state is
  held in Zustand.

## Limitations and Planned Work

The following are not implemented and remain Planned/Future:

- physical AMR or hardware integration
- real cloud infrastructure or P2P networking
- backend/database services
- production authentication and password security
- ORCA/RVO2 or physics-based motion
- external task queues or dynamic warehouse data sources
- hosted deployment and a recorded demo GIF

## Development

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm run typecheck
npm run build
```

## Project Structure

```text
src/
├── engine/
│   ├── astar.ts
│   ├── conflictResolution.ts
│   ├── proposed.ts
│   ├── simulation.ts
│   ├── traditional.ts
│   ├── types.ts
│   └── warehouse.ts
├── store/
│   ├── useAuthStore.ts
│   └── useSimStore.ts
└── components/
    ├── layout/
    │   ├── Header.tsx
    │   ├── LoginPage.tsx
    │   ├── CreateTransportTask.tsx
    │   ├── ChaosPanel.tsx
    │   ├── MetricsPanel.tsx
    │   └── SplitView.tsx
    └── simulation/
        └── PhaserWarehouse.tsx
```
