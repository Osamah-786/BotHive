# AMR Fleet Simulation — SIH 2026

> **Live demo** → *(add your Vercel URL here)*
>
> A side-by-side interactive simulator that proves why **decentralized P2P coordination** outperforms a centralized cloud planner for Autonomous Mobile Robot (AMR) fleets.

---

## What it shows

The screen splits into two live warehouses running the same 3-robot, 6-station workload simultaneously:

| Left — **Centralized (Cloud)** | Right — **Decentralized (P2P Mesh)** |
|---|---|
| Single cloud planner routes all robots | Each robot plans locally via A\* |
| Stale routes when cloud is slow or offline | Instant re-route on every tick |
| Stop-and-wait on conflicts (lower ID wins) | Priority-token protocol: urgency → battery → age |
| Freezes completely when WiFi is killed | Unaffected — no cloud dependency |

---

## Key results (headless 200-tick validation)

| Scenario | Traditional | Proposed | Result |
|---|---|---|---|
| Baseline (no chaos) | 16 tasks | 16 tasks | Parity on clear paths |
| **Kill Cloud WiFi** (tick 50) | 3 tasks, **453 robot-ticks frozen** | **16 tasks** | P2P keeps running |
| **Block Aisle** (tick 30) | 11 tasks, 158 idle ticks | **15 tasks, 0 idle** | Instant local re-route |
| High latency (2000ms) | 15 tasks | **16 tasks** | Cloud lag penalises throughput |

---

## Interactive chaos controls

| Control | Effect on Traditional | Effect on Proposed |
|---|---|---|
| **Kill Cloud WiFi** | All robots freeze | No effect |
| **Block Aisle** (click any floor tile) | Robot waits indefinitely on stale route | Re-routes within one tick |
| **Cloud Lag slider** (20–2000ms) | Planner refresh delayed proportionally | Unaffected |

---

## Tech stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript + Vite 8 |
| 3D Rendering | React Three Fiber + @react-three/drei |
| State | Zustand |
| Charts | Recharts |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Pathfinding | Custom A\* with Manhattan heuristic |
| Conflict resolution | Priority-token P2P broadcast model |

---

## Architecture

```
src/
├── engine/
│   ├── types.ts          — Robot, SimMetrics, P2PLink interfaces
│   ├── warehouse.ts      — 20×14 grid with shelves, pickup & dropoff stations
│   ├── astar.ts          — A* pathfinding (Manhattan heuristic)
│   ├── simulation.ts     — Shared tick helpers, metrics sampler
│   ├── traditional.ts    — Centralized cloud planner (stop-and-wait)
│   └── proposed.ts       — Decentralized P2P (priority-token protocol)
├── store/
│   └── useSimStore.ts    — Zustand store: robots, metrics, chaos state
├── components/
│   ├── layout/
│   │   ├── Header.tsx        — Controls + chaos console bar
│   │   ├── SplitView.tsx     — Side-by-side canvas layout
│   │   ├── MetricsPanel.tsx  — 3 live Recharts (tasks, idle, conflicts)
│   │   └── ChaosPanel.tsx    — Fault injection controls
│   ├── simulation/
│   │   ├── WarehouseCanvas.tsx — R3F canvas wrapper + banner
│   │   ├── WarehouseGrid.tsx   — 280-tile grid renderer with station labels
│   │   ├── RobotMesh.tsx       — AMR disc, task ring, path dots, battery %
│   │   ├── P2PLines.tsx        — Animated P2P communication links
│   │   └── ObstacleMesh.tsx    — Pulsing blocked-aisle marker
│   └── ui/
│       ├── MetricCard.tsx   — Cloud vs P2P paired stat card
│       └── SimControls.tsx  — Play / Pause / Restart / Speed
└── styles/
    └── globals.css          — Scrollbar, focus ring, glow-pulse keyframe
```

---

## Run locally

```bash
git clone <repo-url>
cd amr-finale
npm install
npm run dev        # localhost:5173
```

```bash
# Headless 200-tick validation
npx tsx scripts/validate.ts

# Production build
npm run build
```

---

## Simulation model details

### Traditional engine (`traditional.ts`)
- The centralized cloud planner re-routes robots every `N` ticks (controlled by the Latency slider)
- Conflict resolution: **lower robot ID always wins** — static priority
- When cloud WiFi is killed, all robots transition to `frozen` state immediately
- Blocked aisles use the **last known cloud map** — robots wait at the obstacle rather than re-routing

### Proposed engine (`proposed.ts`)
- Each robot runs **local A\*** on every tick — no cloud round-trip
- Conflict prediction: looks 3 steps ahead; if two robots share any future cell, the lower-priority robot yields for one tick
- Priority order: **urgency (0–1) → battery (0–100) → task age (ms)**
- P2P broadcast range: Manhattan distance ≤ 10 tiles; conflict messages go direct even out of range
- Battery: drains 0.5% per move, **recharges to 100% on each completed delivery**

### Robot visual encoding
| Visual | Meaning |
|---|---|
| **Amber ring** around robot | Heading to pickup station |
| **Orange ring** around robot | Heading to dropoff station |
| **Faint dots** trailing the robot | A\* path preview (up to 12 waypoints) |
| **Red pulsing glow** | Robot is frozen (cloud killed) |
| **Battery % in red** | Below 25% charge |
| **Green animated lines** | Active P2P communication link (Proposed side) |

---

## Recording a demo GIF (macOS)

1. Install **[Kap](https://getkap.sh/)** (free, macOS)
2. Start the dev server: `npm run dev`
3. Open `localhost:5173` in a full browser window
4. Record these steps for maximum impact:
   - Let robots run 5–10 seconds at 2× speed
   - Click **Kill Cloud** — watch Traditional freeze, Proposed keep going
   - Click **Block Aisle** — watch Traditional stall, Proposed re-route
   - Restore cloud and watch Traditional robots resume
5. Export as GIF or MP4 and embed below

---

## Team

SIH 2026 · Edge coordination for AMR fleets
