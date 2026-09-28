import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { isPlatformAdmin } from '../lib';
import { Logo } from '../ui';

function afterSignIn(user, next) {
  if (isPlatformAdmin(user) || next === '/admin') return '/admin';
  return '/dashboard';
}

const POINTS = [
  ['Visual pipeline with drag-and-drop stages', 'M4 7h16M4 12h10M4 17h13'],
  ['AI lead scoring and instant email drafting', 'M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3z'],
  ['Secure JWT auth, your data stays yours', 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z'],
];

export default function Login() {
  const { user, save } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={afterSignIn(user, next)} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const auth = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      save(auth);
      navigate(afterSignIn(auth.user, next), { state: { welcome: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#1c86e0] via-[#1674cb] to-[#0e5ea8] px-14 py-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
        <Link to="/"><Logo light /></Link>
        <div className="my-auto max-w-xl">
          <h1 className="text-5xl font-semibold leading-[1.15] tracking-tight">
            Close more deals with an AI co-pilot in your pipeline.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/85">
            SaarthiX CRM unifies your leads, contacts and follow-ups — then layers summaries, email drafts and sales insights on top.
          </p>
          <ul className="mt-10 space-y-4">
            {POINTS.map(([label, path]) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/95">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={path} /></svg>
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Link to="/"><Logo /></Link></div>
          <h2 className="text-[28px] font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your SaarthiX workspace.</p>
          <label className="mt-8 block text-sm font-medium">Username or email
            <span className="relative mt-2 block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M4 8l8 6 8-6" /></svg>
              </span>
              <input className="pill-input" type="text" required autoComplete="username" placeholder="ADMIN or you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </span>
          </label>
          <label className="mt-4 block text-sm font-medium">Password
            <span className="relative mt-2 block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              </span>
              <input className="pill-input pr-16" type={show ? 'text' : 'password'} required placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400" onClick={() => setShow((value) => !value)}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <button className="btn mt-6 h-12 w-full text-[15px]" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account? <Link className="font-semibold text-blue-700" to="/register">Create one</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
