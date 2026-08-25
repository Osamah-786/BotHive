import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import { Activity, RadioTower } from 'lucide-react';
import { useSimStore } from '../../store/useSimStore';
import type { MetricsSnapshot, SimMetrics } from '../../engine/types';
import { BASE_TICK_MS } from '../../engine/simulation';
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

const CLOUD = '#f87171';
const MESH = '#4ade80';

/** Live, compact mission ledger driven directly by the simulation store. */
export function MetricsPanel() {
  const tick = useSimStore((state) => state.tick);
  const traditional = useSimStore((state) => state.traditional.metrics);
  const proposed = useSimStore((state) => state.proposed.metrics);
  const chartData = buildChartData(tick, traditional, proposed);

  return (
    <section className="flex h-[206px] flex-shrink-0 flex-col border-t border-[#4b3218] bg-[#0d0905]" aria-label="Fleet telemetry">
      <div className="flex h-8 flex-shrink-0 items-center justify-between border-b border-[#30200f] px-4 md:px-5">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-[#f59e0b]" aria-hidden="true" />
          <h2 className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#fef3c7] uppercase">Fleet telemetry</h2>
          <span className="font-mono text-[8px] tracking-[0.12em] text-[#80603c] uppercase">live comparison</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] tabular-nums text-[#d6a55b]">
          <RadioTower size={12} className="text-[#4ade80]" aria-hidden="true" />
          T+{formatSeconds(tick)}s
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-[#4b3218] lg:grid-cols-[minmax(390px,0.95fr)_minmax(560px,1.5fr)]">
        <div className="grid grid-cols-3 gap-px bg-[#4b3218]">
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

        <div className="grid min-h-0 grid-cols-3 gap-px bg-[#4b3218]">
          <TrendChart title="Tasks complete" data={chartData} cloudKey="cloudTasks" meshKey="meshTasks" kind="line" />
          <TrendChart title="Cumulative idle" data={chartData} cloudKey="cloudIdle" meshKey="meshIdle" kind="area" />
          <TrendChart title="Conflict events" data={chartData} cloudKey="cloudConflicts" meshKey="meshConflicts" kind="line" />
        </div>
      </div>
    </section>
  );
}

interface TrendChartProps {
  title: string;
  data: ChartDatum[];
  cloudKey: keyof ChartDatum;
  meshKey: keyof ChartDatum;
  kind: 'line' | 'area';
}

function TrendChart({ title, data, cloudKey, meshKey, kind }: TrendChartProps) {
  const tooltipStyle = {
    background: '#120c05',
    border: '1px solid #6b4226',
    color: '#fef3c7',
    fontFamily: 'monospace',
    fontSize: '10px',
  };

  return (
    <article className="min-w-0 bg-[#120c05] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-mono text-[9px] font-bold tracking-[0.1em] text-[#d6a55b] uppercase">{title}</h3>
        <div className="flex items-center gap-1.5" aria-label="Cloud red, P2P green">
          <i className="h-1.5 w-1.5 rounded-full bg-[#f87171]" />
          <i className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
        </div>
      </div>
      <div className="mt-1 h-[132px] min-w-0">
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
    <div className="font-mono text-[10px] text-[#fef3c7]">
      <p className="mb-1 text-[#d6a55b]">tick {label}</p>
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
