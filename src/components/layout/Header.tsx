import { useState } from 'react';
import { ChaosPanel } from './ChaosPanel';
import { SimControls } from '../ui/SimControls';
import { Link, useRoute, useLocation } from 'wouter';
import { useAuthStore } from '../../store/useAuthStore';
import { AddAdminModal } from './AddAdminModal';
import { LogOut, UserPlus, Shield } from 'lucide-react';

/** Compact industrial header shared by the simulation and dashboard routes. */
export function Header() {
  const [isHome] = useRoute('/');
  const [isDashboard] = useRoute('/dashboard');
  const [isAuthPage] = useRoute('/login');
  const [, setLocation] = useLocation();

  const { isAuthenticated, currentUser, logout } = useAuthStore();
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  if (isAuthPage) {
    return null; // LoginPage renders its own centered container
  }

  return (
    <>
      <header
        className="simulation-header flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#d9d6d0] bg-white px-3 py-2 md:px-5"
        style={{ minHeight: '48px' }}
      >
        <div className="flex items-center gap-4 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.08em] text-[#1f3442] uppercase">
              <span className="grid h-5 w-5 place-items-center rounded-sm bg-[#1f3442] text-[9px] text-white">
                ▦
              </span>
              AMR Fleet Control
            </span>
            <span className="hidden font-sans text-[9px] tracking-[0.08em] text-[#8b969b] uppercase sm:inline">
              SIH 2026 · Edge coordination
            </span>
          </div>

          <div className="ml-2 flex items-center gap-1 border-l border-[#e4e1db] pl-3">
            <Link href="/">
              <span
                className={`inline-block rounded border px-3 py-1 font-sans text-[10px] uppercase tracking-[0.08em] transition-colors ${
                  isHome
                    ? 'border-[#d9e2ea] bg-[#f1f5f8] font-semibold text-[#1f5f9c]'
                    : 'border-transparent text-[#7b858a] hover:text-[#1f3442]'
                }`}
              >
                Simulation
              </span>
            </Link>
            <Link href="/dashboard">
              <span
                className={`inline-block rounded border px-3 py-1 font-sans text-[10px] uppercase tracking-[0.08em] transition-colors ${
                  isDashboard
                    ? 'border-[#d9e2ea] bg-[#f1f5f8] font-semibold text-[#1f5f9c]'
                    : 'border-transparent text-[#7b858a] hover:text-[#1f3442]'
                }`}
              >
                Dashboard
              </span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SimControls />
          <ChaosPanel />

          {/* User Auth Session info & Controls */}
          {isAuthenticated && currentUser && (
            <div className="flex items-center gap-2 border-l border-[#e4e1db] pl-3">
              <div className="hidden flex-col text-right sm:flex">
                <span className="font-sans text-[10px] font-bold text-[#1f3442]">
                  {currentUser.name}
                </span>
                <span className="flex items-center justify-end gap-1 text-[8px] font-bold tracking-wider text-[#7b858a] uppercase">
                  {currentUser.role === 'admin' ? (
                    <span className="flex items-center gap-0.5 text-[#1f5f9c]">
                      <Shield size={9} /> ADMIN
                    </span>
                  ) : (
                    <span>OPERATOR</span>
                  )}
                </span>
              </div>

              {/* Admin-only Add Admin button */}
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsAddAdminOpen(true)}
                  title="Create new Admin user"
                  className="flex items-center gap-1 rounded border border-[#1f5f9c]/30 bg-[#f1f6fa] px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wider text-[#1f5f9c] transition-colors hover:bg-[#e4eff7]"
                >
                  <UserPlus size={12} />
                  <span className="hidden md:inline">Add Admin</span>
                </button>
              )}

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                title="Log out of fleet session"
                className="flex items-center gap-1 rounded border border-[#d9d6d0] bg-white px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wider text-[#52636b] transition-colors hover:border-[#e58a8a] hover:bg-[#fff7f7] hover:text-[#a04444]"
              >
                <LogOut size={12} />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Admin Creation Modal */}
      {currentUser?.role === 'admin' && (
        <AddAdminModal
          isOpen={isAddAdminOpen}
          onClose={() => setIsAddAdminOpen(false)}
        />
      )}
    </>
  );
}
