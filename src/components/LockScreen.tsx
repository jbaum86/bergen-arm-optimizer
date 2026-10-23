// src/components/LockScreen.tsx
import { useState } from 'react';
import {
  Unlock,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Building2,
  KeyRound,
} from 'lucide-react';
import { BASELINE_LOAN } from '../constants/financialData';

interface LockScreenProps {
  onUnlock: () => void;
}

// SHA-256 hash of 'martin323' (lowercase & trimmed)
const AUTHORIZED_HASH = 'abc6f799d0f78409559c80eeeba2d12f83016d02026babfb8d2cb9bd3596f975';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    setError(false);

    try {
      const inputHash = await sha256(password.trim().toLowerCase());
      if (inputHash === AUTHORIZED_HASH) {
        if (rememberMe) {
          localStorage.setItem('bergen_arm_auth', 'authorized');
        } else {
          sessionStorage.setItem('bergen_arm_auth', 'authorized');
        }
        onUnlock();
      } else {
        setError(true);
      }
    } catch (err) {
      // Fallback direct check if crypto API has issues
      if (password.trim().toLowerCase() === 'martin323') {
        if (rememberMe) {
          localStorage.setItem('bergen_arm_auth', 'authorized');
        } else {
          sessionStorage.setItem('bergen_arm_auth', 'authorized');
        }
        onUnlock();
      } else {
        setError(true);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Auras */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="max-w-md w-full relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-white/10 bg-[#0F172A]/90 backdrop-blur-2xl">
          {/* Header Icon & Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-blue-600/30 to-blue-900/40 border border-blue-500/30 text-blue-400 shadow-xl shadow-blue-950/50">
              <Shield className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Private Wealth Portal
              </h1>
              <p className="text-xs text-slate-400">
                Bergen Street Jumbo ARM & Capital Allocation Optimizer
              </p>
            </div>

            {/* Borrower & Property Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{BASELINE_LOAN.propertyAddress}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Access Password</span>
                <span className="text-[10px] text-slate-500 font-normal">Encrypted Gate</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(false);
                  }}
                  placeholder="Enter password to unlock"
                  autoFocus
                  className={`w-full pl-10 pr-10 py-3 rounded-xl bg-slate-900/80 border text-sm text-white placeholder-slate-500 transition-all focus:outline-none ${
                    error
                      ? 'border-red-500 ring-2 ring-red-500/20'
                      : 'border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center space-x-1.5 text-xs text-red-400 pt-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Incorrect password. Please verify and try again.</span>
                </div>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-slate-900 border-white/10 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember this device</span>
              </label>
              <span className="text-[10px] text-slate-500">Private Client Portal</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              {isVerifying ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Command Center</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="pt-2 border-t border-white/5 text-center text-[11px] text-slate-400">
            Institutional security • Client confidential
          </div>
        </div>
      </div>
    </div>
  );
};
