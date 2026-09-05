import { CloudOff, HeartPulse, MapPinOff, Radio, Skull, Zap } from 'lucide-react';
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
  const warehousePower = useSimStore((state) => state.warehousePower);
  const toggleWarehousePower = useSimStore((state) => state.toggleWarehousePower);
  const killCloud = useSimStore((state) => state.killCloud);
  const restoreCloud = useSimStore((state) => state.restoreCloud);
  const toggleBlockCell = useSimStore((state) => state.toggleBlockCell);
  const setLatency = useSimStore((state) => state.setLatency);
  const killRobot = useSimStore((state) => state.killRobot);
  const reviveRobot = useSimStore((state) => state.reviveRobot);
  const toggleRobotUnresponsive = useSimStore((state) => state.toggleRobotUnresponsive);
  const decreaseRobotBattery = useSimStore((state) => state.decreaseRobotBattery);

  return (
    <section className="chaos-panel flex flex-wrap items-center justify-end gap-1.5" aria-label="Fault injection controls">
      <span className="font-sans text-[9px] font-bold tracking-[0.12em] text-[#68777d] uppercase">Chaos lab</span>

      {/* ── Cloud kill ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={cloudKilled ? restoreCloud : killCloud}
        aria-pressed={cloudKilled}
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-sans text-[10px] font-bold tracking-[0.06em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3]"
        style={{
          borderColor: cloudKilled ? '#e58a8a' : '#d8dce0',
          background: cloudKilled ? '#fff2f2' : '#ffffff',
          color: cloudKilled ? '#a04444' : '#52636b',
        }}
      >
         <CloudOff size={14} strokeWidth={2.1} />
        {cloudKilled ? 'Cloud offline' : 'Kill cloud'}
      </button>

      {/* ── Warehouse power ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleWarehousePower}
        aria-pressed={!warehousePower}
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-sans text-[10px] font-bold tracking-[0.06em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3]"
        style={{
          borderColor: !warehousePower ? '#e58a8a' : '#d8dce0',
          background: !warehousePower ? '#fff7ed' : '#ffffff',
          color: !warehousePower ? '#a04444' : '#52636b',
        }}
      >
        <Zap size={14} strokeWidth={2.1} />
        {!warehousePower ? 'Power off' : 'Grid power'}
      </button>

      {/* ── Per-robot kill/revive ──────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <div className="flex h-8 items-center gap-1 rounded-sm border border-[#d8dce0] bg-white px-2 shadow-sm" role="group" aria-label="Kill robots">
          <Skull size={11} strokeWidth={2.1} className="shrink-0 text-[#7a858b]" />
          <span className="mr-0.5 font-sans text-[9px] tracking-[0.08em] text-[#68777d] uppercase">Kill</span>
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
                className="inline-flex h-5 w-8 items-center justify-center border font-sans text-[10px] font-bold tracking-[0.04em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#2f80c3] disabled:cursor-not-allowed"
                style={{ borderColor: isKilled ? '#5a2020' : `${color}55`, background: isKilled ? '#1a0808' : `${color}18`, color: isKilled ? '#7a3333' : color }}
              >
                {isKilled ? '✕' : id}
              </button>
            );
          })}
        </div>
        <div className="flex h-8 items-center gap-1 rounded-sm border border-[#d8dce0] bg-white px-2 shadow-sm" role="group" aria-label="Revive robots">
          <HeartPulse size={11} strokeWidth={2.1} className="shrink-0 text-[#7a858b]" />
          <span className="mr-0.5 font-sans text-[9px] tracking-[0.08em] text-[#68777d] uppercase">Alive</span>
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
                className="inline-flex h-5 w-8 items-center justify-center border font-sans text-[10px] font-bold tracking-[0.04em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#2f80c3] disabled:cursor-not-allowed"
                style={{ borderColor: isKilled ? `${color}88` : '#31585a', background: isKilled ? `${color}18` : '#0c2021', color: isKilled ? color : '#426765' }}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Battery test controls ─────────────────────────────────────────── */}
      <div className="flex h-8 items-center gap-1 rounded-sm border border-[#d8dce0] bg-white px-2 shadow-sm" role="group" aria-label="Decrease robot battery">
        <span className="mr-0.5 font-sans text-[9px] tracking-[0.08em] text-[#68777d] uppercase">Battery −</span>
        {ROBOT_IDS.map((id) => {
          const color = ROBOT_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => decreaseRobotBattery(id, 10)}
              title={`Decrease ${id} battery by 10%`}
              className="inline-flex h-5 w-8 items-center justify-center border font-sans text-[10px] font-bold tracking-[0.04em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#2f80c3]"
              style={{ borderColor: `${color}55`, background: `${color}18`, color }}
            >
              {id}
            </button>
          );
        })}
      </div>

      {/* ── Heartbeat failure simulation ─────────────────────────────────── */}
      <div
        className="flex h-8 items-center gap-1 rounded-sm border border-[#d8dce0] bg-white px-2 shadow-sm"
        role="group"
        aria-label="Heartbeat failure simulation"
      >
        <Radio size={11} strokeWidth={2.1} className="shrink-0 text-[#7a858b]" />
        <span className="mr-0.5 font-sans text-[9px] tracking-[0.08em] text-[#68777d] uppercase">Silence</span>
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
              className="inline-flex h-5 w-8 items-center justify-center border font-sans text-[10px] font-bold tracking-[0.04em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[#2f80c3] disabled:cursor-not-allowed"
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
        className="inline-flex h-8 items-center gap-1.5 border px-2.5 font-sans text-[10px] font-bold tracking-[0.06em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3]"
        style={{
          borderColor: isDemoAisleBlocked ? '#e58a8a' : '#d8dce0',
          background: isDemoAisleBlocked ? '#fff2f2' : '#ffffff',
          color: isDemoAisleBlocked ? '#a04444' : '#52636b',
        }}
      >
        <MapPinOff size={14} strokeWidth={2.1} />
        {isDemoAisleBlocked ? 'Clear aisle' : 'Block aisle'}
      </button>

      {/* ── Cloud lag slider ───────────────────────────────────────────── */}
      <label className="flex h-8 items-center gap-2 rounded-sm border border-[#d8dce0] bg-white px-2 shadow-sm" title="Centralized cloud planning delay">
        <span className="font-sans text-[9px] tracking-[0.08em] text-[#68777d] uppercase">Cloud lag</span>
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
        <output className="w-11 text-right font-sans text-[9px] font-bold tabular-nums text-[#a04444]">{latencyMs}ms</output>
      </label>
    </section>
  );
}
