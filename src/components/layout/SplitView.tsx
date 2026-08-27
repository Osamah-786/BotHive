import { useState } from 'react';
import { Cloud, Network } from 'lucide-react';
import { WarehouseCanvas } from '../simulation/WarehouseCanvas';

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

      <div id={`${activeView}-panel`} role="tabpanel" aria-labelledby={`${activeView}-tab`} className="min-h-0 flex-1">
        <WarehouseCanvas side={activeView} />
      </div>
    </section>
  );
}
