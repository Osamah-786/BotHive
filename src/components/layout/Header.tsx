import { ChaosPanel } from './ChaosPanel';
import { SimControls } from '../ui/SimControls';

/** Operations-console header: status at left, transport in the center, faults at right. */
export function Header() {
  return (
    <header
      className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-[#3d2810] bg-[#0f0a04] px-4 py-2 md:px-5"
      style={{ minHeight: '52px' }}
    >
      <div className="flex items-center gap-3 whitespace-nowrap">
        <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-[#f59e0b] uppercase">AMR Fleet Sim</span>
        <span className="hidden font-mono text-[9px] tracking-[0.15em] text-[#8b5a2b] uppercase sm:inline">SIH 2026 · Edge coordination</span>
      </div>

      <SimControls />
      <ChaosPanel />
    </header>
  );
}
