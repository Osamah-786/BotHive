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

  return (
    <section className="flex h-full w-full flex-col bg-[#071617]" aria-label="Warehouse strategy viewer">
      <div className="flex h-11 flex-shrink-0 items-stretch border-b border-[#244446] bg-[#0c2021] px-3 sm:px-5" role="tablist" aria-label="Simulation strategy">
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
              className="relative flex min-w-40 items-center gap-2 border-x border-transparent px-4 font-mono transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f2c14e] sm:min-w-52"
              style={{
                background: selected ? `${option.color}12` : 'transparent',
                borderColor: selected ? `${option.color}38` : 'transparent',
                color: selected ? option.color : '#86aaa4',
              }}
            >
              <Icon size={14} strokeWidth={2.1} aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase">{option.label}</span>
              <span className="hidden text-[8px] tracking-[0.1em] opacity-70 uppercase sm:inline">{option.detail}</span>
              {selected && <span className="absolute right-0 bottom-0 left-0 h-0.5" style={{ background: option.color }} />}
            </button>
          );
        })}

        <div className="ml-auto hidden items-center font-mono text-[8px] tracking-[0.12em] text-[#60817d] uppercase md:flex">
          Viewing <span className="ml-1 text-[#e5f3ee]">{active.detail}</span>
        </div>
      </div>

      <div id={`${activeView}-panel`} role="tabpanel" aria-labelledby={`${activeView}-tab`} className="relative min-h-0 flex-1">
        <WarehouseCanvas side={activeView} />

        {chargingRobots.length > 0 && (
          <div className="pointer-events-none absolute top-3 right-3 z-30 flex flex-col gap-1.5" aria-label="Charging notifications">
            {chargingRobots.map((robot) => (
              <div
                key={robot.id}
                className="flex items-center gap-2 border border-[#51d38d] bg-[#07241c]/90 px-3 py-1.5 font-mono text-[10px] font-bold text-[#87eab5] shadow-lg backdrop-blur-sm animate-pulse"
              >
                <Zap size={13} className="shrink-0 text-[#f2c14e]" aria-hidden="true" />
                <span style={{ color: robot.color }}>{robot.id}</span>
                <span>CHARGING</span>
                <span className="text-[#86aaa4]">({Math.round(robot.battery)}%)</span>
                <span className="text-[8px] font-bold tracking-wider text-[#51d38d] uppercase">
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
