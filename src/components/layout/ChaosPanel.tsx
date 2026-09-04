import { CloudOff, HeartPulse, MapPinOff, Radio, Skull } from 'lucide-react';
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
  const unresponsiveRobots = useSimStore((state) => state.unresponsiveRobots);
  const isDemoAisleBlocked = useSimStore((state) => state.blockedCells.has(`${DEMO_AISLE.x},${DEMO_AISLE.y}`));
  const killCloud = useSimStore((state) => state.killCloud);
  const restoreCloud = useSimStore((state) => state.restoreCloud);
  const toggleBlockCell = useSimStore((state) => state.toggleBlockCell);
  const setLatency = useSimStore((state) => state.setLatency);
  const killRobot = useSimStore((state) => state.killRobot);
  const reviveRobot = useSimStore((state) => state.reviveRobot);
  const toggleRobotUnresponsive = useSimStore((state) => state.toggleRobotUnresponsive);
  const decreaseRobotBattery = useSimStore((state) => state.decreaseRobotBattery);

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

      {/* ── Per-robot kill/revive ──────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <div className="flex h-8 items-center gap-1 border border-[#31585a] bg-[#0c2021] px-2" role="group" aria-label="Kill robots">
          <Skull size={11} strokeWidth={2.1} className="shrink-0 text-[#86aaa4]" />
          <span className="mr-0.5 font-mono text-[9px] tracking-[0.1em] text-[#86aaa4] uppercase">Kill</span>
          {ROBOT_IDS.map((id) => {
            const isKilled = killedRobots.has(id);
            const color = ROBOT_COLORS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => killRobot(id)}
                disabled={isKilled}
                aria-pressed={isKilled}
                title={`Kill ${id}`}
                className="inline-flex h-5 w-8 items-center justify-center border font-mono text-[10px] font-bold tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#f59e0b] disabled:cursor-not-allowed"
                style={{ borderColor: isKilled ? '#5a2020' : `${color}55`, background: isKilled ? '#1a0808' : `${color}18`, color: isKilled ? '#7a3333' : color }}
              >
                {isKilled ? '✕' : id}
              </button>
            );
          })}
        </div>
        <div className="flex h-8 items-center gap-1 border border-[#31585a] bg-[#0c2021] px-2" role="group" aria-label="Revive robots">
          <HeartPulse size={11} strokeWidth={2.1} className="shrink-0 text-[#86aaa4]" />
          <span className="mr-0.5 font-mono text-[9px] tracking-[0.1em] text-[#86aaa4] uppercase">Alive</span>
          {ROBOT_IDS.map((id) => {
            const isKilled = killedRobots.has(id);
            const color = ROBOT_COLORS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => reviveRobot(id)}
                disabled={!isKilled}
                aria-pressed={!isKilled}
                title={`Bring ${id} back online`}
                className="inline-flex h-5 w-8 items-center justify-center border font-mono text-[10px] font-bold tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#f59e0b] disabled:cursor-not-allowed"
                style={{ borderColor: isKilled ? `${color}88` : '#31585a', background: isKilled ? `${color}18` : '#0c2021', color: isKilled ? color : '#426765' }}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Battery test controls ─────────────────────────────────────────── */}
      <div className="flex h-8 items-center gap-1 border border-[#31585a] bg-[#0c2021] px-2" role="group" aria-label="Decrease robot battery">
        <span className="mr-0.5 font-mono text-[9px] tracking-[0.1em] text-[#86aaa4] uppercase">Battery −</span>
        {ROBOT_IDS.map((id) => {
          const color = ROBOT_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => decreaseRobotBattery(id, 10)}
              title={`Decrease ${id} battery by 10%`}
              className="inline-flex h-5 w-8 items-center justify-center border font-mono text-[10px] font-bold tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#f59e0b]"
              style={{ borderColor: `${color}55`, background: `${color}18`, color }}
            >
              {id}
            </button>
          );
        })}
      </div>

      {/* ── Heartbeat failure simulation ─────────────────────────────────── */}
      <div
        className="flex h-8 items-center gap-1 border border-[#31585a] bg-[#0c2021] px-2"
        role="group"
        aria-label="Heartbeat failure simulation"
      >
        <Radio size={11} strokeWidth={2.1} className="shrink-0 text-[#86aaa4]" />
        <span className="mr-0.5 font-mono text-[9px] tracking-[0.1em] text-[#86aaa4] uppercase">Silence</span>
        {ROBOT_IDS.map((id) => {
          const isUnresponsive = unresponsiveRobots.has(id);
          const color = ROBOT_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleRobotUnresponsive(id)}
              disabled={killedRobots.has(id)}
              aria-pressed={isUnresponsive}
              title={isUnresponsive ? `${id} heartbeat stopped — reconnect` : `Stop ${id} heartbeats`}
              className="inline-flex h-5 w-8 items-center justify-center border font-mono text-[10px] font-bold tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#f59e0b] disabled:cursor-not-allowed"
              style={{
                borderColor: isUnresponsive ? '#f15b5b' : `${color}55`,
                background: isUnresponsive ? '#351719' : `${color}18`,
                color: isUnresponsive ? '#ffc2c2' : color,
              }}
            >
              {isUnresponsive ? 'OFF' : id}
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
