import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldAlert, X, CheckCircle2, User, Mail, Lock } from 'lucide-react';

interface AddAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAdminModal({ isOpen, onClose }: AddAdminModalProps) {
  const { currentUser, addAdmin } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Strict client check: only admin role can render/execute
  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
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

    const res = addAdmin(name, email, password);
    if (res.success) {
      setSuccess(`Admin account created for ${email}`);
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } else {
      setError(res.error || 'Failed to create admin user.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg border border-[#d9d6d0] bg-white p-6 shadow-md">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-[#f0eee9] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#1f5f9c]" />
            <h2 className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#1f3442]">
              Create Administrator Account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#8b969b] transition-colors hover:bg-[#f1f4f6] hover:text-[#1f3442]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded border border-[#e58a8a] bg-[#fff7f7] p-2.5 text-[11px] text-[#8b2929]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded border border-[#8ae5b8] bg-[#f4fcf7] p-2.5 text-[11px] text-[#1c6b44]">
            <CheckCircle2 size={15} />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
              Admin Name
            </label>
            <div className="relative">
              <User size={14} className="absolute top-2.5 left-3 text-[#8b969b]" />
              <input
                type="text"
                required
                placeholder="e.g. System Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-8 text-xs text-[#1f3442] focus:border-[#1f5f9c] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
              Admin Email
            </label>
            <div className="relative">
              <Mail size={14} className="absolute top-2.5 left-3 text-[#8b969b]" />
              <input
                type="email"
                required
                placeholder="admin@fleet.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-8 text-xs text-[#1f3442] focus:border-[#1f5f9c] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute top-2.5 left-3 text-[#8b969b]" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-8 text-xs text-[#1f3442] focus:border-[#1f5f9c] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#52636b]">
              Confirm Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute top-2.5 left-3 text-[#8b969b]" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded border border-[#d9d6d0] bg-[#fafafa] py-2 pr-3 pl-8 text-xs text-[#1f3442] focus:border-[#1f5f9c] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#d9d6d0] bg-white px-3 py-1.5 text-xs font-semibold text-[#52636b] hover:bg-[#f1f4f6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#1f5f9c] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#184c7d]"
            >
              Create Admin Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
