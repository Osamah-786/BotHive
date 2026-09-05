# AMR Fleet Simulation — Phase Tracker

> Living document. Update status after each session.
> Source plan: [amr-simulation-plan.md](./amr-simulation-plan.md)

---

## 🔎 Project State Snapshot

| Item | Status |
|---|---|
| Vite + React + TS scaffold | ✅ Done |
| Dependencies installed | ✅ Phaser 4, Zustand, Recharts, shadcn/ui, Tailwind CSS all installed |
| shadcn/ui configured | ✅ `components.json` present |
| `src/engine/types.ts` | ✅ Done |
| `src/engine/warehouse.ts` | ✅ Done |
| `src/engine/astar.ts` | ✅ Done — smoke test: 5/5 paths found |
| `src/store/useSimStore.ts` | ✅ Done |
| `src/components/simulation/WarehouseGrid.tsx` | ✅ Done |
| `src/components/simulation/RobotMesh.tsx` | ✅ Done |
| `src/components/simulation/WarehouseCanvas.tsx` | ✅ Done |
| `src/components/layout/SplitView.tsx` | ✅ Done |
| `src/App.tsx` | ✅ Wired up — dev server running at localhost:5173 |
| `src/engine/traditional.ts` | ✅ Done — centralized stop-and-wait tick engine |
| `src/engine/proposed.ts` | ✅ Done — local planning + priority-token tick engine |
| Simulation clock + robot interpolation | ✅ Done — 200 ms base tick with rAF loop |
| `src/components/layout/Header.tsx` | ✅ Done — controls + chaos console |
| `src/components/simulation/ObstacleMesh.tsx` | ✅ Done — pulsing blocked-aisle marker |
| `src/components/layout/MetricsPanel.tsx` | ✅ Done — 3 live Recharts charts |
| `src/components/ui/MetricCard.tsx` | ✅ Done — cloud vs P2P paired readout |
| `src/components/simulation/P2PLines.tsx` | ✅ Done — animated green mesh lines |
| `src/styles/globals.css` | ✅ Done — scrollbar, focus ring, keyframes |
| Automatic robot charging | ✅ Done — automatic charging at C1/C2 when battery ≤ 20% (10% drain per delivery, 100% capacity = 10 deliveries) |
| Charging movement state fix | ✅ Done — `goingToCharge` state preserved during move resolution; cleanly transitions to `charging` at C1/C2 |
| Top-right charging UI popup | ✅ Done — floating light-green overlay notification (`⚡ R1 CHARGING (20%) C1`) in SplitView.tsx |
| Dashboard & Robot Health layout | ✅ Done — compact trend chart height (`h-[140px]`), Tooltip containment (`relative`), flexible grid fitting all 3 robots (R1–R3) |
| Station labels (P1–D3, C1–C2) | ✅ Done — station indicators on warehouse grid |
| Robot task-ring indicator | ✅ Done — amber=pickup, orange=dropoff ring |
| Charging coordinate synchronization | ✅ Done — Phaser C1/C2 visuals use the canonical logical cells `(2,12)` and `(17,1)` |
| Light industrial UI refresh | ✅ Done — simulation warehouse, controls, panels, charts, and dashboard use the current light visual treatment |
| Single-box cargo rendering | ✅ Done — carrying visuals show one attached cardboard box without pallet/support shapes |

---

## 📋 Phase Overview

| Phase | Name | Status | Sessions |
|---|---|---|---|
| 1 | Foundation | ✅ Complete | #2 |
| 2 | Rendering | ✅ Complete | #3 |
| 3 | Simulation Logic | ✅ Complete | #4 |
| 4 | Controls & Chaos | ✅ Complete | #5 |
| 5 | Metrics & Polish | ✅ Complete | #7 |
| 6 | Testing & Demo Prep | 🔲 Partial | — |

---

## 🏗️ Phase 1 — Foundation

> **Goal**: Pure TypeScript core — no UI yet. Get A* working and tested in isolation.

**Entry gate**: Project is scaffolded ✅  
**Exit gate**: A* correctly finds paths on the 20×14 warehouse grid, avoiding shelves.

### Tasks

- [ ] **1.1** Create `src/engine/types.ts` — `CellType`, `Cell`, `Robot`, `SimMetrics` interfaces
- [ ] **1.2** Create `src/engine/warehouse.ts` — 20×14 grid definition with all cell types hardcoded
- [ ] **1.3** Create `src/engine/astar.ts` — A* with Manhattan heuristic, returns `{x,y}[]` path
- [ ] **1.4** Smoke-test A* manually (console.log a path from corner to corner, bypassing shelves)

### Key Design Decisions
- Grid is **20 cols × 14 rows** (`x` = column, `y` = row)
- Impassable cells: `shelf`, `blocked`
- A* returns empty array `[]` if no path exists

### Files to create
```
src/engine/types.ts
src/engine/warehouse.ts
src/engine/astar.ts
```

---

## 🎨 Phase 2 — Rendering

> **Goal**: See the warehouse grid + 3 colored robots on screen. No movement yet.

**Entry gate**: Phase 1 complete ✅  
**Exit gate**: Browser shows split-screen with two identical static warehouse grids and 3 robots each.

### Tasks

- [ ] **2.1** Create `src/store/useSimStore.ts` — Zustand store (static initial state only, no actions yet)
- [ ] **2.2** Create `src/components/simulation/WarehouseGrid.tsx` — tile renderer
- [ ] **2.3** Create `src/components/simulation/RobotMesh.tsx` — colored box + floating label
- [ ] **2.4** Create `src/components/simulation/WarehouseCanvas.tsx` — Phaser 4 canvas wrapper
- [ ] **2.5** Create `src/components/layout/SplitView.tsx` — two canvases side by side
- [ ] **2.6** Wire `App.tsx` to render `SplitView`

### Key Design Decisions
- Camera: Top-down orthographic camera in Phaser 4 view
- Grid tiles: Rendered via Phaser 4 tilemap/graphics, positioned by `x * TILE_SIZE, y * TILE_SIZE`
- Tile colors: Follow warehouse-tone palette from the plan

### Files to create/modify
```
src/store/useSimStore.ts       (create)
src/components/simulation/WarehouseGrid.tsx    (create)
src/components/simulation/RobotMesh.tsx        (create)
src/components/simulation/WarehouseCanvas.tsx  (create)
src/components/layout/SplitView.tsx            (create)
src/App.tsx                                    (modify)
```

---

## ⚙️ Phase 3 — Simulation Logic

> **Goal**: Robots move. Both engines tick. Traditional stop-and-waits. Proposed uses priority tokens.

**Entry gate**: Phase 2 complete ✅  
**Exit gate**: Both sides run autonomously in a loop — robots cycle between pickup and dropoff, conflicts are handled by each engine's strategy.

### Tasks

- [x] **3.1** Create `src/engine/traditional.ts` — centralized planner, stop-and-wait conflict resolution
- [x] **3.2** Create `src/engine/proposed.ts` — local A*, priority token protocol, P2P broadcast model
- [x] **3.3** Expand `useSimStore.ts` — add `play/pause/restart/setSpeed` actions + `tick` state
- [x] **3.4** Implement `rAF` tick loop in `App.tsx` — runs `traditionalTick` + `proposedTick` per tick
- [x] **3.5** Connect robot positions from store → `RobotMesh` (smooth lerp between grid steps)

### Key Design Decisions
- **Traditional**: cloud planner runs every N ticks; lower robot ID = higher static priority
- **Proposed**: each robot has `urgency > battery > timestamp > robot ID` priority chain
- **Lerp**: robots visually interpolate between cells over one tick duration (avoids teleporting)
- `BASE_TICK_MS = 200ms` at 1×

### Files to create/modify
```
src/engine/traditional.ts   (create)
src/engine/proposed.ts      (create)
src/store/useSimStore.ts    (modify — add actions)
src/App.tsx                 (modify — add rAF loop)
src/components/simulation/RobotMesh.tsx  (modify — lerp animation)
```

---

## 🎮 Phase 4 — Controls & Chaos

> **Goal**: Full interactive control. Play/Pause/Restart/Speed. Chaos buttons visibly break Traditional and don't faze Proposed.

**Entry gate**: Phase 3 complete ✅  
**Exit gate**: All chaos scenarios work correctly and are visually striking.

### Tasks

- [x] **4.1** Create `src/components/layout/Header.tsx` — app title bar
- [x] **4.2** Create `src/components/ui/SimControls.tsx` — Play/Pause/Restart/Speed buttons
- [x] **4.3** Create `src/components/layout/ChaosPanel.tsx` — Kill WiFi toggle, Latency slider, Block Aisle button
- [x] **4.4** Implement **Kill Cloud WiFi** effect: freeze Traditional robots, no effect on Proposed
- [x] **4.5** Implement **Block Aisle** click: Traditional robot waits indefinitely, Proposed rereplans via A*
- [x] **4.6** Implement **Latency Slider**: increases Traditional cloud planner delay, Proposed barely affected
- [x] **4.7** Create `src/components/simulation/ObstacleMesh.tsx` — red block for clicked cells
- [x] **4.8** Add red pulsing glow effect on frozen Traditional robots

### Key Design Decisions
- `cloudKilled` flag in store → Traditional tick skips planner entirely (robots stay `frozen`)
- `blockedCells: Set<string>` in store → A* treats those as impassable walls
- Latency simulated as fixed-tick cloud-planner intervals (deterministic and frame-safe)

### Files to create/modify
```
src/components/layout/Header.tsx      (create)
src/components/ui/SimControls.tsx     (create)
src/components/layout/ChaosPanel.tsx  (create)
src/components/simulation/ObstacleMesh.tsx  (create)
src/store/useSimStore.ts              (modify — add chaos actions)
src/engine/traditional.ts            (modify — respect cloudKilled + latency)
src/engine/proposed.ts               (modify — respect blockedCells)
```

---

## 📊 Phase 5 — Metrics & Polish

> **Goal**: The simulation looks stunning and tells a data story. All charts live-update. P2P lines animate.

**Entry gate**: Phase 4 complete ✅  
**Exit gate**: Demo-ready. All metrics update correctly. Theme is fully applied.

### Tasks

- [x] **5.1** Create `src/components/ui/MetricCard.tsx` — summary stat cards (Tasks Done, Idle Time, Conflicts)
- [x] **5.2** Create `src/components/layout/MetricsPanel.tsx` — 3 Recharts live charts
  - Chart 1: Tasks Completed over time (Traditional red vs. Proposed green)
  - Chart 2: Cumulative Idle Time (area chart)
  - Chart 3: Conflict Events resolved (sparkline + counter)
- [x] **5.3** Create `src/components/simulation/P2PLines.tsx` — green lines between communicating robots (Proposed side only)
- [x] **5.4** Apply complete warehouse-tone color theme across all components
- [x] **5.5** Add "CENTRALIZED" and "DECENTRALIZED P2P" banners on each canvas side
- [x] **5.6** Add robot path-preview dots (faint dots showing A* route ahead)
- [x] **5.7** Apply `globals.css` — light application background, global font settings, scrollbar, focus ring, keyframes
- [x] **5.8** Apply the current light industrial visual treatment and correct dashboard/chart/fleet sizing
- [x] **5.9** Keep C1/C2 visual rendering aligned with logical charging coordinates
- [x] **5.10** Simplify carrying cargo artwork to one visible box

### Files to create/modify
```
src/components/ui/MetricCard.tsx           (create)
src/components/layout/MetricsPanel.tsx     (create)
src/components/simulation/P2PLines.tsx     (create)
src/styles/globals.css                     (modify)
```

---

## 🏁 Phase 6 — Testing & Demo Prep

> **Goal**: Ship it. Verify numbers. Record demo GIF. Deploy.

**Entry gate**: Phase 5 complete ✅  
**Exit gate**: Live URL + demo GIF ready for SIH judges.

### Tasks

- [ ] **6.1** Run simulation for 200 ticks and compare observed Traditional/Proposed metrics
- [ ] **6.2** Verify chaos scenarios work cleanly (no bugs when WiFi killed mid-run)
- [ ] **6.3** Record demo GIF (suggested: LICEcap / Kap on macOS)
- [ ] **6.4** `vite build` — verify production build works
- [ ] **6.5** Deploy to Vercel or Netlify — get shareable URL
- [ ] **6.6** Update `README.md` with demo GIF + judge link

---

## 📌 Session Log

| Session | Date | Phase | What was done |
|---|---|---|---|
| #1 | — | — | Plan reviewed, phase tracker created |
| #4 | 2026-08-26 | 3 | Added both tick engines, the fixed-step rAF loop, smooth robot movement, and phase validation. |
| #5 | 2026-08-26 | 4 | Added simulation controls, the chaos console, blocked-aisle markers, and verified all fault scenarios. |
| #6 | 2026-08-26 | 4 fix | Centralized cloud routes now remain stale after an aisle block, so affected robots wait until it is cleared. |
| #7 | 2026-08-26 | 5 | MetricCard + MetricsPanel (3 live Recharts), P2PLines animation, CENTRALIZED/DECENTRALIZED banners, path-preview dots, automatic charging at C1/C2 (10% drain per delivery), station labels (P1–D3, C1–C2), task-ring indicator on robots, Phaser 4 warehouse rendering, and globals.css with scrollbar/focus/keyframes. Build: ✅ |
| #8 | 2026-09-04 | 5 fix | Fixed MetricsPanel layout (compact h-[140px] chart, Tooltip isolation via relative, flexible status grid fitting R1–R3 without row clipping), fixed `goingToCharge` state preservation during move resolution in conflictResolution.ts, verified charger reservations (C1/C2), and added top-right light-green charging UI overlay notification (`⚡ R1 CHARGING (20%) C1`). Build: ✅ |
| #9 | 2026-09-05 | 5 polish | Updated the light industrial 2.5D simulation/dashboard presentation, synchronized rendered C1/C2 positions with logical charging cells, and simplified carrying artwork to one clearly identifiable box. Typecheck, build, and diff validation: ✅ |

---

## 🚦 How We Work

1. **Start each session** by looking at the current phase's unchecked tasks
2. **Finish one phase completely** before moving to the next
3. **Mark tasks ✅** here as they're completed
4. **Don't skip phases** — each has an exit gate that the next phase depends on
5. Ask me to **"start Phase N"** when you're ready to begin a phase
