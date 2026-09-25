import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import {
  PRIORITIES, PURPOSES, SOURCES, STAGES, TONES, ago, closeReasons, compact, cx, downloadCsv, money, stageDot,
} from '../lib';
import { Avatar, Banner, Drawer, Field, Modal, PriorityPill, Spinner, StagePill } from '../ui';

const EMPTY = {
  name: '', company: '', email: '', phone: '', value: 0, stage: 'New', priority: 'Medium', source: 'Website', notes: '', ownerId: '', closeReason: '', closeNote: '',
};

export default function Leads() {
  const { user } = useAuth();
  const { members } = useTeam();
  const [params, setParams] = useSearchParams();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('All');
  const [priority, setPriority] = useState('All priority');
  const [source, setSource] = useState('All sources');
  const [owner, setOwner] = useState('All owners');
  const [sort, setSort] = useState('updated_desc');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState([]);
  const [editor, setEditor] = useState(null);
  const [active, setActive] = useState(null);
  const [emailFor, setEmailFor] = useState(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(null);
  const [duplicates, setDuplicates] = useState([]);

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (stage !== 'All') query.set('stage', stage);
    if (priority !== 'All priority') query.set('priority', priority);
    if (source !== 'All sources') query.set('source', source);
    if (owner !== 'All owners') query.set('owner', owner);
    query.set('sort', sort);
    const data = await api(`/api/leads?${query.toString()}`);
    setPack(data);
    return data;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, stage, priority, source, owner, sort]);

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditor({ ...EMPTY, ownerId: user?.id || '' });
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    const id = params.get('lead');
    if (!id || !pack) return;
    const found = pack.leads.find((lead) => lead.id === id);
    if (found) setActive(found);
  }, [params, pack]);

  const summary = pack?.summary;
  const leads = pack?.leads || [];
  const allSelected = leads.length > 0 && selected.length === leads.length;

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function save(event, force = false) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDuplicates([]);
    try {
      const body = { ...editor, value: Number(editor.value) || 0 };
      const suffix = force ? '?force=true' : '';
      if (editor.id) await api(`/api/leads/${editor.id}${suffix}`, { method: 'PUT', body });
      else await api(`/api/leads${suffix}`, { method: 'POST', body });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
      if (err instanceof ApiError && err.data.code === 'DUPLICATE_LEAD') {
        setDuplicates(err.data.duplicates || []);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this lead?')) return;
    await api(`/api/leads/${id}`, { method: 'DELETE' });
    setActive(null);
    setSelected((current) => current.filter((item) => item !== id));
    await load();
  }

  async function bulkRemove() {
    if (!window.confirm(`Delete ${selected.length} leads?`)) return;
    await api('/api/leads/bulk-delete', { method: 'POST', body: { ids: selected } });
    setSelected([]);
    await load();
  }

  function exportRows() {
    downloadCsv('saarthix-leads.csv', leads.map((lead) => ({
      Name: lead.name, Company: lead.company, Email: lead.email, Phone: lead.phone,
      Value: lead.value, Stage: lead.stage, Priority: lead.priority, Source: lead.source, Notes: lead.notes,
    })));
  }

  const chips = useMemo(() => {
    if (!summary) return [];
    return [['All', summary.total], ...STAGES.map((item) => [item, summary.stages?.[item] || 0])];
  }, [summary]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">Track and qualify every opportunity.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setImporting(true)}>↑ Import</button>
          <button type="button" className="btn-ghost" onClick={exportRows}>↓ Export</button>
          <button type="button" className="btn" onClick={() => setEditor({ ...EMPTY, ownerId: user?.id || '' })}>+ Add lead</button>
        </div>
      </div>

      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Total leads', summary.total],
            ['Open pipeline', compact(summary.openPipeline)],
            ['Weighted forecast', compact(summary.forecast)],
            ['Won value', compact(summary.wonValue)],
            ['Avg deal size', money(summary.avgDeal)],
          ].map(([label, value]) => (
            <div key={label} className="card flex items-center gap-3 !p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500">●</span>
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-xl font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <input className="field max-w-md flex-1" placeholder="Search by name, company or email…" value={q} onChange={(event) => setQ(event.target.value)} />
          <select className="field w-auto" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option>All priority</option>
            {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field w-auto" value={source} onChange={(event) => setSource(event.target.value)}>
            <option>All sources</option>
            {SOURCES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field w-auto" value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option>All owners</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            <span>{leads.length} of {summary?.total || 0}</span>
            <button type="button" className={cx('grid h-9 w-9 place-items-center rounded-lg', view === 'list' ? 'bg-slate-100 text-slate-800' : '')} onClick={() => setView('list')}>☰</button>
            <button type="button" className={cx('grid h-9 w-9 place-items-center rounded-lg', view === 'grid' ? 'bg-slate-100 text-slate-800' : '')} onClick={() => setView('grid')}>▦</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map(([label, count]) => (
            <button key={label} type="button" onClick={() => setStage(label)} className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm', stage === label ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
              {label !== 'All' && <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage === label ? '#fff' : stageDot[label] }} />}
              {label} <span className={cx('rounded-full px-1.5 text-xs', stage === label ? 'bg-white/20' : 'bg-white')}>{count}</span>
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
            <span>{selected.length} selected</span>
            <button type="button" onClick={bulkRemove}>Delete selected</button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        {view === 'list' ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : leads.map((lead) => lead.id))} /></th>
                  <th className="py-2 font-medium">Lead</th>
                  <th className="py-2 font-medium">Stage</th>
                  <th className="py-2 font-medium">Priority</th>
                  <th className="py-2 font-medium">Source</th>
                  <th className="py-2 font-medium"><button type="button" onClick={() => setSort(sort === 'value_desc' ? 'value_asc' : 'value_desc')}>Value</button></th>
                  <th className="py-2 font-medium">Owner</th>
                  <th className="py-2 font-medium"><button type="button" onClick={() => setSort(sort === 'updated_desc' ? 'updated_asc' : 'updated_desc')}>Updated</button></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="py-3"><input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggle(lead.id)} /></td>
                    <td>
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => setActive(lead)}>
                        <Avatar name={lead.name} size="sm" />
                        <span>
                          <span className="block font-medium">{lead.name}</span>
                          <span className="block text-xs text-slate-400">{lead.company}</span>
                        </span>
                      </button>
                    </td>
                    <td><span className="inline-flex items-center gap-1.5 text-xs"><span className="h-1.5 w-1.5 rounded-full" style={{ background: stageDot[lead.stage] }} />{lead.stage}</span></td>
                    <td><PriorityPill value={lead.priority} /></td>
                    <td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{lead.source}</span></td>
                    <td className="font-medium">{money(lead.value)}</td>
                    <td className="text-slate-500">{lead.ownerName || '—'}</td>
                    <td className="text-slate-500">{ago(lead.updatedAt)}</td>
                    <td className="relative text-right">
                      <button type="button" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" onClick={() => setMenu(menu === lead.id ? null : lead.id)}>•••</button>
                      {menu === lead.id && (
                        <div className="absolute right-0 z-10 w-40 rounded-xl bg-white p-1 text-left shadow-xl ring-1 ring-slate-200">
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setActive(lead); setMenu(null); }}>View</button>
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setEditor(lead); setMenu(null); }}>Edit</button>
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setEmailFor(lead); setMenu(null); }}>AI email</button>
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50" onClick={() => { setMenu(null); remove(lead.id); }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No leads match these filters.</p>}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <button key={lead.id} type="button" className="rounded-2xl border border-slate-100 p-4 text-left hover:border-blue-200" onClick={() => setActive(lead)}>
                <div className="flex items-center gap-3">
                  <Avatar name={lead.name} size="sm" />
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-slate-400">{lead.company}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold">{money(lead.value)}</span>
                  <StagePill value={lead.stage} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {editor && (
        <Modal title={editor.id ? 'Edit lead' : 'New lead'} subtitle="Add a lead to your pipeline." onClose={() => setEditor(null)}>
          <form className="grid grid-cols-2 gap-3" onSubmit={save}>
            <div className="col-span-2"><Field label="Name"><input className="field" required value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></Field></div>
            <Field label="Company"><input className="field" value={editor.company} onChange={(event) => setEditor({ ...editor, company: event.target.value })} placeholder="Company" /></Field>
            <Field label="Email"><input className="field" type="email" value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })} placeholder="email@company.com" /></Field>
            <Field label="Phone"><input className="field" value={editor.phone} onChange={(event) => setEditor({ ...editor, phone: event.target.value })} placeholder="+1 555 0100" /></Field>
            <Field label="Deal value (USD)"><input className="field" type="number" min="0" value={editor.value} onChange={(event) => setEditor({ ...editor, value: event.target.value })} /></Field>
            <Field label="Stage">
              <select className="field" value={editor.stage} onChange={(event) => setEditor({ ...editor, stage: event.target.value })}>
                {STAGES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="field" value={editor.priority} onChange={(event) => setEditor({ ...editor, priority: event.target.value })}>
                {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Source">
                <select className="field" value={editor.source} onChange={(event) => setEditor({ ...editor, source: event.target.value })}>
                  {SOURCES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Owner">
                <select className="field" value={editor.ownerId || user?.id || ''} onChange={(event) => setEditor({ ...editor, ownerId: event.target.value })}>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
            </div>
            {(editor.stage === 'Won' || editor.stage === 'Lost') && (
              <>
                <Field label={`${editor.stage} reason`}>
                  <select className="field" required value={editor.closeReason || ''} onChange={(event) => setEditor({ ...editor, closeReason: event.target.value })}>
                    <option value="">Choose a reason</option>
                    {closeReasons(editor.stage).map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="What happened"><input className="field" value={editor.closeNote || ''} onChange={(event) => setEditor({ ...editor, closeNote: event.target.value })} /></Field>
              </>
            )}
            <div className="col-span-2">
              <Field label="Notes"><textarea className="field min-h-24" placeholder="Context, next steps…" value={editor.notes || ''} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} /></Field>
            </div>
            {duplicates.length > 0 && (
              <div className="col-span-2">
                <Banner tone="warn">
                  <p className="font-medium">A similar lead is already in this workspace.</p>
                  <ul className="mt-2 space-y-1">
                    {duplicates.map((item) => (
                      <li key={item.id}>{item.name} · {item.company} · {item.email || 'no email'} · {item.ownerName}</li>
                    ))}
                  </ul>
                  <button type="button" className="mt-3 font-semibold underline" onClick={(event) => save(event, true)}>Create anyway</button>
                </Banner>
              </div>
            )}
            {error && duplicates.length === 0 && <p className="col-span-2 text-sm text-rose-600">{error}</p>}
            <div className="col-span-2 mt-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setEditor(null); setDuplicates([]); }}>Cancel</button>
              <button className="btn" disabled={busy} type="submit">{busy ? <Spinner /> : null}{editor.id ? 'Save lead' : 'Create lead'}</button>
            </div>
          </form>
        </Modal>
      )}

      {active && (
        <LeadDrawer
          lead={active}
          onClose={() => { setActive(null); params.delete('lead'); setParams(params, { replace: true }); }}
          onEdit={() => { setEditor(active); setActive(null); }}
          onDelete={() => remove(active.id)}
          onEmail={() => setEmailFor(active)}
        />
      )}
      {emailFor && <EmailModal lead={emailFor} onClose={() => setEmailFor(null)} />}
      {importing && <ImportModal members={members} user={user} onClose={() => setImporting(false)} onDone={async () => { setImporting(false); await load(); }} />}
    </div>
  );
}

function LeadDrawer({ lead, onClose, onEdit, onDelete, onEmail }) {
  const [summary, setSummary] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/api/leads/${lead.id}/activity`).then((data) => setTimeline(data.activity || [])).catch(() => {});
  }, [lead.id]);
  async function analyze() {
    setBusy(true);
    try {
      const result = await api('/api/ai/summary', { method: 'POST', body: { leadId: lead.id } });
      setSummary(result.summary);
    } catch (err) {
      setSummary(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer title="Lead details" onClose={onClose}>
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} size="lg" />
          <div>
            <p className="text-lg font-semibold">{lead.name}</p>
            <p className="text-sm text-slate-500">{lead.company}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StagePill value={lead.stage} />
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${lead.priority === 'High' ? 'bg-rose-50 text-rose-500' : lead.priority === 'Low' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{lead.priority} priority</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{lead.source}</span>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-slate-400">DEAL VALUE</p>
          <p className="text-3xl font-semibold">{money(lead.value)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-[11px] font-medium tracking-wide text-slate-400">LEAD SCORE</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xl font-semibold">{lead.score ?? '—'}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${lead.score || 0}%` }} />
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">Rule-based score from stage, priority, value and freshness.</p>
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>✉ {lead.email || 'No email'}</li>
          <li>☎ {lead.phone || 'No phone'}</li>
          <li>⌂ {lead.company || 'No company'}</li>
          <li>◎ Owner {lead.ownerName || 'Unassigned'}</li>
        </ul>
        {lead.closeReason && (
          <div className="rounded-2xl bg-slate-50 p-3 text-sm">
            <p className="text-[11px] font-medium tracking-wide text-slate-400">{lead.stage} REASON</p>
            <p className="mt-1 font-medium">{lead.closeReason}</p>
            {lead.closeNote && <p className="mt-1 text-slate-600">{lead.closeNote}</p>}
          </div>
        )}
        <div>
          <p className="text-[11px] font-medium tracking-wide text-slate-400">NOTES</p>
          <p className="mt-1 text-sm text-slate-700">{lead.notes || 'No notes yet.'}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-slate-400">ACTIVITY</p>
          <ol className="mt-2 space-y-3">
            {timeline.map((item) => (
              <li key={item.id} className="border-l-2 border-slate-200 pl-3">
                <p className="text-sm font-medium">{item.title}</p>
                {item.detail && <p className="whitespace-pre-wrap text-xs text-slate-500">{item.detail}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{item.actorName} · {ago(item.createdAt)}</p>
              </li>
            ))}
            {timeline.length === 0 && <p className="text-sm text-slate-400">Nothing logged yet.</p>}
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-100 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">✦ AI Lead Summary</p>
            <button type="button" className="text-sm font-medium text-blue-600" onClick={analyze} disabled={busy}>{busy ? 'Analyzing…' : 'Analyze'}</button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{summary || 'Generate a short brief before the next conversation.'}</p>
        </div>
        <button type="button" className="btn-ghost w-full" onClick={onEmail}>✦ Generate AI email</button>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onEdit}>Edit</button>
          <button type="button" className="flex-1 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={onDelete}>Delete</button>
        </div>
        <p className="text-center text-xs text-slate-400">Added {pretty(lead.createdAt)}</p>
      </div>
    </Drawer>
  );
}

function pretty(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ImportModal({ members, user, onClose, onDone }) {
  const [csv, setCsv] = useState('');
  const [ownerId, setOwnerId] = useState(user?.id || '');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await api('/api/leads/import', { method: 'POST', body: { csv, ownerId, skipDuplicates } });
      setResult(next);
      if (next.created > 0) await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import leads" subtitle="Use a CSV with a Name column. Company, Email, Phone, Value, Stage, Priority, Source and Notes are optional." onClose={onClose} wide>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="CSV file"><input type="file" accept=".csv,text/csv" onChange={readFile} /></Field>
        <Field label="Or paste rows">
          <textarea className="field min-h-32 font-mono text-xs" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="Name,Company,Email,Value,Stage" />
        </Field>
        <Field label="Assign imported leads to">
          <select className="field" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={skipDuplicates} onChange={(event) => setSkipDuplicates(event.target.checked)} />
          Skip rows that match an existing email or the same name at the same company
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {result && (
          <Banner tone="good">
            Imported {result.created} lead{result.created === 1 ? '' : 's'}. Skipped {result.skipped}.
            {result.problems?.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-xs">
                {result.problems.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </Banner>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn" type="submit" disabled={busy || !csv.trim()}>{busy ? 'Importing…' : 'Import leads'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EmailModal({ lead, onClose }) {
  const [purpose, setPurpose] = useState('Follow-up');
  const [tone, setTone] = useState('Formal');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [mail, setMail] = useState({ configured: false, inboxUrl: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/mail/status').then(setMail).catch(() => {});
  }, []);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/ai/email', { method: 'POST', body: { leadId: lead.id, purpose, tone } });
      setDraft(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('Could not copy. Select the draft and copy it manually.');
    }
  }

  return (
    <Modal title="AI Email Generator" subtitle={`Draft an email to ${lead.name}`} onClose={onClose} wide={Boolean(draft)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Purpose">
          <select className="field" value={purpose} onChange={(event) => setPurpose(event.target.value)}>
            {PURPOSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Tone">
          <select className="field" value={tone} onChange={(event) => setTone(event.target.value)}>
            {TONES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button type="button" className="btn mt-4 w-full" onClick={generate} disabled={busy}>{busy ? 'Writing…' : '✦ Generate email'}</button>
      {draft && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Subject</p>
          <p className="font-medium">{draft.subject}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{draft.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={copy}>{copied ? 'Copied' : 'Copy draft'}</button>
            <button
              type="button"
              className="btn"
              disabled={busy || sent}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api('/api/ai/email/send', { method: 'POST', body: { leadId: lead.id, subject: draft.subject, body: draft.body } });
                  setSent(true);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {sent ? 'Sent' : 'Send email'}
            </button>
          </div>
          {sent && mail.inboxUrl && (
            <p className="mt-3 text-xs text-slate-500">
              Open the local inbox at <a className="font-medium text-blue-600" href={mail.inboxUrl} target="_blank" rel="noreferrer">{mail.inboxUrl}</a> to read the message.
            </p>
          )}
        </div>
      )}
      {!mail.configured && (
        <p className="mt-3 text-xs text-slate-400">Sending uses the company mailbox. In Docker that is Mailpit at http://localhost:8025.</p>
      )}
      <p className="mt-4 text-center text-xs text-slate-400">
        {draft?.provider === 'gemini' ? 'Generated by Google Gemini' : 'Drafted by SaarthiX AI'}
      </p>
    </Modal>
  );
}
