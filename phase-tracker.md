# EDGE FLEET — Phase Tracker

This tracker records implementation status. Current source behavior is
authoritative; the historical plan is preserved in
[amr-simulation-plan.md](./amr-simulation-plan.md).

## Current State Snapshot

| Area | Status |
|---|---|
| React + Vite + TypeScript foundation | ✅ Complete |
| Zustand simulation store | ✅ Complete |
| Canonical 20×14 warehouse | ✅ Complete |
| A* grid pathfinding | ✅ Complete |
| Phaser warehouse visualization | ✅ Complete |
| Traditional centralized simulation | ✅ Complete |
| Proposed simulated decentralized simulation | ✅ Complete |
| Shared collision/reservation resolver | ✅ Complete |
| Direct-swap and deadlock prevention | ✅ Complete |
| Fixed six-box workload | ✅ Complete |
| Automatic charging and reservations | ✅ Complete |
| Grid Power outage behavior and visuals | ✅ Complete |
| KILL / SILENCE / ALIVE controls | ✅ Complete |
| Heartbeat/failure detection simulation | ✅ Complete |
| Task and cargo recovery | ✅ Complete |
| Return-to-home and freeze behavior | ✅ Complete |
| Six-aisle custom transport UI | ✅ Complete |
| Custom one-box transport lifecycle | ✅ Complete |
| Bothive branding/logo | ✅ Complete |
| Login/signup and protected routes | ✅ Complete |
| Admin/User roles and Add Admin | ✅ Complete |
| Header profile dropdown and logout | ✅ Complete |
| Dashboard metrics and charts | ✅ Complete |

## Current UI

- Header navigation: Simulation and Dashboard.
- Header controls: Run/Pause, Restart, speed, cloud kill, KILL/ALIVE,
  SILENCE, Battery -, Block Aisle, Grid Power, and Cloud Lag.
- Header custom task controls: robot, pickup aisle, drop-off aisle, Assign Task.
- Header profile icon: username, email, role, masked password, outside-click
  dismissal, and logout.
- Simulation: one active Phaser warehouse viewport with Centralized and
  Decentralized tabs.
- Dashboard: live metrics, charts, robot health, dispatch priority,
  utilization, reservation status, and simulated peer links.

## Implemented Warehouse and Task Rules

- Grid: 20×14.
- Robots: R1, R2, R3.
- Pickup stations: P1 `(1,2)`, P2 `(1,7)`, P3 `(1,11)`.
- Drop-off stations: D1 `(18,2)`, D2 `(18,7)`, D3 `(18,11)`.
- Chargers: C1 `(2,12)`, C2 `(17,1)`.
- UI aisle mappings:
  - Aisle 1 `(1,2)`
  - Aisle 2 `(1,7)`
  - Aisle 3 `(1,11)`
  - Aisle 4 `(18,2)`
  - Aisle 5 `(18,7)`
  - Aisle 6 `(18,11)`
- Fixed workload: two boxes per pickup stack, six boxes total.
- Custom tasks: one pending task per robot, pickup → carry → drop-off,
  independent of fixed inventory, then immutable-home return and freeze.
- Homes: R1 → P1, R2 → P2, R3 → P3.

## Engine and Safety Status

- Traditional uses deterministic centralized planning, cloud-latency refresh
  intervals, static robot-ID priority, and a one-step horizon.
- Proposed uses local A*, simulated peer health/heartbeats, a three-step
  conflict horizon, priority comparison, cooperative movement, and rerouting.
- Both use the shared collision resolver.
- Same-cell occupancy and direct swaps are rejected.
- Reservation conflicts select a deterministic winner; lower-priority robots
  yield or re-plan.
- P2P and heartbeat behavior is simulated in-browser, not real networking.
- ORCA/RVO2 is not implemented.

## Authentication Status

- `/login` and `/signup`: ✅
- Protected `/` and `/dashboard`: ✅
- `sessionStorage` demo persistence: ✅
- Admin/User roles: ✅
- Normal signup creates User: ✅
- Admin-only Add Admin: ✅
- Profile details with masked password: ✅
- Logout: ✅
- Production-secure authentication/backend/database: ❌ Planned/Future

## Historical Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, types, warehouse, A* | ✅ Complete |
| 2 | Store, rendering, split simulation view | ✅ Complete |
| 3 | Traditional/Proposed engines and tick loop | ✅ Complete |
| 4 | Controls, chaos, failures, recovery, deadlock handling | ✅ Complete |
| 5 | Metrics, dashboard, charging, outage, branding, custom transport | ✅ Complete |
| 6 | Deployment, recorded demo, long-run benchmarking | 🔲 Planned/Incomplete |

## Planned or Incomplete

- Production authentication with a backend and secure password handling.
- Real cloud/P2P communication and physical fleet integration.
- ORCA/RVO2 or physics-based movement.
- External task queue and dynamic warehouse data source.
- Hosted deployment and recorded demo GIF.
- Automated benchmark/report generation beyond the existing live UI.

## Validation Commands

```bash
npm run typecheck
npm run build
git diff --check
```
