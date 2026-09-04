# EDGE FLEET

EDGE FLEET is a browser-based AMR warehouse simulation for comparing two fleet-coordination strategies under the same workload:

- **Traditional**: a centralized planner with simulated cloud latency and static robot-ID priority.
- **Proposed**: a decentralized, local-planning model with simulated peer state, heartbeat failure detection, priority-based conflict resolution, and recovery.

Both strategies run side by side so task throughput, idle time, conflicts, battery, charging, and failure behavior can be inspected together. This is a simulation and dashboard; it does not connect to physical robots, a cloud service, or a real P2P network.

## Project Overview

EDGE FLEET models AMRs moving boxes through a warehouse and provides a direct comparison between centralized planning and the proposed decentralized coordination model. The two engines receive the same logical tick and workload, but use different planning and conflict policies.

## Current Simulation

- Three robots run on each side: **R1**, **R2**, and **R3**.
- The fixed warehouse is a 20 x 14 grid with shelves, pickup stations `P1`-`P3`, dropoff stations `D1`-`D3`, and charging stations `C1` and `C2`.
- Each robot follows pickup -> carry -> dropoff for its assigned station index.
- A robot carries one box at a time. A delivery is counted only after confirmed arrival at the dropoff.
- Source inventory starts with two boxes at each pickup stack, six boxes total. When inventory is exhausted, robots may finish existing dropoffs but cannot start another pickup cycle.
- The deterministic simulation tick is 200 ms at 1x. Controls provide play/pause, restart, and 0.5x, 1x, 2x, and 4x rates.

## Task & Inventory Management

- `stackBoxes` tracks remaining inventory at each source stack; `remainingBoxes` tracks all undelivered boxes.
- Pickup requires inventory at the robot's assigned source stack.
- Only a real pickup -> dropoff transition increments delivery metrics. Recovery progress is not counted twice.
- Empty stacks freeze robots at pickup instead of creating cargo that does not exist.
- When total inventory reaches zero, only in-progress dropoff or cargo rescue may continue, preventing fake deliveries.
- A robot with unfinished work can have its assignment inherited after failure. Cargo carried by a failed robot is recovered from its last physical position.

## Robot Failure & Recovery

- **KILL** marks a selected robot killed until **ALIVE** is pressed. It freezes in place and keeps its unfinished task state.
- **SILENCE** stops a selected robot's simulated heartbeats on the proposed side. Peers mark it suspected, then failed after the heartbeat timeout.
- **ALIVE** clears the manual failure and allows reconnection. Work already owned by a coverer remains protected from duplication.
- Proposed robots maintain peer health locally, so failure detection is decentralized within the simulation.
- Eligible robots inherit unfinished tasks from killed or detected-failed peers, selected by route cost, battery, urgency, and robot ID.
- Failed and killed robots remain at their last cells and are dynamic physical obstacles for navigation and collision resolution.
- `coveringForRobotId` protects recovery ownership when a failed robot reconnects.

## Battery & Energy Management

- Robots start at **100%** battery.
- `MAX_TASKS = 10` is a per-robot task-capacity guard and is separate from the six-box warehouse workload.
- Each successful delivery consumes **10%** battery (`100 / MAX_TASKS`). Movement and recovery progress do not consume battery.
- At or below the **20%** threshold, a robot on the pickup leg diverts to charge before another pickup.
- Charging is automatic, targets **100%**, and adds **10 percentage points per simulation tick**.
- The current task and station assignment are preserved while the robot travels to, waits for, or occupies a charger.
- `goingToCharge` state is preserved while traveling cell-by-cell to the charger (preventing movement resolution from overwriting state), cleanly transitioning to `charging` upon arrival at `C1` or `C2`.
- **Battery -** controls reduce a selected robot's battery by 10 percentage points manually so automatic charging behavior can be tested and demonstrated.

## Charging Stations & UI Notifications

- There are two stations, `C1` and `C2`.
- Automatic charger selection uses the existing A* pathfinder and chooses the shortest available route.
- A reservation is held while a robot is going to or occupying a station; only one robot may reserve each station (`reservedChargingStations`).
- If both stations are occupied, a low-battery robot waits and retries on later ticks.
- The reservation is released when charging reaches 100% and the robot leaves charging.
- Killed and failed robots do not hold reservations.
- **Charging UI Notification**: When a robot is actively in `charging` state, a floating light-green notification overlay appears in the top-right of the active warehouse view:
  - Displays electric `⚡` indicator icon, robot ID (colored), `CHARGING` status, live battery %, and assigned charger label (`C1`/`C2`).
  - Active strictly when `robot.state === 'charging'` (does not render while merely `goingToCharge`).
  - Automatically disappears when charging completes at 100% or state leaves `charging`.
  - Supports multiple robots charging simultaneously.

## Navigation & Collision Avoidance

- Global routes use grid-based **A*** with a Manhattan heuristic.
- Shelves, manually blocked cells, and failed or killed robots are impassable to ordinary navigation.
- The shared collision resolver prevents same-cell moves and direct cell swaps.
- Traditional uses a one-step horizon, static priority (`R1` before `R2` before `R3`), stop-and-wait conflicts, and no local reroute around a newly blocked aisle until its centralized route refreshes.
- Proposed predicts conflicts up to three steps ahead, compares priority in the order `urgency -> battery -> timestamp (oldest task) -> robot ID`, and can choose cooperative moves or reroute around reservations.
- **ORCA is not implemented.** Proposed movement uses the repository's cooperative reservation and A* rerouting logic.

## Dashboard / Chaos Controls

- **Compact Metrics Panel Layout**:
  - The trend chart card uses contained relative positioning (`relative`) to isolate tooltip interactions and has a compact `h-[140px]` height setting in full-page mode to prevent dashboard layout spilling.
  - Robot Health status list uses flexible grid column layout (`grid-cols-[2.25rem_minmax(0,1fr)_auto]`) with compact padding (`py-1.5`, `space-y-1.5`), ensuring all 3 robots (**R1**, **R2**, **R3**) remain fully represented and visible without vertical clipping.
- **KILL**, **ALIVE**, and **SILENCE** provide individual robot failure and heartbeat controls.
- **Battery -** is a testing/debug control that manually decreases a robot's battery by 10% to trigger and demonstrate automatic charging.
- **Block aisle** toggles a dynamic obstacle at the demo aisle; floor-cell interaction is also supported by the warehouse view where available.
- **Cloud lag** changes centralized planner refresh intervals from 20 ms to 2000 ms and does not delay Proposed.
- **Kill cloud** freezes Traditional; restoring the cloud lets it continue. Proposed is independent of this simulated flag.
- **Run/Pause, Restart, and Rate** control the shared clock.
- The dashboard shows task progress, idle time, conflicts, robot health, route load, charging reservations, and Proposed peer links.

## Important Architecture Notes

- React and TypeScript provide the UI; Vite builds it; Zustand owns simulation state.
- `src/engine/traditional.ts` and `src/engine/proposed.ts` implement the two tick engines.
- `src/engine/simulation.ts` contains shared task, inventory, battery, charging, heartbeat, kill/reconnect, and recovery lifecycle logic.
- `src/engine/astar.ts` owns pathfinding, while `src/engine/conflictResolution.ts` owns movement safety and cooperative resolution.
- The React animation loop advances both engines from the same logical tick and commits results to Zustand.
- Charging uses explicit `goingToCharge` and `charging` states; reservations derive from live robot state.
- Visual storage stacks mirror the source-stack inventory model; they are not a separate inventory system.
- Proposed green peer links are rendered from simulated `P2PLink` state. They do not represent real network traffic.

## Current Limitations / Not Yet Implemented

- This is a deterministic browser simulation, not hardware control or a production fleet-management system.
- Cloud, peer-to-peer communication, heartbeat loss, robot kills, and reconnection are local simulations. There is no network transport, physical telemetry, or cloud backend.
- ORCA and physics-based motion are not implemented; movement is grid-cell based.
- The workload is fixed at six boxes with three fixed pickup/dropoff assignments; there is no external task queue or dynamic warehouse data source.
- Centralized cloud latency is represented by deterministic refresh intervals, not measured network latency or a remote planner.
- Deployment, a hosted demo URL, and the planned headless validation script are not part of the current repository workflow.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Vite |
| Warehouse rendering | Phaser 4 |
| State | Zustand |
| Charts | Recharts |
| UI components | shadcn/ui and Tailwind CSS |
| Pathfinding | Custom A* with Manhattan heuristic |
| Movement coordination | Shared collision resolver; proposed cooperative reservations and rerouting |

## Project Structure

```text
src/
├── engine/
│   ├── astar.ts               # Grid pathfinding
│   ├── conflictResolution.ts  # Collision and reservation resolution
│   ├── proposed.ts            # Decentralized tick engine
│   ├── simulation.ts          # Shared lifecycle and task helpers
│   ├── traditional.ts         # Centralized tick engine
│   ├── types.ts               # Shared state contracts
│   └── warehouse.ts           # Fixed grid and station definitions
├── store/
│   └── useSimStore.ts         # Zustand state and controls
└── components/
    ├── layout/                # Header, split view, chaos controls, metrics
    ├── simulation/            # Phaser warehouse and simulation visuals
    └── ui/                     # Reusable interface components
```

## Run Locally

```bash
npm install
npm run dev
```

Build and type-check with:

```bash
npm run build
```

## Team

SIH 2026 - Edge coordination for AMR fleets
