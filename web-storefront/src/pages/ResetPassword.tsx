import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authApi } from '@/lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token || !email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-black text-destructive">Invalid Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">This password reset link is missing required information. Please request a new one.</p>
          <Link to="/auth" className="mt-4 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground">Back to Login</Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(token, email, password);
      setDone(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="mt-4 font-display text-2xl font-black">Password Reset</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your password has been reset successfully. You can now sign in with your new password.</p>
          <Link to="/auth" className="mt-4 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)]">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <Link to="/auth" className="text-xs uppercase tracking-widest text-primary">← Back to Login</Link>
        <h1 className="mt-4 font-display text-3xl font-black">New Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your new password for <span className="font-semibold text-foreground">{email}</span></p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" className="mt-1 h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" className="mt-1 h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
          </div>
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</div>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50">
            {busy ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
