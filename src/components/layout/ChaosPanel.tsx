import { CloudOff, MapPinOff } from 'lucide-react';
import { useSimStore } from '../../store/useSimStore';

// A shared route on the upper transfer lane. Users can also click any floor tile.
const DEMO_AISLE = { x: 10, y: 2 };

/** Fault-injection controls used to contrast the two coordination strategies. */
export function ChaosPanel() {
  const cloudKilled = useSimStore((state) => state.cloudKilled);
  const latencyMs = useSimStore((state) => state.latencyMs);
  const isDemoAisleBlocked = useSimStore((state) => state.blockedCells.has(`${DEMO_AISLE.x},${DEMO_AISLE.y}`));
  const killCloud = useSimStore((state) => state.killCloud);
  const restoreCloud = useSimStore((state) => state.restoreCloud);
  const toggleBlockCell = useSimStore((state) => state.toggleBlockCell);
  const setLatency = useSimStore((state) => state.setLatency);

  return (
    <section className="flex flex-wrap items-center justify-end gap-2" aria-label="Fault injection controls">
      <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#9d5a3e] uppercase">Chaos lab</span>

      <button
        type="button"
        onClick={cloudKilled ? restoreCloud : killCloud}
        aria-pressed={cloudKilled}
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
        style={{
          borderColor: cloudKilled ? '#ef4444' : '#6b4226',
          background: cloudKilled ? '#3b1010' : '#120c05',
          color: cloudKilled ? '#fca5a5' : '#d6a55b',
        }}
      >
        <CloudOff size={14} strokeWidth={2.1} />
        {cloudKilled ? 'Cloud offline' : 'Kill cloud'}
      </button>

      <button
        type="button"
        onClick={() => toggleBlockCell(DEMO_AISLE.x, DEMO_AISLE.y)}
        aria-pressed={isDemoAisleBlocked}
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
        style={{
          borderColor: isDemoAisleBlocked ? '#ef4444' : '#6b4226',
          background: isDemoAisleBlocked ? '#3b1010' : '#120c05',
          color: isDemoAisleBlocked ? '#fca5a5' : '#d6a55b',
        }}
      >
        <MapPinOff size={14} strokeWidth={2.1} />
        {isDemoAisleBlocked ? 'Clear aisle' : 'Block aisle'}
      </button>

      <label className="flex h-8 items-center gap-2 border border-[#6b4226] bg-[#120c05] px-2" title="Centralized cloud planning delay">
        <span className="font-mono text-[9px] tracking-[0.1em] text-[#d6a55b] uppercase">Cloud lag</span>
        <input
          type="range"
          min="20"
          max="2000"
          step="20"
          value={latencyMs}
          onChange={(event) => setLatency(Number(event.target.value))}
          className="h-1 w-16 cursor-pointer accent-[#ef4444]"
          aria-label="Centralized cloud planning latency"
        />
        <output className="w-11 text-right font-mono text-[9px] font-bold tabular-nums text-[#fca5a5]">{latencyMs}ms</output>
      </label>
    </section>
  );
}
