# AMR Fleet Simulation — Full Build Plan
> **SIH Project**: Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots

---

## 🎯 Goal

Build a **web-based side-by-side split-screen simulation** that empirically proves the proposed decentralized P2P edge-compute architecture is superior to the traditional centralized cloud approach — in terms of task completion speed, fleet resilience, and conflict resolution — for a Smart India Hackathon (SIH) demo.

---

## 🏗️ Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Modern, fast, type-safe |
| 3D/2D Rendering | **Phaser 4** | Lightweight 2D canvas warehouse renderer |
| State Management | **Zustand** | Lightweight, handles high-frequency simulation ticks |
| Charts | **Recharts** | React-native, easy live metric updates |
| UI Components | **shadcn/ui + Tailwind CSS** | Pre-built accessible components, utility-first styling |
| Build Tool | **Vite** | Fast HMR, optimized builds |

---

## 📐 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        App Shell (React)                          │
│                                                                    │
│  ┌─────────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │  Control Panel  │   │  Split-Screen    │   │  Metrics Bar  │  │
│  │  (Chaos Panel)  │   │  Simulation View │   │  (Recharts)   │  │
│  └─────────────────┘   └──────────────────┘   └───────────────┘  │
│                                  │                                 │
│                    ┌─────────────┴──────────────┐                 │
│                    │                            │                  │
│           ┌────────────────┐          ┌─────────────────┐         │
│           │ Traditional    │          │  Proposed (P2P) │         │
│           │ (Centralized)  │          │  (Decentralized)│         │
│           │ Phaser Canvas  │          │  Phaser Canvas  │         │
│           └────────────────┘          └─────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Simulation Engine    │
                    │   (TypeScript logic)   │
                    │   - A* pathfinding     │
                    │   - Conflict resolver  │
                    │   - rAF tick loop      │
                    └───────────────────────┘
```

---

## 🗂️ File & Folder Structure

```
amr-final/
└── sim/                          # Vite + React app
    ├── public/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx               # Root layout: splits into panels
    │   │
    │   ├── store/
    │   │   └── useSimStore.ts    # Zustand global state
    │   │
    │   ├── engine/               # Pure TS simulation logic (no React)
    │   │   ├── types.ts          # Shared types: Robot, Task, Cell, etc.
    │   │   ├── warehouse.ts      # Fixed grid layout definition
    │   │   ├── astar.ts          # A* pathfinding implementation
    │   │   ├── traditional.ts    # Traditional (centralized) tick logic
    │   │   └── proposed.ts       # Proposed (P2P + priority token) tick logic
    │   │
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── Header.tsx         # App title + sim controls (Play/Pause/Restart/Speed)
    │   │   │   ├── SplitView.tsx      # Side-by-side canvas wrapper
    │   │   │   ├── ChaosPanel.tsx     # Kill WiFi / Block Aisle / Latency slider
    │   │   │   └── MetricsPanel.tsx   # Recharts live metric charts
    │   │   │
    │   │   ├── simulation/
    │   │   │   ├── WarehouseCanvas.tsx   # Phaser 4 Canvas wrapper for one side
    │   │   │   ├── WarehouseGrid.tsx     # Tile grid renderer (floor, shelves, stations)
    │   │   │   ├── RobotMesh.tsx         # Individual robot renderer + label
    │   │   │   ├── ObstacleMesh.tsx      # Blocked aisle obstacle box
    │   │   │   └── P2PLines.tsx          # Green P2P connection lines (Proposed side only)
    │   │   │
    │   │   └── ui/
    │   │       ├── SimControls.tsx       # Play/Pause/Restart + Speed slider
    │   │       └── MetricCard.tsx        # Summary stat card (time, idle %, conflicts)
    │   │
    │   └── styles/
    │       └── globals.css
    │
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

---

## 🗺️ Warehouse Grid Layout

- **Grid size**: 20 × 14 tiles (top-down view)
- **Theme**: Warehouse-tone — beige/orange industrial colors
- **Cell types**:

| Cell Type | Visual | Color |
|---|---|---|
| Floor | Empty tile | Light beige |
| Shelf/Rack | Solid block | Dark brown/orange |
| Choke Point Aisle | Narrow corridor (1-tile wide) | Slightly darker beige |
| Pickup Station | Labeled "P" | Amber/gold |
| Dropoff Station | Labeled "D" | Orange |
| Blocked Obstacle | Rectangle box | Red |

**Layout design goals:**
- At least **2 choke-point corridors** (1-tile-wide intersections) to force conflict scenarios
- Shelf rows create natural narrow aisles
- 3 Pickup stations + 3 Dropoff stations (one per robot's initial route)

```
Example grid (schematic):
. . . . [S S S S] . . . . [S S S S] . .
. . . . [S S S S] . . . . [S S S S] . .
. P . .     A     . . .       A    . . D
. . . . [S S S S] . . . . [S S S S] . .
. . . . [S S S S] . . . . [S S S S] . .
. D . .     A     . . .       A    . . P
...
(S = shelf, A = choke aisle, P = pickup, D = dropoff)
```

---

## 🤖 Robots (Both Sides — 3 AMRs Each)

| Robot | Color | Initial Task |
|---|---|---|
| AMR 1 | Blue 🔵 | Pickup-1 → Dropoff-1 → cycle |
| AMR 2 | Green 🟢 | Pickup-2 → Dropoff-2 → cycle |
| AMR 3 | Yellow 🟡 | Pickup-3 → Dropoff-3 → cycle |

- All robots start at their assigned pickup station
- **Single-box rule**: Each robot carries at most **ONE** box at a time (`pickup -> carry -> dropoff`).
- **Finite workload**: 3 pickup stacks with 2 boxes per stack (6 total boxes in warehouse). Robots freeze/stop when available work is exhausted.
- **Battery & Automatic Charging**: Starts at 100%. `MAX_TASKS = 10` is a per-robot capacity guard where each delivery consumes 10% battery (`100 / MAX_TASKS`). At or below 20%, the robot automatically routes to charging station `C1` or `C2` via A*. `goingToCharge` state is preserved while traveling cell-by-cell to the charger and cleanly transitions to `charging` upon arrival. Charging adds +10% per tick up to 100%, holding a charger reservation (`reservedChargingStations`) during travel and charging, then resumes its preserved task assignment.
- **Charging UI Notification**: A floating light-green overlay notification appears in the top-right of the active warehouse view (`⚡ R1 CHARGING (20%) C1`) while `robot.state === 'charging'` (does not appear while `goingToCharge`) and automatically disappears when charging finishes at 100%.
- Each robot renders with:
  - A colored circle/box sprite
  - A floating label with ID + battery %
  - A faint path-preview line (dots) showing A* route ahead

---

## ⚙️ Simulation Engine

### Shared Types (`engine/types.ts`)

```typescript
type CellType = 'floor' | 'shelf' | 'pickup' | 'dropoff' | 'charging' | 'blocked';

interface Cell {
  x: number; y: number;
  type: CellType;
}

interface Robot {
  id: string;
  color: string;
  position: { x: number; y: number };   // grid coordinates
  path: { x: number; y: number }[];     // current A* route
  task: 'pickup' | 'dropoff';
  battery: number;                        // 0-100
  urgency: number;                        // 0-1, set per task
  timestamp: number;                      // task start epoch ms
  state: 'moving' | 'waiting' | 'frozen' | 'goingToCharge' | 'charging' | 'failed' | 'killed';
  conflictsResolved: number;
  idleTime: number;                       // accumulated ticks waiting
  tasksCompleted: number;
}

interface SimMetrics {
  totalTaskTime: number;        // accumulated simulation ticks
  totalIdleTime: number;        // sum of all robot idle ticks
  conflictCount: number;        // number of conflict resolution events
}
```

### A* Pathfinder (`engine/astar.ts`)

- Standard grid-based A* with Manhattan distance heuristic
- Blocked cells (shelves, obstacles) are impassable
- Returns array of `{x, y}` waypoints from current position to target
- On each tick, robot advances one cell along its path
- **On replanning**: A* is called again with updated blocked cells

### Traditional Simulation (`engine/traditional.ts`)

**Behavior:**
1. Central "cloud planner" runs every N ticks (simulated latency)
2. Each robot sends its position to the cloud → waits for path command
3. **Conflict resolution**: simple stop-and-wait — if two robots would collide on the next step, one stops (waits) until the other clears
4. **Latency slider effect**: cloud planner delay = `latencyMs` setting (20ms – 2000ms)
5. **Cloud kill**: when triggered, all robots set `state = 'frozen'` — they stop indefinitely and don't replan

**Centralized planner logic (simplified):**
```
for each tick:
  simulate latency delay
  for each robot:
    if path is empty → assign new A* path from cloud
    check next step of all robots → if conflict detected:
      lower-priority robot: wait (increment idle time)
    higher-priority robot: advance one cell
```

> [!NOTE]
> Priority in Traditional = simply order of robot ID (static, not dynamic). This is intentionally less fair than the Proposed approach.

### Proposed Simulation (`engine/proposed.ts`)

**Behavior:**
1. Each robot runs its own local A* planner — **no central server involved**
2. Every tick, each robot **broadcasts** its `{position, velocity, path, priority}` state to all peers
3. **Conflict resolution (Priority Token Protocol)**:
   - Both robots check if paths conflict in space AND time (will they occupy the same cell within the next 3 steps?)
   - If conflict detected → compare priority: `urgency > battery > timestamp (oldest task) > robot ID`
   - Higher-priority robot: **reserves the choke point** (token/lock) and proceeds
   - Lower-priority robot: **yields** — waits one tick, or replans an alternate route via A*
   - Winner releases the lock → waiting robot proceeds
4. **Blocked aisle**: robot broadcasts `aisle blocked` → all peers receiving this immediately replan around that cell via A*
5. **No freezing on cloud kill** — P2P comms continue unaffected

**P2P visualization (Proposed side only):**
- Green lines drawn between robot pairs when they are actively communicating (within range / detecting conflict)
- Lines fade when not communicating

---

## 🎮 Simulation Controls

Located in the **Header** bar:

| Control | Behavior |
|---|---|
| ▶ Play | Start/resume simulation on both sides simultaneously |
| ⏸ Pause | Pause both sides at the same tick |
| 🔄 Restart | Reset all robots to initial positions, clear metrics |
| Speed: 0.5× / 1× / 2× / 4× | Multiplier applied to rAF tick rate |

---

## ⚡ Chaos Engineering Panel

Right-side panel (or top toolbar):

| Control | Traditional Effect | Proposed Effect |
|---|---|---|
| **KILL** | Robot freezes immediately in place (`state = 'killed'`). Retains unfinished task. Task is inherited by peer. Acts as dynamic obstacle. | Same behavior. Peer detects failure and inherits task; if carrying cargo, coverer performs cargo rescue. |
| **SILENCE** | N/A (Traditional has no heartbeats) | Stops simulated heartbeats for selected robot. Peers mark it `suspected` (2 ticks) then `failed` (5 ticks) and trigger task recovery. |
| **ALIVE** | Re-activates killed robot (`state = 'moving'`). | Re-activates killed/silenced robot (`state = 'moving'`). Work already owned by coverer remains protected until handoff. |
| **Battery -** | Manually decreases selected robot's battery by 10% for testing/debugging automatic charging. | Same behavior. At/below 20%, robot diverts to charging station (`C1`/`C2`). |
| **Kill Cloud WiFi** | All 3 robots freeze immediately (`state = 'frozen'`). Idle time counter spikes. | Zero effect — robots continue P2P coordination |
| **Block Aisle** (click on grid) | Robot approaching blocked aisle stops and waits at blocked waypoint until cleared. | Robot(s) detect block via P2P broadcast, immediately replan alternate A* route |
| **Latency Slider** (20ms – 2000ms) | Increases delay before cloud planner responds → slower reactions, more wait time | Zero effect on Proposed control loop |

> [!IMPORTANT]
> "Kill Cloud WiFi" is the single most powerful demo moment — Traditional side freezes, Proposed continues. Lead with this in the judging demo.

---

## 📊 Live Metrics Panel & Dashboard Layout

Three **live updating Recharts line charts** below the simulation views:

- **Compact Layout**: The TrendChart card uses `relative` positioning to contain Recharts Tooltip hover bounds, and full-page mode operates at `h-[140px]` height to avoid vertical overflow.
- **Robot Health List**: Formatted with compact `py-1.5` padding, `space-y-1.5` gap, and flexible status grid (`grid-cols-[2.25rem_minmax(0,1fr)_auto]`) so all three robots (**R1**, **R2**, **R3**) remain fully represented and visible.

### Chart 1 — Total Task Completion Time (Line Chart)
- X-axis: Simulation time (ticks)
- Y-axis: Tasks completed
- Two lines: Traditional (red) vs. Proposed (green)
- **Expected result**: Proposed line rises faster → ≥20% more throughput

### Chart 2 — Fleet Idle Time (Bar or Area Chart)
- X-axis: Simulation time
- Y-axis: Cumulative idle ticks across all robots
- Traditional will accumulate idle time faster (stop-and-wait)

### Chart 3 — Conflict Events Resolved (Counter + Sparkline)
- Shows count of conflict resolution events for both sides
- Proposed shows more granular resolution events (token negotiations)
- Traditional shows fewer events but longer wait times per event

**Summary stat cards** (above charts):
```
[ Tasks Done: 12 | 18 ]   [ Idle Time: 45s | 12s ]   [ Conflicts: 3 | 7 resolved ]
    Traditional  Proposed      Traditional  Proposed       Trad     Proposed
```

---

## 🎨 Visual Theme — Warehouse Tone

| Element | Color |
|---|---|
| App background | `#1a1209` (very dark brown) |
| Panel backgrounds | `#2d1f0e` (dark oak) |
| Grid floor tiles | `#c8a96e` (sandy beige) |
| Shelf tiles | `#6b4226` (dark wood brown) |
| Choke aisle | `#b8956a` (slightly different beige) |
| Pickup station | `#f59e0b` (amber) |
| Dropoff station | `#ea7c1a` (orange) |
| Obstacle block | `#ef4444` (red) |
| AMR 1 | `#3b82f6` (blue) |
| AMR 2 | `#22c55e` (green) |
| AMR 3 | `#eab308` (yellow) |
| P2P mesh lines | `#4ade80` (bright green, semi-transparent) |
| Traditional frozen indicator | Red pulsing glow around robots |
| Text / labels | `#fef3c7` (warm cream) |
| Traditional side label | `#ef4444` banner — "CENTRALIZED" |
| Proposed side label | `#22c55e` banner — "DECENTRALIZED P2P" |

---

## 🔄 Simulation Tick Loop

```
requestAnimationFrame loop:
  Δt = current_time - last_time
  if Δt >= (BASE_TICK_MS / speedMultiplier):
    last_time = current_time
    tick_count++

    // Run both simulations in lockstep
    traditional_tick(store.traditionalState)
    proposed_tick(store.proposedState)

    // Update metrics
    updateMetrics()

    // Trigger React re-render via Zustand state update
    store.setFrame(tick_count)
```

- `BASE_TICK_MS` = 200ms (5 ticks/sec at 1×)
- Speed 2× → 100ms between ticks
- Speed 4× → 50ms between ticks
- Phaser renders at display refresh rate; robot positions lerp smoothly between grid steps

---

## 🗃️ Zustand Store Structure (`store/useSimStore.ts`)

```typescript
interface SimStore {
  // Simulation control
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  tick: number;

  // Chaos state
  cloudKilled: boolean;
  blockedCells: Set<string>;       // "x,y" strings
  latencyMs: number;               // 20–2000

  // Traditional simulation state
  traditional: {
    robots: Robot[];
    metrics: SimMetrics;
  };

  // Proposed simulation state
  proposed: {
    robots: Robot[];
    metrics: SimMetrics;
    p2pLinks: [string, string][];  // active P2P communication pairs
  };

  // Actions
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (s: number) => void;
  killCloud: () => void;
  restoreCloud: () => void;
  toggleBlockCell: (x: number, y: number) => void;
  setLatency: (ms: number) => void;
}
```

---

## 🏁 Implementation Phases

### Phase 1 — Foundation (Day 1)
- [ ] Scaffold Vite + React + TypeScript project
- [ ] Install all dependencies (Phaser 4, Zustand, Recharts, shadcn/ui, Tailwind)
- [ ] Build `engine/types.ts` and `engine/warehouse.ts` (grid layout)
- [ ] Implement `engine/astar.ts` — test with unit tests

### Phase 2 — Rendering (Day 1–2)
- [ ] Build `WarehouseGrid.tsx` — render tile grid in Phaser 4 with warehouse-tone colors
- [ ] Build `RobotMesh.tsx` — colored box + floating label
- [ ] Build `SplitView.tsx` — two Phaser canvases side by side
- [ ] Add top-down orthographic camera in Phaser 4

### Phase 3 — Simulation Logic (Day 2–3)
- [ ] Implement `engine/traditional.ts` — stop-and-wait, centralized planner, latency simulation
- [ ] Implement `engine/proposed.ts` — priority token protocol, P2P broadcasts, local A* replanning
- [ ] Wire engines into Zustand store
- [ ] Implement rAF tick loop in `App.tsx`

### Phase 4 — Controls & Chaos (Day 3)
- [ ] Build `SimControls.tsx` — Play/Pause/Restart/Speed
- [ ] Build `ChaosPanel.tsx` — Kill WiFi toggle, click-to-block aisle, latency slider
- [ ] Implement cloud kill effect (freeze Traditional, no effect on Proposed)
- [ ] Implement block aisle effect (Traditional waits, Proposed rerouts)

### Phase 5 — Metrics & Polish (Day 4)
- [ ] Build `MetricsPanel.tsx` with 3 Recharts charts
- [ ] Build `MetricCard.tsx` summary cards
- [ ] Build `P2PLines.tsx` — green mesh lines for active P2P comms
- [ ] Apply warehouse-tone theme across all components
- [ ] Add "CENTRALIZED" and "DECENTRALIZED P2P" banners on each side
- [ ] Add robot path preview dots

### Phase 6 — Testing & Demo Prep (Day 5)
- [ ] Verify ≥20% task throughput advantage for Proposed
- [ ] Record a demo GIF for GitHub README
- [ ] Build for production (`vite build`)
- [ ] Deploy to Vercel/Netlify for shareable judge link

---

## 📦 Dependencies (`package.json`)

```json
{
  "dependencies": {
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "phaser": "^4.2.1",
    "zustand": "^5.0.15",
    "recharts": "3.8.0",
    "tailwindcss": "^4",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "vite": "^8",
    "@vitejs/plugin-react": "^6",
    "typescript": "~6"
  }
}
```

**shadcn/ui setup:** Run `npx shadcn@latest init` after scaffolding.

---

## 🎬 Demo Script for Judges

1. **Load the app** — Judges see the split-screen warehouse with 3 colored AMRs on each side
2. **Hit Play** — Both simulations start simultaneously; robots begin navigating and conflict-resolving
3. **Point out metrics** — Proposed throughput line rising faster; less idle time accumulating
4. **Hit Kill Cloud WiFi** — Traditional side freezes completely. Proposed side continues without blinking.
5. **Hit Block Aisle** (click an aisle cell) — Traditional robot stops at entrance. Proposed robots detect via P2P and reroute in real-time.
6. **Drag Latency slider to 2000ms** — Traditional robots visibly slow down at choke points. Proposed barely affected.
7. **Show final metrics bar chart** — ≥20% faster task completion, dramatically lower idle time.

> [!TIP]
> Start the demo with step 4 ("Kill Cloud WiFi") for maximum judge impact. The visual contrast is immediate and self-explanatory.

---

## ✅ SIH Success Criteria Mapping

| SIH Requirement | How Simulation Proves It |
|---|---|
| Zero inter-robot collisions | Priority token protocol ensures conflict resolution before collision — no overlap in Proposed side |
| ≥20% faster task completion | Live Recharts chart shows Proposed completing tasks faster over time |
| Decentralized Communication | P2P green mesh lines visible on Proposed side; no central node |
| Dynamic conflict resolution | Conflict counter + visual negotiation visible at choke points |
| Task re-routing on blockage | Block Aisle chaos button demonstrates real-time A* replanning |
| Fleet Dashboard | Metrics panel serves as the passive telemetry dashboard |
