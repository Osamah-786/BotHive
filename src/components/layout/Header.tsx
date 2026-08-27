import { ChaosPanel } from './ChaosPanel';
import { SimControls } from '../ui/SimControls';
import { Link, useRoute } from 'wouter';

/** Operations-console header: status at left, transport in the center, faults at right. */
export function Header() {
  const [isHome] = useRoute('/');
  const [isDashboard] = useRoute('/dashboard');

  return (
    <header
      className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-[#244446] bg-[#081a1b] px-4 py-2 md:px-5"
      style={{ minHeight: '52px' }}
    >
      <div className="flex items-center gap-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-[#f2c14e] uppercase">AMR Fleet Control</span>
          <span className="hidden font-mono text-[9px] tracking-[0.15em] text-[#86aaa4] uppercase sm:inline">SIH 2026 · Edge coordination</span>
        </div>
        
        <div className="flex items-center gap-2 ml-4 border-l border-[#244446] pl-4">
          <Link href="/">
            <a className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded transition-colors ${isHome ? 'bg-[#244446] text-[#e5f3ee]' : 'text-[#86aaa4] hover:text-[#e5f3ee]'}`}>
              Simulation
            </a>
          </Link>
          <Link href="/dashboard">
            <a className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded transition-colors ${isDashboard ? 'bg-[#244446] text-[#e5f3ee]' : 'text-[#86aaa4] hover:text-[#e5f3ee]'}`}>
              Dashboard
            </a>
          </Link>
        </div>
      </div>

      <SimControls />
      <ChaosPanel />
    </header>
  );
}
