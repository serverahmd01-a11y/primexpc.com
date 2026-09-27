import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';

function safeRedirect(url: string | null): string {
  if (!url) return '/';
  if (!url.startsWith('/') || url.startsWith('//')) return '/';
  return url;
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => { if (user) navigate(redirectTo); }, [user, navigate, redirectTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'signup') {
        await register(name, email, password);
        navigate(redirectTo);
      } else if (mode === 'forgot') {
        const res = await authApi.forgotPassword(email);
        setSuccessMsg(res.message || 'If an account exists, a reset link has been sent to your email.');
        setMode('signin');
      } else {
        await login(email, password);
        navigate(redirectTo);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong';
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  const resetMode = () => { setMode('signin'); setMsg(null); setSuccessMsg(null); };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <Link to="/" className="text-xs uppercase tracking-widest text-primary">← Home</Link>
        <h1 className="mt-4 font-display text-3xl font-black text-foreground">
          {mode === 'forgot' ? 'Reset Password' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'forgot' ? 'Enter your email to receive a reset link.' : mode === 'signin' ? 'Sign in to your PrimeX account.' : 'Create an account to start shopping.'}
        </p>

        {successMsg && (
          <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">{successMsg}</div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
          </div>
          {mode !== 'forgot' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
          {msg && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{msg}</div>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50">
            {busy ? 'Please wait…' : mode === 'forgot' ? 'Send Reset Link' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        {mode === 'forgot' ? (
          <button onClick={resetMode} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary">
            ← Back to Sign In
          </button>
        ) : (
          <>
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary">
              {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
            <button onClick={() => { setMode('forgot'); setMsg(null); }} className="mt-2 w-full text-center text-xs text-primary hover:underline">
              Forgot your password?
            </button>
          </>
        )}
      </div>
    </div>
  );
}
