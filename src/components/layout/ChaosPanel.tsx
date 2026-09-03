import { CloudOff, MapPinOff, Skull } from 'lucide-react';
import { useSimStore } from '../../store/useSimStore';

// A shared route on the upper transfer lane. Users can also click any floor tile.
const DEMO_AISLE = { x: 10, y: 2 };

const ROBOT_IDS = ['R1', 'R2', 'R3'] as const;

// Robot accent colours — match the engine palette
const ROBOT_COLORS: Record<string, string> = {
  R1: '#3b82f6',
  R2: '#22c55e',
  R3: '#eab308',
};

/** Fault-injection controls used to contrast the two coordination strategies. */
export function ChaosPanel() {
  const cloudKilled = useSimStore((state) => state.cloudKilled);
  const latencyMs = useSimStore((state) => state.latencyMs);
  const killedRobots = useSimStore((state) => state.killedRobots);
  const isDemoAisleBlocked = useSimStore((state) => state.blockedCells.has(`${DEMO_AISLE.x},${DEMO_AISLE.y}`));
  const killCloud = useSimStore((state) => state.killCloud);
  const restoreCloud = useSimStore((state) => state.restoreCloud);
  const toggleBlockCell = useSimStore((state) => state.toggleBlockCell);
  const setLatency = useSimStore((state) => state.setLatency);
  const killRobot = useSimStore((state) => state.killRobot);

  return (
    <section className="flex flex-wrap items-center justify-end gap-2" aria-label="Fault injection controls">
      <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#86aaa4] uppercase">Chaos lab</span>

      {/* ── Cloud kill ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={cloudKilled ? restoreCloud : killCloud}
        aria-pressed={cloudKilled}
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
        style={{
          borderColor: cloudKilled ? '#f15b5b' : '#31585a',
          background: cloudKilled ? '#351719' : '#0c2021',
          color: cloudKilled ? '#ffc2c2' : '#86aaa4',
        }}
      >
        <CloudOff size={14} strokeWidth={2.1} />
        {cloudKilled ? 'Cloud offline' : 'Kill cloud'}
      </button>

      {/* ── Per-robot kill (permanent) ─────────────────────────────────── */}
      <div
        className="flex items-center gap-1 border border-[#31585a] bg-[#0c2021] px-2 h-8"
        role="group"
        aria-label="Robot failure controls"
      >
        <Skull size={11} strokeWidth={2.1} className="text-[#86aaa4] shrink-0" />
        <span className="font-mono text-[9px] tracking-[0.1em] text-[#86aaa4] uppercase mr-0.5">Kill</span>
        {ROBOT_IDS.map((id) => {
          const isKilled = killedRobots.has(id);
          const color = ROBOT_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => { if (!isKilled) killRobot(id); }}
              disabled={isKilled}
              aria-pressed={isKilled}
              title={
                isKilled
                  ? `${id} is offline — Restart to reset`
                  : `Kill ${id}: its remaining tasks will be picked up by the first free robot (Proposed side only)`
              }
              className="inline-flex h-5 w-8 items-center justify-center font-mono text-[10px] font-bold tracking-[0.06em] border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#f59e0b] disabled:cursor-not-allowed"
              style={{
                borderColor: isKilled ? '#5a2020' : `${color}55`,
                background: isKilled ? '#1a0808' : `${color}18`,
                color: isKilled ? '#7a3333' : color,
              }}
            >
              {isKilled ? '✕' : id}
            </button>
          );
        })}
      </div>

      {/* ── Block aisle ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => toggleBlockCell(DEMO_AISLE.x, DEMO_AISLE.y)}
        aria-pressed={isDemoAisleBlocked}
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
        style={{
          borderColor: isDemoAisleBlocked ? '#f15b5b' : '#31585a',
          background: isDemoAisleBlocked ? '#351719' : '#0c2021',
          color: isDemoAisleBlocked ? '#ffc2c2' : '#86aaa4',
        }}
      >
        <MapPinOff size={14} strokeWidth={2.1} />
        {isDemoAisleBlocked ? 'Clear aisle' : 'Block aisle'}
      </button>

      {/* ── Cloud lag slider ───────────────────────────────────────────── */}
      <label className="flex h-8 items-center gap-2 border border-[#31585a] bg-[#0c2021] px-2" title="Centralized cloud planning delay">
        <span className="font-mono text-[9px] tracking-[0.1em] text-[#86aaa4] uppercase">Cloud lag</span>
        <input
          type="range"
          min="20"
          max="2000"
          step="20"
          value={latencyMs}
          onChange={(event) => setLatency(Number(event.target.value))}
          className="h-1 w-16 cursor-pointer accent-[#f15b5b]"
          aria-label="Centralized cloud planning latency"
        />
        <output className="w-11 text-right font-mono text-[9px] font-bold tabular-nums text-[#ffc2c2]">{latencyMs}ms</output>
      </label>
    </section>
  );
}
