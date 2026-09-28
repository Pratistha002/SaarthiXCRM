import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import {
  LEAD_TYPES, PRIORITIES, PURPOSES, SOURCES, STAGES, TONES, ago, compact, cx, downloadCsv, money, stageDot,
} from '../lib';
import { Avatar, Banner, Field, Modal, PriorityPill, StagePill } from '../ui';
import LeadForm, { EMPTY_LEAD } from './LeadForm';

const SORTS = [
  ['updated_desc', 'Recently updated'],
  ['updated_asc', 'Least recently updated'],
  ['created_desc', 'Newest first'],
  ['created_asc', 'Oldest first'],
  ['name_asc', 'Name A → Z'],
  ['name_desc', 'Name Z → A'],
  ['value_desc', 'Deal value high → low'],
  ['value_asc', 'Deal value low → high'],
];

const COLUMNS = [
  ['name', 'Lead Name', (lead) => lead.name],
  ['leadType', 'Lead Type', (lead) => lead.leadType],
  ['company', 'Company / Institute', (lead) => (lead.leadType === 'Student' ? '' : lead.company)],
  ['contactPerson', 'Contact Person', (lead) => lead.contactPerson],
  ['collegeName', 'College Name', (lead) => lead.collegeName],
  ['course', 'Course', (lead) => lead.course],
  ['branch', 'Branch', (lead) => lead.branch],
  ['email', 'Email', (lead) => lead.email],
  ['phone', 'Phone', (lead) => lead.phone],
  ['mobile', 'Mobile', (lead) => lead.mobile],
  ['website', 'Website', (lead) => lead.website],
  ['stage', 'Lead Status', (lead) => lead.stage],
  ['priority', 'Priority', (lead) => lead.priority],
  ['source', 'Lead Source', (lead) => lead.source],
  ['value', 'Deal Value', (lead) => money(lead.value)],
  ['rating', 'Rating', (lead) => lead.rating],
  ['employees', 'No. of Employees', (lead) => lead.employees],
  ['annualRevenue', 'Annual Revenue', (lead) => (lead.annualRevenue != null ? money(lead.annualRevenue) : '')],
  ['owner', 'Lead Owner', (lead) => lead.ownerName],
  ['city', 'City', (lead) => lead.city],
  ['state', 'State', (lead) => lead.state],
  ['country', 'Country', (lead) => lead.country],
  ['tags', 'Tags', (lead) => (lead.tags || []).join(', ')],
  ['score', 'Lead Score', (lead) => lead.score],
  ['created', 'Created', (lead) => ago(lead.createdAt)],
  ['updated', 'Updated', (lead) => ago(lead.updatedAt)],
];

const DEFAULT_COLUMNS = ['name', 'leadType', 'email', 'mobile', 'stage', 'value', 'owner', 'updated'];

function loadColumns() {
  try {
    const saved = JSON.parse(localStorage.getItem('sx_leads_columns'));
    const valid = Array.isArray(saved) ? saved.filter((key) => COLUMNS.some(([id]) => id === key)) : [];
    return valid.length ? valid : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function ColumnPicker({ columns, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = (key) => onChange(columns.includes(key)
    ? columns.filter((item) => item !== key)
    : COLUMNS.map(([id]) => id).filter((id) => id === key || columns.includes(id)));
  const move = (key, step) => {
    const index = columns.indexOf(key);
    const target = index + step;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="relative">
      <button type="button" className="btn-ghost !rounded-xl !py-2.5" onClick={() => setOpen(!open)}>⚙ Columns <span className="rounded-full bg-slate-100 px-1.5 text-xs">{columns.length}</span></button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Shown · use arrows to reorder</p>
          <ul className="mb-3 space-y-1">
            {columns.map((key, index) => (
              <li key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked disabled={columns.length === 1} onChange={() => toggle(key)} />
                  {COLUMNS.find(([id]) => id === key)[1]}
                </label>
                <span className="flex gap-1 text-slate-400">
                  <button type="button" disabled={index === 0} className="px-1 hover:text-slate-800 disabled:opacity-30" onClick={() => move(key, -1)} aria-label="Move up">↑</button>
                  <button type="button" disabled={index === columns.length - 1} className="px-1 hover:text-slate-800 disabled:opacity-30" onClick={() => move(key, 1)} aria-label="Move down">↓</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Available</p>
          <div className="grid max-h-48 grid-cols-2 gap-x-2 overflow-y-auto">
            {COLUMNS.filter(([id]) => !columns.includes(id)).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={false} onChange={() => toggle(id)} />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm">
            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => onChange(DEFAULT_COLUMNS)}>Reset</button>
            <button type="button" className="font-semibold text-blue-600" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomTable({ leads, columns, selected, allSelected, onToggle, onToggleAll, onOpen }) {
  const shown = columns.map((key) => COLUMNS.find(([id]) => id === key));
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="w-8 py-2"><input type="checkbox" checked={allSelected} onChange={onToggleAll} /></th>
            {shown.map(([id, label]) => <th key={id} className="whitespace-nowrap py-2 pr-4 font-medium">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => onOpen(lead)}>
              <td className="py-3" onClick={(event) => event.stopPropagation()}>
                <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => onToggle(lead.id)} />
              </td>
              {shown.map(([id, , read]) => {
                const value = read(lead);
                return (
                  <td key={id} className={cx('whitespace-nowrap py-3 pr-4', id === 'name' ? 'font-medium text-blue-700' : 'text-slate-600')}>
                    {value === 0 ? 0 : value || <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No leads match these filters.</p>}
    </div>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const { members } = useTeam();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('All');
  const [priority, setPriority] = useState('All priority');
  const [source, setSource] = useState('All sources');
  const [owner, setOwner] = useState('All owners');
  const [type, setType] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState('updated_desc');
  const [view, setView] = useState(() => localStorage.getItem('sx_leads_view') || 'list');
  const [columns, setColumns] = useState(loadColumns);
  const [selected, setSelected] = useState([]);
  const [editor, setEditor] = useState(null);
  const [emailFor, setEmailFor] = useState(null);
  const [importing, setImporting] = useState(false);
  const [menu, setMenu] = useState(null);

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (stage !== 'All') query.set('stage', stage);
    if (priority !== 'All priority') query.set('priority', priority);
    if (source !== 'All sources') query.set('source', source);
    if (owner !== 'All owners') query.set('owner', owner);
    if (type !== 'All') query.set('type', type);
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
  }, [q, stage, priority, source, owner, type, sort]);

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditor({ ...EMPTY_LEAD });
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    const id = params.get('lead');
    if (id) navigate(`/leads/${id}`, { replace: true });
  }, [params, navigate]);

  const summary = pack?.summary;
  const leads = pack?.leads || [];
  const allSelected = leads.length > 0 && selected.length === leads.length;
  const activeFilters = [priority !== 'All priority', source !== 'All sources', owner !== 'All owners'].filter(Boolean).length;

  useEffect(() => { localStorage.setItem('sx_leads_view', view); }, [view]);

  function saveColumns(next) {
    setColumns(next);
    localStorage.setItem('sx_leads_columns', JSON.stringify(next));
  }

  function open(lead) {
    navigate(`/leads/${lead.id}`, { state: { ids: leads.map((item) => item.id) } });
  }

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saved(andNew) {
    if (!andNew) setEditor(null);
    await load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this lead?')) return;
    await api(`/api/leads/${id}`, { method: 'DELETE' });
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

  if (editor) {
    return <LeadForm lead={editor} members={members} user={user} onCancel={() => setEditor(null)} onSaved={saved} />;
  }

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
          <button type="button" className="btn" onClick={() => setEditor({ ...EMPTY_LEAD })}>+ Create Lead</button>
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
          <input className="field !w-auto min-w-[240px] max-w-md flex-1" placeholder="Search by name, company or email…" value={q} onChange={(event) => setQ(event.target.value)} />
          <select className="field !w-40" value={type} onChange={(event) => setType(event.target.value)} aria-label="Lead type">
            <option value="All">All lead types</option>
            {LEAD_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field !w-48" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="relative">
            <button type="button" className={cx('btn-ghost !rounded-xl !py-2.5', activeFilters > 0 && '!border-blue-500 !text-blue-600')} onClick={() => setFilterOpen(!filterOpen)}>
              ⚲ Filter{activeFilters > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">{activeFilters}</span>}
            </button>
            {filterOpen && (
              <div className="absolute left-0 z-20 mt-2 w-72 space-y-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
                <Field label="Priority">
                  <select className="field" value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option>All priority</option>
                    {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Lead source">
                  <select className="field" value={source} onChange={(event) => setSource(event.target.value)}>
                    <option>All sources</option>
                    {SOURCES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Lead owner">
                  <select className="field" value={owner} onChange={(event) => setOwner(event.target.value)}>
                    <option>All owners</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
                <div className="flex justify-between pt-1">
                  <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => { setPriority('All priority'); setSource('All sources'); setOwner('All owners'); }}>Clear</button>
                  <button type="button" className="text-sm font-semibold text-blue-600" onClick={() => setFilterOpen(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
          <select className="field !w-44" value={view} onChange={(event) => setView(event.target.value)} aria-label="View">
            <option value="list">Table view</option>
            <option value="grid">Tile view</option>
            <option value="custom">Custom list view</option>
          </select>
          {view === 'custom' && <ColumnPicker columns={columns} onChange={saveColumns} />}
          <span className="ml-auto text-sm text-slate-400">{leads.length} of {summary?.total || 0}</span>
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
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => open(lead)}>
                        <Avatar name={lead.name} size="sm" />
                        <span>
                          <span className="block font-medium">{lead.name}</span>
                          <span className="block text-xs text-slate-400">{lead.company}</span>
                        </span>
                      </button>
                    </td>
                    <td><span className="inline-flex items-center gap-1.5 text-xs"><span className="h-1.5 w-1.5 rounded-full" style={{ background: stageDot[lead.stage] }} />{lead.stage}</span></td>
                    <td><PriorityPill value={lead.priority} /></td>
                    <td>{lead.source ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{lead.source}</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="font-medium">{money(lead.value)}</td>
                    <td className="text-slate-500">{lead.ownerName || '—'}</td>
                    <td className="text-slate-500">{ago(lead.updatedAt)}</td>
                    <td className="relative text-right">
                      <button type="button" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" onClick={() => setMenu(menu === lead.id ? null : lead.id)}>•••</button>
                      {menu === lead.id && (
                        <div className="absolute right-0 z-10 w-40 rounded-xl bg-white p-1 text-left shadow-xl ring-1 ring-slate-200">
                          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { open(lead); setMenu(null); }}>View</button>
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
        ) : view === 'custom' ? (
          <CustomTable
            leads={leads}
            columns={columns}
            selected={selected}
            allSelected={allSelected}
            onToggle={toggle}
            onToggleAll={() => setSelected(allSelected ? [] : leads.map((lead) => lead.id))}
            onOpen={open}
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <button key={lead.id} type="button" className="rounded-2xl border border-slate-100 p-4 text-left transition hover:border-blue-200 hover:shadow-sm" onClick={() => open(lead)}>
                <div className="flex items-start gap-3">
                  <Avatar name={lead.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-slate-400">{lead.company && lead.company !== lead.name ? lead.company : lead.email || '—'}</p>
                  </div>
                  {lead.leadType && <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">{lead.leadType}</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StagePill value={lead.stage} />
                  <PriorityPill value={lead.priority} />
                  {lead.source && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{lead.source}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="text-sm font-semibold text-slate-800">{money(lead.value)}</span>
                  <span>{lead.ownerName || 'Unassigned'} · {ago(lead.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {emailFor && <EmailModal lead={emailFor} onClose={() => setEmailFor(null)} />}
      {importing && <ImportModal members={members} user={user} onClose={() => setImporting(false)} onDone={async () => { setImporting(false); await load(); }} />}
    </div>
  );
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
