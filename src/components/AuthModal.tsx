import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogIn, UserPlus, LogOut, Award, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export const AuthModal: React.FC = () => {
  const { user, isAuthenticated, isAuthModalOpen, closeAuthModal, login, register, logout } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'register') {
        const displayName = username.trim() || email.split('@')[0];
        await register(email, displayName, password);
        setSuccessMessage('Account registered successfully!');
      } else {
        await login(email, password);
        setSuccessMessage('Signed in successfully!');
      }
      setTimeout(() => {
        setSuccessMessage(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent
        id="auth-modal-panel"
        className="max-w-md gap-0 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-rose-950/20 sm:max-w-md overflow-hidden"
      >
        <DialogHeader className="border-b border-zinc-800/80 px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/30">
              <User className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight">
                {isAuthenticated ? 'Drummer Pro Profile' : tab === 'login' ? 'Sign In' : 'Create Account'}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {isAuthenticated
                  ? 'Manage your drummer stats, level, and personal achievements'
                  : 'Save high scores, level up, and climb the global leaderboard'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAuthenticated && user ? (
          /* Profile view for signed in user */
          <div className="p-6 space-y-6">
            <Card className="flex items-center gap-4 rounded-2xl border-zinc-800 bg-zinc-900/60 p-4">
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-16 w-16 rounded-2xl border-2 border-rose-500/50 bg-zinc-950 p-1 shadow-md shadow-rose-500/20"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">{user.username}</h3>
                  <Badge className="bg-amber-400/10 border-amber-400/30 text-amber-400 text-[10px] font-black uppercase">
                    Lv. {user.level}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-mono text-rose-400 font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    {user.totalScore.toLocaleString()} EXP
                  </span>
                  <span className="flex items-center gap-1 font-mono text-zinc-400">
                    <Award className="h-3.5 w-3.5 text-amber-400" />
                    Rhythm Virtuoso
                  </span>
                </div>
              </div>
            </Card>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">💡 Pro Tip for EXP:</p>
              <p>Play tracks in <strong>Rhythm Challenge</strong> with long streaks and over 90% accuracy to earn maximum EXP points.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={logout}
                className="flex items-center gap-2 rounded-xl border-zinc-800 bg-zinc-900 text-rose-400 hover:bg-rose-950/30 hover:border-rose-800"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
              <Button
                type="button"
                onClick={closeAuthModal}
                className="rounded-xl bg-zinc-100 font-bold text-zinc-950 hover:bg-white"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* Login / Register tabs & form */
          <div className="p-6">
            {/* Tab switch */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1 mb-5 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMessage(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                  tab === 'login'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMessage(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                  tab === 'register'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Register</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{successMessage}</span>
                </div>
              )}

              {tab === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-username" className="text-xs text-zinc-300">
                    Display Name / Username
                  </Label>
                  <Input
                    id="auth-username"
                    type="text"
                    placeholder="e.g. BeatMaster_2026"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border-zinc-800 bg-zinc-900/80 focus-visible:ring-rose-500"
                    required={tab === 'register'}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-xs text-zinc-300">
                  Email
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="drummer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-zinc-800 bg-zinc-900/80 focus-visible:ring-rose-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password" className="text-xs text-zinc-300">
                  Password
                </Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-zinc-800 bg-zinc-900/80 focus-visible:ring-rose-500"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-amber-600 transition-all cursor-pointer"
              >
                {submitting ? 'Processing...' : tab === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <span className="text-[11px] text-zinc-500">
                {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => {
                    setTab(tab === 'login' ? 'register' : 'login');
                    setErrorMessage(null);
                  }}
                  className="text-rose-400 font-semibold hover:underline"
                >
                  {tab === 'login' ? 'Register now' : 'Sign in'}
                </button>
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
