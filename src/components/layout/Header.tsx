import { ChaosPanel } from './ChaosPanel';
import { SimControls } from '../ui/SimControls';
import { Link, useRoute } from 'wouter';

/** Compact industrial header shared by the simulation and dashboard routes. */
export function Header() {
  const [isHome] = useRoute('/');
  const [isDashboard] = useRoute('/dashboard');

  return (
    <header
      className="simulation-header flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#d9d6d0] bg-white px-3 py-2 md:px-5"
      style={{ minHeight: '48px' }}
    >
      <div className="flex items-center gap-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.08em] text-[#1f3442] uppercase"><span className="grid h-5 w-5 place-items-center rounded-sm bg-[#1f3442] text-[9px] text-white">▦</span>AMR Fleet Control</span>
          <span className="hidden font-sans text-[9px] tracking-[0.08em] text-[#8b969b] uppercase sm:inline">SIH 2026 · Edge coordination</span>
        </div>
        
        <div className="ml-2 flex items-center gap-1 border-l border-[#e4e1db] pl-3">
          <Link href="/">
            <span className={`inline-block rounded border px-3 py-1 font-sans text-[10px] uppercase tracking-[0.08em] transition-colors ${isHome ? 'border-[#d9e2ea] bg-[#f1f5f8] font-semibold text-[#1f5f9c]' : 'border-transparent text-[#7b858a] hover:text-[#1f3442]'}`}>
              Simulation
            </span>
          </Link>
          <Link href="/dashboard">
            <span className={`inline-block rounded border px-3 py-1 font-sans text-[10px] uppercase tracking-[0.08em] transition-colors ${isDashboard ? 'border-[#d9e2ea] bg-[#f1f5f8] font-semibold text-[#1f5f9c]' : 'border-transparent text-[#7b858a] hover:text-[#1f3442]'}`}>
              Dashboard
            </span>
          </Link>
        </div>
      </div>

      <SimControls />
      <ChaosPanel />
    </header>
  );
}
