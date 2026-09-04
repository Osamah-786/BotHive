import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import { Activity, Battery, Gauge, RadioTower, ShieldCheck } from 'lucide-react';
import { useSimStore } from '../../store/useSimStore';
import type { MetricsSnapshot, Robot, SimMetrics } from '../../engine/types';
import { BASE_TICK_MS, ENERGY_PER_TASK, MAX_TASKS } from '../../engine/simulation';
import { MetricCard } from '../ui/MetricCard';

type ChartDatum = {
  tick: number;
  cloudTasks: number;
  meshTasks: number;
  cloudIdle: number;
  meshIdle: number;
  cloudConflicts: number;
  meshConflicts: number;
};

const CLOUD = '#f15b5b';
const MESH = '#51d38d';

/** Live, compact mission ledger driven directly by the simulation store. */
export function MetricsPanel({ fullPage }: { fullPage?: boolean }) {
  const tick = useSimStore((state) => state.tick);
  const traditional = useSimStore((state) => state.traditional.metrics);
  const proposed = useSimStore((state) => state.proposed.metrics);
  const traditionalRobots = useSimStore((state) => state.traditional.robots);
  const proposedRobots = useSimStore((state) => state.proposed.robots);
  const p2pLinks = useSimStore((state) => state.proposed.p2pLinks);
  const chartData = buildChartData(tick, traditional, proposed);

  return (
    <section
      className={`flex flex-col border-[#244446] bg-[#081a1b] ${fullPage ? 'h-full overflow-y-auto border' : 'h-[206px] flex-shrink-0 border-t'}`}
      aria-label="Fleet telemetry"
    >
      <div className="flex h-8 flex-shrink-0 items-center justify-between border-b border-[#173738] px-4 md:px-5">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-[#f2c14e]" aria-hidden="true" />
          <h2 className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#e5f3ee] uppercase">Fleet telemetry</h2>
          <span className="font-mono text-[8px] tracking-[0.12em] text-[#60817d] uppercase">live comparison</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] tabular-nums text-[#86aaa4]">
          <RadioTower size={12} className="text-[#51d38d]" aria-hidden="true" />
          T+{formatSeconds(tick)}s
        </div>
      </div>

      <div className={`${fullPage ? 'flex min-h-0 flex-1 flex-col gap-px bg-[#244446]' : 'grid min-h-0 flex-1 grid-cols-1 gap-px bg-[#244446] lg:grid-cols-[minmax(390px,0.95fr)_minmax(560px,1.5fr)]'}`}>
        <div className={`grid gap-px bg-[#244446] ${fullPage ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-3'}`}>
          <MetricCard
            label="Tasks done"
            cloudValue={String(traditional.totalTasksCompleted)}
            meshValue={String(proposed.totalTasksCompleted)}
            detail="completed cycles"
          />
          <MetricCard
            label="Idle load"
            cloudValue={`${formatSeconds(traditional.totalIdleTime)}s`}
            meshValue={`${formatSeconds(proposed.totalIdleTime)}s`}
            detail="fleet wait time"
          />
          <MetricCard
            label="Conflicts"
            cloudValue={String(traditional.conflictCount)}
            meshValue={String(proposed.conflictCount)}
            detail="resolution events"
          />
        </div>

        <div className={`grid min-h-0 gap-px bg-[#244446] ${fullPage ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-3'}`}>
          <TrendChart title="Tasks complete" data={chartData} cloudKey="cloudTasks" meshKey="meshTasks" kind="line" fullPage={fullPage} />
          <TrendChart title="Cumulative idle" data={chartData} cloudKey="cloudIdle" meshKey="meshIdle" kind="area" fullPage={fullPage} />
          <TrendChart title="Conflict events" data={chartData} cloudKey="cloudConflicts" meshKey="meshConflicts" kind="line" fullPage={fullPage} />
        </div>

        {fullPage && (
          <DispatchDesk
            tick={tick}
            cloudRobots={traditionalRobots}
            meshRobots={proposedRobots}
            cloudMetrics={traditional}
            meshMetrics={proposed}
            peerLinks={p2pLinks}
          />
        )}
      </div>
    </section>
  );
}

interface DispatchDeskProps {
  tick: number;
  cloudRobots: Robot[];
  meshRobots: Robot[];
  cloudMetrics: SimMetrics;
  meshMetrics: SimMetrics;
  peerLinks: { from: string; to: string }[];
}

/** The dashboard's operational layer: health, dispatch order, and coordination state. */
function DispatchDesk({ tick, cloudRobots, meshRobots, cloudMetrics, meshMetrics, peerLinks }: DispatchDeskProps) {
  const priorityQueue = [...meshRobots].sort(compareMeshPriority);
  const meshSummary = summarizeFleet(meshRobots, tick);
  const cloudSummary = summarizeFleet(cloudRobots, tick);
  const waiting = meshRobots.filter((robot) => robot.state === 'waiting');

  return (
    <div className="grid gap-px bg-[#244446] xl:grid-cols-[1.25fr_1fr]">
      <article className="bg-[#0c2021] px-4 py-3">
        <PanelHeading icon={Battery} title="Robot health" detail="P2P fleet · live battery and route load" />
        <div className="mt-3 space-y-2">
          {meshRobots.map((robot) => (
            <RobotHealthRow key={robot.id} robot={robot} />
          ))}
        </div>
      </article>

      <article className="bg-[#0c2021] px-4 py-3">
        <PanelHeading icon={Gauge} title="Dispatch priority" detail="next reservation order" />
        <ol className="mt-3 divide-y divide-[#244446] border-y border-[#244446]">
          {priorityQueue.map((robot, index) => (
            <li key={robot.id} className="grid grid-cols-[1.5rem_2.4rem_1fr_auto] items-center gap-2 py-2 font-mono">
              <span className="text-[10px] font-bold tabular-nums text-[#f2c14e]">0{index + 1}</span>
              <span className="text-[10px] font-bold" style={{ color: robot.color }}>{robot.id}</span>
              <span className="min-w-0 text-[9px] tracking-[0.04em] text-[#b7ceca]">
                U {Math.round(robot.urgency * 100)} · B {Math.round(robot.battery)} · idle {formatSeconds(robot.idleTime)}s
              </span>
              <span className={`text-[8px] font-bold tracking-[0.1em] uppercase ${robot.state === 'waiting' ? 'text-[#f2c14e]' : 'text-[#51d38d]'}`}>
                {robot.state === 'waiting' ? 'yield' : 'ready'}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 font-mono text-[8px] leading-relaxed tracking-[0.05em] text-[#60817d] uppercase">
          Priority: urgency → battery → oldest task → robot ID
        </p>
      </article>

      <article className="bg-[#0c2021] px-4 py-3">
        <PanelHeading icon={Activity} title="Fleet utilization" detail="live operating state" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FleetUtilization side="Cloud" color={CLOUD} summary={cloudSummary} />
          <FleetUtilization side="P2P mesh" color={MESH} summary={meshSummary} />
        </div>
      </article>

      <article className="bg-[#0c2021] px-4 py-3">
        <PanelHeading icon={ShieldCheck} title="Coordination status" detail="P2P reservation desk" />
        <div className="mt-3 grid grid-cols-3 divide-x divide-[#244446] border-y border-[#244446]">
          <StatusReadout label="Peer links" value={String(peerLinks.length)} color={MESH} />
          <StatusReadout label="Active holds" value={String(waiting.length)} color={waiting.length ? '#f2c14e' : MESH} />
          <StatusReadout label="Avoided conflicts" value={String(meshMetrics.conflictCount)} color="#f2c14e" />
        </div>
        <div className="mt-3 space-y-1.5 font-mono text-[9px]">
          {waiting.length > 0 ? (
            <p className="text-[#f4d68c]">HOLD · {waiting.map((robot) => robot.id).join(', ')} yielding to a protected reservation.</p>
          ) : peerLinks.length > 0 ? (
            <p className="text-[#87eab5]">MESH · {peerLinks.map((link) => `${link.from}↔${link.to}`).join('  ')}</p>
          ) : (
            <p className="text-[#87eab5]">CLEAR · Independent routes are progressing.</p>
          )}
          <p className="text-[#60817d]">Cloud planner has logged {cloudMetrics.conflictCount} resolution events.</p>
        </div>
      </article>
    </div>
  );
}

function PanelHeading({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-[#f2c14e]" aria-hidden="true" />
        <h3 className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#e5f3ee] uppercase">{title}</h3>
      </div>
      <span className="font-mono text-[8px] tracking-[0.08em] text-[#60817d] uppercase">{detail}</span>
    </div>
  );
}

function RobotHealthRow({ robot }: { robot: Robot }) {
  const batteryColor = robot.battery < 25 ? '#f15b5b' : robot.battery < 50 ? '#f2c14e' : MESH;
  const target = `${robot.task === 'pickup' ? 'P' : 'D'}${robot.stationIndex + 1}`;
  const remainingTasks = Math.max(0, Math.min(MAX_TASKS, Math.floor((robot.battery + 0.0001) / ENERGY_PER_TASK)));
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.4rem] items-center gap-3 border border-[#244446] bg-[#091d1e] px-2.5 py-2">
      <span className="font-mono text-[10px] font-bold" style={{ color: robot.color }}>{robot.id}</span>
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[8px] tracking-[0.08em] uppercase">
          <span className="text-[#86aaa4]">Target {target} · {robot.path.length} cells</span>
          <span style={{ color: batteryColor }}>{robot.battery.toFixed(2)}% · {robot.tasksCompleted} done · {remainingTasks} left</span>
        </div>
        <div className="h-1 overflow-hidden bg-[#173738]" aria-label={`${robot.id} battery ${robot.battery.toFixed(2)} percent`}>
          <div className="h-full transition-[width] duration-200" style={{ width: `${robot.battery}%`, background: batteryColor }} />
        </div>
      </div>
      <span className={`text-right font-mono text-[8px] font-bold tracking-[0.1em] uppercase ${robot.state === 'moving' ? 'text-[#87eab5]' : robot.state === 'waiting' ? 'text-[#f4d68c]' : 'text-[#f59a9a]'}`}>
        {robot.state}
      </span>
    </div>
  );
}

interface FleetSummary {
  moving: number;
  waiting: number;
  frozen: number;
  averageBattery: number;
  utilization: number;
}

function summarizeFleet(robots: Robot[], tick: number): FleetSummary {
  const total = Math.max(robots.length, 1);
  const activeTicks = Math.max(tick, 1);
  return {
    moving: robots.filter((robot) => robot.state === 'moving').length,
    waiting: robots.filter((robot) => robot.state === 'waiting').length,
    frozen: robots.filter((robot) => robot.state === 'frozen').length,
    averageBattery: robots.reduce((sum, robot) => sum + robot.battery, 0) / total,
    utilization: robots.reduce((sum, robot) => sum + Math.max(0, activeTicks - robot.idleTime) / activeTicks, 0) / total,
  };
}

function FleetUtilization({ side, color, summary }: { side: string; color: string; summary: FleetSummary }) {
  const utilization = Math.round(summary.utilization * 100);
  return (
    <div className="border border-[#244446] bg-[#091d1e] px-2.5 py-2">
      <div className="flex items-baseline justify-between font-mono">
        <span className="text-[9px] font-bold tracking-[0.1em] uppercase" style={{ color }}>{side}</span>
        <span className="text-sm font-bold tabular-nums text-[#e5f3ee]">{utilization}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-[#173738]">
        <div className="h-full transition-[width] duration-200" style={{ width: `${utilization}%`, background: color }} />
      </div>
      <p className="mt-2 font-mono text-[8px] tracking-[0.06em] text-[#86aaa4] uppercase">
        {summary.moving} moving · {summary.waiting} hold · {summary.frozen} frozen · {Math.round(summary.averageBattery)}% avg battery
      </p>
    </div>
  );
}

function StatusReadout({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="min-w-0 px-2.5 py-2 first:pl-0 last:pr-0">
      <p className="truncate font-mono text-[8px] tracking-[0.08em] text-[#60817d] uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-base font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function compareMeshPriority(first: Robot, second: Robot): number {
  if (first.urgency !== second.urgency) return second.urgency - first.urgency;
  if (first.battery !== second.battery) return second.battery - first.battery;
  if (first.timestamp !== second.timestamp) return first.timestamp - second.timestamp;
  return first.id.localeCompare(second.id);
}

interface TrendChartProps {
  title: string;
  data: ChartDatum[];
  cloudKey: keyof ChartDatum;
  meshKey: keyof ChartDatum;
  kind: 'line' | 'area';
  fullPage?: boolean;
}

function TrendChart({ title, data, cloudKey, meshKey, kind, fullPage }: TrendChartProps) {
  const tooltipStyle = {
    background: '#0c2021',
    border: '1px solid #31585a',
    color: '#e5f3ee',
    fontFamily: 'monospace',
    fontSize: '10px',
  };

  return (
    <article className="min-w-0 bg-[#0c2021] px-2.5 py-2 flex flex-col">
      <div className="flex flex-shrink-0 items-center justify-between gap-2">
        <h3 className="truncate font-mono text-[9px] font-bold tracking-[0.1em] text-[#86aaa4] uppercase">{title}</h3>
        <div className="flex items-center gap-1.5" aria-label="Cloud red, P2P green">
          <i className="h-1.5 w-1.5 rounded-full bg-[#f15b5b]" />
          <i className="h-1.5 w-1.5 rounded-full bg-[#51d38d]" />
        </div>
      </div>
      <div className={`mt-1 min-w-0 flex-1 ${fullPage ? 'min-h-[200px]' : 'h-[132px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'area' ? (
            <AreaChart data={data} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
              <Tooltip content={CompactTooltip} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={cloudKey} stroke={CLOUD} fill={CLOUD} fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
              <Area type="monotone" dataKey={meshKey} stroke={MESH} fill={MESH} fillOpacity={0.1} strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
              <Tooltip content={CompactTooltip} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={cloudKey} stroke={CLOUD} strokeWidth={1.8} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey={meshKey} stroke={MESH} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function CompactTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="font-mono text-[10px] text-[#e5f3ee]">
      <p className="mb-1 text-[#86aaa4]">tick {label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>{entry.name}: {entry.value}</p>
      ))}
    </div>
  );
}

function buildChartData(tick: number, traditional: SimMetrics, proposed: SimMetrics): ChartDatum[] {
  const points = new Map<number, Partial<ChartDatum>>();
  addHistory(points, traditional.history, 'cloud');
  addHistory(points, proposed.history, 'mesh');
  addSnapshot(points, tick, traditional, proposed);

  const ordered = [...points.entries()].sort(([left], [right]) => left - right);
  let cloudTasks = 0;
  let meshTasks = 0;
  let cloudIdle = 0;
  let meshIdle = 0;
  let cloudConflicts = 0;
  let meshConflicts = 0;
  const data = ordered.map(([sampleTick, point]) => {
    cloudTasks = point.cloudTasks ?? cloudTasks;
    meshTasks = point.meshTasks ?? meshTasks;
    cloudIdle = point.cloudIdle ?? cloudIdle;
    meshIdle = point.meshIdle ?? meshIdle;
    cloudConflicts = point.cloudConflicts ?? cloudConflicts;
    meshConflicts = point.meshConflicts ?? meshConflicts;
    return { tick: sampleTick, cloudTasks, meshTasks, cloudIdle, meshIdle, cloudConflicts, meshConflicts };
  }).slice(-32);

  if (data.length === 0) return [{ tick: 0, cloudTasks: 0, meshTasks: 0, cloudIdle: 0, meshIdle: 0, cloudConflicts: 0, meshConflicts: 0 }];
  if (data.length === 1) return [{ ...data[0], tick: Math.max(0, data[0].tick - 1) }, data[0]];
  return data;
}

function addHistory(points: Map<number, Partial<ChartDatum>>, history: MetricsSnapshot[], side: 'cloud' | 'mesh') {
  for (const snapshot of history) {
    const point = points.get(snapshot.tick) ?? {};
    point[`${side}Tasks` as keyof ChartDatum] = snapshot.tasksCompleted;
    point[`${side}Idle` as keyof ChartDatum] = snapshot.idleTime;
    point[`${side}Conflicts` as keyof ChartDatum] = snapshot.conflicts;
    points.set(snapshot.tick, point);
  }
}

function addSnapshot(points: Map<number, Partial<ChartDatum>>, tick: number, traditional: SimMetrics, proposed: SimMetrics) {
  points.set(tick, {
    ...(points.get(tick) ?? {}),
    cloudTasks: traditional.totalTasksCompleted,
    meshTasks: proposed.totalTasksCompleted,
    cloudIdle: traditional.totalIdleTime,
    meshIdle: proposed.totalIdleTime,
    cloudConflicts: traditional.conflictCount,
    meshConflicts: proposed.conflictCount,
  });
}

function formatSeconds(ticks: number): string {
  return ((ticks * BASE_TICK_MS) / 1000).toFixed(ticks < 50 ? 1 : 0);
}
