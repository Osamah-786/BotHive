import { useState } from 'react';
import { Cloud, Network, Zap } from 'lucide-react';
import { WarehouseCanvas } from '../simulation/WarehouseCanvas';
import { useSimStore } from '../../store/useSimStore';

type View = 'traditional' | 'proposed';

const VIEWS: Record<View, { label: string; detail: string; color: string; Icon: typeof Cloud }> = {
  traditional: { label: 'Centralized', detail: 'Cloud planner', color: '#f15b5b', Icon: Cloud },
  proposed: { label: 'Decentralized', detail: 'P2P mesh', color: '#51d38d', Icon: Network },
};

/**
 * A focused one-warehouse viewport. The engine keeps advancing both strategies;
 * tabs only choose which full-size scene the operator is reviewing.
 */
export function SplitView() {
  const [activeView, setActiveView] = useState<View>('traditional');
  const active = VIEWS[activeView];
  const robots = useSimStore((state) => (activeView === 'traditional' ? state.traditional.robots : state.proposed.robots));
  const chargingRobots = robots.filter((robot) => robot.state === 'charging');
  const warehousePower = useSimStore((state) => state.warehousePower);
  const powerOutage = !warehousePower;

  return (
    <section className="simulation-page flex h-full w-full flex-col bg-[#f8eee8]" aria-label="Warehouse strategy viewer">
      <div className="mode-selector flex h-10 flex-shrink-0 items-stretch border-b border-[#dedbd6] bg-white px-3 sm:px-5" role="tablist" aria-label="Simulation strategy">
        {(Object.keys(VIEWS) as View[]).map((view) => {
          const option = VIEWS[view];
          const selected = activeView === view;
          const Icon = option.Icon;
          return (
            <button
              key={view}
              id={`${view}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${view}-panel`}
              onClick={() => setActiveView(view)}
              className="relative flex min-w-40 items-center gap-2 border-x border-transparent px-4 font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3] sm:min-w-52"
              style={{
                background: selected ? '#f4f7f8' : 'transparent',
                borderColor: selected ? `${option.color}38` : 'transparent',
                color: selected ? (view === 'traditional' ? '#54758b' : '#23855f') : '#879197',
              }}
            >
              <Icon size={14} strokeWidth={2.1} aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase">{option.label}</span>
              <span className="hidden text-[8px] tracking-[0.08em] opacity-70 uppercase sm:inline">{option.detail}</span>
              {selected && <span className="absolute right-0 bottom-0 left-0 h-0.5" style={{ background: option.color }} />}
            </button>
          );
        })}

        <div className="ml-auto hidden items-center font-sans text-[8px] tracking-[0.1em] text-[#8b969b] uppercase md:flex">
          Viewing           <span className="ml-1 font-semibold text-[#23855f]">{active.detail}</span>
        </div>
      </div>

      <div id={`${activeView}-panel`} role="tabpanel" aria-labelledby={`${activeView}-tab`} className="relative min-h-0 flex-1">
        <WarehouseCanvas side={activeView} />

        {powerOutage && (
          <div className="pointer-events-none absolute top-3 right-3 z-30 flex flex-col gap-1.5" aria-label="Power outage notification">
            <div className="flex items-center gap-2 border border-[#e58a8a] bg-white/95 px-3 py-1.5 font-sans text-[10px] font-bold text-[#7a3333] shadow-md animate-pulse">
              <Zap size={13} className="shrink-0 text-[#b77d24]" aria-hidden="true" />
              <span>WAREHOUSE POWER OFF</span>
            </div>
            <div className="flex items-center gap-1.5 border border-[#e58a8a] bg-white/90 px-2.5 py-1 font-sans text-[8px] font-bold text-[#8b969b] uppercase tracking-[0.06em]">
              <span className="text-[#b77d24]">C1/C2 unavailable</span>
              <span className="text-[#b77d24]">Robots in power-saving mode</span>
            </div>
          </div>
        )}

        {chargingRobots.length > 0 && !powerOutage && (
          <div className="pointer-events-none absolute top-3 right-3 z-30 flex flex-col gap-1.5" aria-label="Charging notifications">
            {chargingRobots.map((robot) => (
              <div
                key={robot.id}
                className="flex items-center gap-2 border border-[#91d7b7] bg-white/95 px-3 py-1.5 font-sans text-[10px] font-bold text-[#21744f] shadow-md animate-pulse"
              >
                <Zap size={13} className="shrink-0 text-[#f2c14e]" aria-hidden="true" />
                <span style={{ color: robot.color }}>{robot.id}</span>
                <span>CHARGING</span>
                <span className="text-[#7b858a]">({Math.round(robot.battery)}%)</span>
                <span className="text-[8px] font-bold tracking-wider text-[#23855f] uppercase">
                  C{(robot.chargingStationIndex ?? 0) + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
