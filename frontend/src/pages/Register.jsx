import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { isHeadOfSales } from '../lib';
import { Logo, RolePicker } from '../ui';

export default function Register() {
  const { user, save } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', inviteCode: '', role: 'HEAD_OF_SALES' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  const needsTeamCode = !isHeadOfSales(form.role);

  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const inviteCode = needsTeamCode ? form.inviteCode.trim() : '';
    if (needsTeamCode && !inviteCode) {
      setError('Sales executives need a team code to join a workspace.');
      setBusy(false);
      return;
    }
    try {
      const auth = await api('/api/auth/register', {
        method: 'POST',
        body: { ...form, inviteCode },
      });
      save(auth);
      navigate('/dashboard', { state: { welcome: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden bg-gradient-to-br from-[#1c86e0] via-[#1674cb] to-[#0e5ea8] px-14 py-10 text-white lg:flex lg:flex-col">
        <Link to="/"><Logo light /></Link>
        <div className="my-auto max-w-xl">
          <h1 className="text-5xl font-semibold leading-[1.15] tracking-tight">A workspace your sales team can run every day.</h1>
          <p className="mt-6 text-white/85">Head of Sales creates a workspace. Sales executives enter a team code to join that pipeline.</p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Link to="/"><Logo /></Link></div>
          <h2 className="text-[28px] font-semibold tracking-tight">Welcome</h2>
          <p className="mt-1 text-sm text-slate-500">Create your SaarthiX workspace and start selling.</p>
          {[
            ['name', 'Name', 'Alex Morgan', 'text'],
            ['email', 'Email', 'you@company.com', 'email'],
            ['company', 'Company', 'SaarthiX', 'text'],
            ['password', 'Password', 'At least 8 characters', 'password'],
          ].map(([key, label, placeholder, type]) => (
            <label key={key} className="mt-4 block text-sm font-medium">{label}
              <input className="pill-input mt-2 !px-4" required={key !== 'company'} type={type} minLength={key === 'password' ? 8 : undefined} placeholder={placeholder} value={form[key]} onChange={(event) => set(key, event.target.value)} />
            </label>
          ))}
          <label className="mt-4 block text-sm font-medium">Your role
            <div className="mt-2">
              <RolePicker
                value={form.role}
                onChange={(role) => setForm((current) => ({
                  ...current,
                  role,
                  inviteCode: isHeadOfSales(role) ? '' : current.inviteCode,
                }))}
              />
            </div>
          </label>
          {needsTeamCode && (
            <label className="mt-4 block text-sm font-medium">
              Team code
              <input
                className="pill-input mt-2 !px-4"
                required
                type="text"
                placeholder="Ask Head of Sales for the team code"
                value={form.inviteCode}
                onChange={(event) => set('inviteCode', event.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Required to join an existing team.
              </span>
            </label>
          )}
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <button className="btn mt-6 h-12 w-full" disabled={busy} type="submit">{busy ? 'Creating…' : 'Create account'}</button>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account? <Link className="font-semibold text-blue-700" to="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
