import { useEffect, useState } from 'react';
import { api } from '../api';
import { ROLES, compact, cx, isHeadOfSales, roleLabel } from '../lib';
import { Avatar, Banner, Field, Modal, RolePicker, RolePill } from '../ui';

const EMPTY = { name: '', email: '', password: '', role: 'SALES_EXECUTIVE', title: '' };

export default function Team() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setData(await api('/api/team'));
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function changeRole(member, role) {
    setError('');
    try {
      await api(`/api/team/${member.id}/role`, { method: 'PATCH', body: { role } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(data.workspace.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy. Select the code and copy it manually.');
    }
  }

  async function runReminders() {
    setError('');
    setNotice('');
    try {
      const result = await api('/api/reminders/run', { method: 'POST' });
      setNotice(`Reminder sweep finished: ${result.reminders} notification${result.reminders === 1 ? '' : 's'} sent.`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <div className="card text-sm text-rose-600">{error}</div>;
  if (!data) return <div className="py-20 text-center text-slate-400">Loading your team…</div>;

  const canManage = data.youAreAdmin;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-slate-500">{data.workspace.name} · everyone here shares one pipeline.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && <button type="button" className="btn-ghost" onClick={runReminders}>Run reminder sweep</button>}
          {canManage && <button type="button" className="btn" onClick={() => setAdding(true)}>+ Add teammate</button>}
        </div>
      </div>

      {notice && <div className="mb-4"><Banner tone="good">{notice}</Banner></div>}
      {error && <div className="mb-4"><Banner tone="danger">{error}</Banner></div>}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="card !p-4">
          <p className="text-xs text-slate-400">Teammates</p>
          <p className="text-2xl font-semibold">{data.members.length}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-slate-400">Unassigned leads</p>
          <p className="text-2xl font-semibold">{data.unassigned}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-slate-400">Invite code</p>
          {canManage ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">{data.workspace.inviteCode}</span>
              <button type="button" className="text-xs font-medium text-blue-600" onClick={copyCode}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Ask Head of Sales to add people.</p>
          )}
        </div>
      </div>

      {canManage ? (
        <Banner tone="info">
          Share the invite code with a teammate. They create their own account at the sign-up page, enter the code, and
          land in this workspace with the same leads, contacts, notes and follow-ups.
        </Banner>
      ) : (
        <Banner tone="info">
          Sales executives can view the team. Only Head of Sales can add, edit or remove teammates.
        </Banner>
      )}

      <div className="card mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2 font-medium">Teammate</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Leads</th>
                <th className="py-2 font-medium">Open value</th>
                <th className="py-2 font-medium">Converted value</th>
                <th className="py-2 font-medium">Win rate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} />
                      <div>
                        <p className="font-medium">
                          {member.name}
                          {member.isYou && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">You</span>}
                        </p>
                        <p className="text-xs text-slate-400">{member.title || member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {canManage ? (
                      <select
                        className="field w-auto !py-1.5 text-xs"
                        value={isHeadOfSales(member.role) ? 'HEAD_OF_SALES' : 'SALES_EXECUTIVE'}
                        onChange={(event) => changeRole(member, event.target.value)}
                      >
                        {ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                      </select>
                    ) : <RolePill value={member.role} />}
                  </td>
                  <td>{member.leads}</td>
                  <td>{compact(member.openValue)}</td>
                  <td className="font-medium">{compact(member.wonValue)}</td>
                  <td>
                    <span className={cx('rounded-full px-2 py-1 text-xs',
                      member.winRate >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600')}>
                      {member.winRate}%
                    </span>
                  </td>
                  <td className="text-right">
                    {canManage && !member.isYou && (
                      <button type="button" className="text-xs text-rose-500" onClick={() => setRemoving(member)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Head of Sales can add and remove teammates. Sales executives can see the team but cannot edit it.
      </p>

      {adding && <AddMember onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} />}
      {removing && (
        <RemoveMember
          member={removing}
          members={data.members.filter((item) => item.id !== removing.id)}
          onClose={() => setRemoving(null)}
          onDone={async (message) => { setRemoving(null); setNotice(message); await load(); }}
        />
      )}
    </div>
  );
}

function AddMember({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/team', { method: 'POST', body: form });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a teammate" subtitle="Create their login now, or share the invite code instead." onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Name"><input className="field" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Work email"><input className="field" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Job title"><input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Sales Executive" /></Field>
        <Field label="Temporary password" hint="Share it with them. They can change their name and title after signing in.">
          <input className="field" type="text" minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </Field>
        <Field label="Role" hint="Head of Sales can add and remove teammates.">
          <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add teammate'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveMember({ member, members, onClose, onDone }) {
  const [reassignTo, setReassignTo] = useState(members[0]?.id || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/team/${member.id}?reassignTo=${encodeURIComponent(reassignTo)}`, { method: 'DELETE' });
      await onDone(`${result.removed} removed. ${result.reassigned} lead${result.reassigned === 1 ? '' : 's'} moved to ${result.to}.`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Remove ${member.name}?`} subtitle="Their leads stay in the workspace and move to whoever you pick." onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Move their leads to">
          <select className="field" value={reassignTo} onChange={(event) => setReassignTo(event.target.value)}>
            {members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <p className="text-sm text-slate-500">{member.name} currently owns {member.leads} lead{member.leads === 1 ? '' : 's'}.</p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white" type="submit" disabled={busy}>
            {busy ? 'Removing…' : 'Remove teammate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
