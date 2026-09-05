import { useEffect, useRef, useState } from 'react';
import { ChaosPanel } from './ChaosPanel';
import { SimControls } from '../ui/SimControls';
import { Link, useRoute, useLocation } from 'wouter';
import { useAuthStore } from '../../store/useAuthStore';
import { AddAdminModal } from './AddAdminModal';
import { LogOut, UserPlus, Shield, UserRound } from 'lucide-react';
import { CreateTransportTask } from './CreateTransportTask';
import bothiveLogo from '../../../logo/bothive.png';

/** Compact industrial header shared by the simulation and dashboard routes. */
export function Header() {
  const [isHome] = useRoute('/');
  const [isDashboard] = useRoute('/dashboard');
  const [isAuthPage] = useRoute('/login');
  const [, setLocation] = useLocation();

  const { isAuthenticated, currentUser, logout } = useAuthStore();
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProfileOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isProfileOpen]);

  const handleLogout = () => {
    setIsProfileOpen(false);
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
              <img src={bothiveLogo} alt="Bothive" className="h-7 w-28 object-contain" />
              AMR Fleet Control
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
          <CreateTransportTask />

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

              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((open) => !open)}
                  title="View profile"
                  aria-label="View profile"
                  aria-expanded={isProfileOpen}
                  className="flex items-center justify-center rounded border border-[#d9d6d0] bg-white p-1.5 text-[#52636b] transition-colors hover:border-[#e4b04f] hover:bg-[#fffaf0] hover:text-[#1f3442]"
                >
                  <UserRound size={14} />
                </button>
                {isProfileOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-md border border-[#d9d6d0] bg-white p-3 text-left shadow-lg">
                    <div className="mb-2 border-b border-[#eeeae3] pb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1f3442]">
                        Profile
                      </p>
                    </div>
                    <dl className="space-y-2 text-[10px]">
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-[#8b969b]">Username</dt>
                        <dd className="mt-0.5 text-[#1f3442]">{currentUser.name}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-[#8b969b]">Email</dt>
                        <dd className="mt-0.5 break-all text-[#1f3442]">{currentUser.email}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-[#8b969b]">Role</dt>
                        <dd className="mt-0.5 text-[#1f3442]">
                          {currentUser.role === 'admin' ? 'Admin' : 'User'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-[#8b969b]">Password</dt>
                        <dd className="mt-0.5 tracking-widest text-[#1f3442]">••••••••</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>

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
