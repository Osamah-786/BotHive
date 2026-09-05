# AMR Fleet Simulation — Historical Plan and Current Implementation

This document preserves the original SIH-style design plan while identifying
what is implemented today. The current source code and [README.md](./README.md)
are authoritative for behavior.

## Original Goal

Build a browser-based side-by-side warehouse simulation comparing a
centralized planner with a decentralized coordination model for autonomous
mobile robots. The project remains a simulation and evaluation tool; it does
not control physical AMRs and does not provide backend, database, cloud, or
real network infrastructure.

## Current Technology

| Layer | Current implementation |
|---|---|
| UI | React 19, TypeScript, Vite |
| State | Zustand |
| Warehouse renderer | Phaser 4 |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Routing | Wouter |
| Icons | Lucide React |
| Pathfinding | Repository A* with Manhattan heuristic |

## Current Architecture

```text
App.tsx
├── Header
│   ├── navigation
│   ├── simulation/chaos controls
│   ├── custom transport controls
│   ├── profile dropdown
│   └── logout
├── /login and /signup → LoginPage
├── / → protected SplitView → Phaser warehouse
└── /dashboard → protected MetricsPanel

useSimStore
├── TraditionalSideState → traditionalTick
└── ProposedSideState → proposedTick

Shared engine helpers
├── simulation.ts
├── astar.ts
├── warehouse.ts
└── conflictResolution.ts
```

The React `requestAnimationFrame` loop advances both engines at the same
logical tick. Traditional and Proposed state are maintained separately, while
shared lifecycle helpers keep task, inventory, charging, recovery, and
collision rules consistent.

## Current Warehouse Model

- Canonical logical grid: 20 columns × 14 rows.
- Robots: R1, R2, R3 on each engine side.
- Pickup stations:
  - P1 `(1,2)`
  - P2 `(1,7)`
  - P3 `(1,11)`
- Drop-off stations:
  - D1 `(18,2)`
  - D2 `(18,7)`
  - D3 `(18,11)`
- Charging stations:
  - C1 `(2,12)`
  - C2 `(17,1)`
- Six physical aisle choices exposed by the UI:

| UI aisle | Logical coordinate |
|---|---|
| Aisle 1 | `(1,2)` |
| Aisle 2 | `(1,7)` |
| Aisle 3 | `(1,11)` |
| Aisle 4 | `(18,2)` |
| Aisle 5 | `(18,7)` |
| Aisle 6 | `(18,11)` |

These are logical locations, not Phaser pixel positions.

## Fixed Workload

The normal workload has two boxes at each pickup stack, six boxes total.
`stackBoxes` tracks each source stack and `remainingBoxes` tracks undelivered
fixed-workload boxes. Normal deliveries follow pickup → carry → drop-off and
use the existing one-box cargo visualization. When work is exhausted, robots
return to their immutable original homes and freeze.

## Custom Transport Tasks — Implemented

The original plan did not include arbitrary user-assigned transport tasks.
This feature is now implemented:

- Header controls assign any robot to a pickup and a different drop-off aisle.
- Each robot has at most one pending custom task.
- The task targets the selected canonical coordinates.
- The robot picks up one visible box, carries it, drops it, and increments its
  custom completion.
- Custom tasks do not decrement the fixed `stackBoxes` or `remainingBoxes`
  workload.
- Completion clears the pending task and routes the robot home:
  - R1 → P1
  - R2 → P2
  - R3 → P3
- The robot freezes at home.
- Recovery inheritance preserves the custom task and cargo-related state.

## Engine Behavior

### Traditional

The Traditional engine simulates centralized cloud planning locally:

- planner refresh interval is derived from the cloud-latency control
- static robot-ID priority is used for centralized ordering
- one-step reservation horizon is used
- cloud kill freezes the Traditional robots
- dynamic blocked cells can leave a centralized route stale until refresh

No remote cloud service or network latency exists; the latency is represented by
deterministic local tick intervals.

### Proposed

The Proposed engine simulates decentralized local coordination:

- robots plan locally with A*
- simulated peer health and heartbeat last-seen state are maintained per robot
- SILENCE can progress from suspected to failed after tick thresholds
- conflicts can be predicted across a three-step horizon
- priority compares urgency, battery, task timestamp, and robot ID
- cooperative moves and rerouting can be selected
- simulated P2P links are rendered in the UI

All of this occurs inside one browser application. It is not real P2P
communication between robots.

## Collision and Deadlock Logic

The shared `conflictResolution.ts` layer:

- rejects same-cell occupancy
- rejects direct two-robot swaps in the same tick
- uses space-time reservations over a short horizon
- gives one robot deterministic priority
- makes lower-priority robots yield or re-plan
- invokes cooperative joint moves when reservation conflicts would otherwise
  create a swap or circular wait

The implementation is grid-based simulation logic. ORCA and RVO2 are not
implemented.

## Energy and Power

- Battery starts at 100%.
- A successful fixed delivery consumes 10 percentage points.
- At or below 20%, a pickup-leg robot selects an available charger.
- Charging adds 10 percentage points per tick to a maximum of 100%.
- Charger reservations prevent simultaneous claims; contention causes waiting.
- Grid Power disables both chargers during an outage.
- Robots going to charge use the existing `waiting` power-saving behavior.
- Robots already charging stop gaining battery.
- Positions, active work, and battery state are preserved.
- Phaser dims the warehouse and displays an outage notification.

## Failure and Recovery

- KILL freezes a robot and preserves unfinished state.
- SILENCE suppresses simulated Proposed heartbeats.
- Peer last-seen state drives suspected/failed status.
- ALIVE permits reconnection.
- Failed and killed robots remain dynamic obstacles.
- Eligible peers inherit unfinished work.
- Cargo recovery sends a coverer to the failed robot's last position before
  completing the drop-off.
- These are deterministic local simulations, not physical recovery systems.

## Authentication and UI — Implemented

- Bothive branding uses `logo/bothive.png`.
- `/login` and `/signup` use the shared `LoginPage`.
- `/` and `/dashboard` are protected by an authentication guard.
- Zustand persists demo accounts/session state in `sessionStorage`.
- Normal signup creates a `user`; authenticated admins can use Add Admin.
- Header profile dropdown displays username, email, role, and masked password.
- Logout clears the session and routes to `/login`.
- Authentication is client-side prototype behavior and is not production-secure.

## Historical Plan Status

The following original goals are implemented:

- Vite/React/TypeScript foundation
- canonical warehouse and A* navigation
- Traditional and Proposed tick engines
- Zustand state and fixed-step animation loop
- Phaser rendering and robot/cargo visualization
- metrics dashboard and simulated P2P links
- charging, charger reservations, and power outage mode
- KILL/SILENCE/ALIVE and task/cargo recovery
- custom transport tasks and home return
- collision and deadlock prevention
- demo authentication and protected routes

The following remain Planned/Future/Incomplete:

- real hardware or robot telemetry
- real cloud or P2P networking
- backend/database authentication
- ORCA/RVO2 or physics-based movement
- external dynamic task queues
- hosted deployment
- recorded demo media
- automated long-running benchmark/reporting tooling

## Run and Validate

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
