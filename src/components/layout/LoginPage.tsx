import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldCheck, UserPlus, LogIn, Lock, Mail, User, AlertCircle } from 'lucide-react';
import bothiveLogo from '../../../logo/bothive.png';

interface LoginPageProps {
  initialMode?: 'login' | 'signup';
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, login, signup } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) setLocation('/dashboard');
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('Please enter both email and password.');
        return;
      }
      const res = login(email, password);
      if (res.success) {
        setLocation('/dashboard');
      } else {
        setError(res.error || 'Login failed');
      }
    } else {
      if (!name.trim() || !email.trim() || !password || !confirmPassword) {
        setError('Please fill in all fields.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      const res = signup(name, email, password);
      if (res.success) {
        setLocation('/dashboard');
      } else {
        setError(res.error || 'Signup failed');
      }
    }
  };

  const fillDemoAdmin = () => {
    setMode('login');
    setEmail('admin@fleet.com');
    setPassword('admin123');
    setError(null);
  };

  const fillDemoUser = () => {
    setMode('login');
    setEmail('user@fleet.com');
    setPassword('user123');
    setError(null);
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#f8f7f4] p-4 font-sans text-[#1f3442]">
      <div className="w-full max-w-md rounded-lg border border-[#d9d6d0] bg-white p-6 shadow-sm md:p-8">
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={bothiveLogo} alt="Bothive" className="mb-3 h-auto w-52 object-contain" />
          <h1 className="text-lg font-bold uppercase tracking-[0.08em] text-[#1f3442]">
            AMR Fleet Control
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-[#e4e1db] bg-[#f1f4f6] p-1 text-[11px] font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded py-2 transition-all ${
              mode === 'login'
                ? 'bg-white text-[#1f3442] shadow-xs font-bold'
                : 'text-[#7b858a] hover:text-[#1f3442]'
            }`}
          >
            <LogIn size={13} />
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded py-2 transition-all ${
              mode === 'signup'
                ? 'bg-white text-[#1f3442] shadow-xs font-bold'
                : 'text-[#7b858a] hover:text-[#1f3442]'
            }`}
          >
            <UserPlus size={13} />
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded border border-[#e58a8a] bg-[#fff7f7] p-3 text-[11px] font-medium text-[#8b2929]">
            <AlertCircle size={15} className="shrink-0 text-[#b73a3a]" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
                Full Name
              </label>
              <div className="relative">
                <User size={15} className="absolute top-2.5 left-3 text-[#8b969b]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Mercer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-9 text-xs text-[#1f3442] transition-colors focus:border-[#23855f] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
              Email Address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute top-2.5 left-3 text-[#8b969b]" />
              <input
                type="email"
                required
                placeholder="operator@fleet.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-9 text-xs text-[#1f3442] transition-colors focus:border-[#23855f] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute top-2.5 left-3 text-[#8b969b]" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-9 text-xs text-[#1f3442] transition-colors focus:border-[#23855f] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute top-2.5 left-3 text-[#8b969b]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-9 text-xs text-[#1f3442] transition-colors focus:border-[#23855f] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded bg-[#23855f] py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#1b6b4c]"
          >
            {mode === 'login' ? 'Sign In to Control Center' : 'Create Account'}
          </button>
        </form>

        {/* Demo Helper Panel */}
        <div className="mt-6 border-t border-[#f0eee9] pt-4">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#8b969b]">
            <span className="font-bold">Demo Quick Credentials</span>
            <ShieldCheck size={13} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="rounded border border-[#d9e2ea] bg-[#f4f8fb] px-2.5 py-1.5 text-left transition-colors hover:border-[#1f5f9c] hover:bg-[#ebf3fa]"
            >
              <div className="text-[10px] font-bold text-[#1f5f9c]">Admin Demo</div>
              <div className="text-[9px] text-[#7b858a]">admin@fleet.com</div>
            </button>
            <button
              type="button"
              onClick={fillDemoUser}
              className="rounded border border-[#d9e2ea] bg-[#f4f8fb] px-2.5 py-1.5 text-left transition-colors hover:border-[#1f5f9c] hover:bg-[#ebf3fa]"
            >
              <div className="text-[10px] font-bold text-[#23855f]">Operator Demo</div>
              <div className="text-[9px] text-[#7b858a]">user@fleet.com</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
