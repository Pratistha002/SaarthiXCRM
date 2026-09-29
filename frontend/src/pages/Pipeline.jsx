import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import {
  CLOSED_PERIODS, CLOSE_RANGES, compact, cx, dateRange, isHeadOfSales, isoDay, money, nextActionLabel,
} from '../lib';
import { Banner, PriorityPill } from '../ui';
import { LostModal, WonModal } from './DealModals';

const BLANK = {
  q: '', owner: 'All', account: 'All', stage: 'All', product: 'All', priority: 'All',
  close: 'Any time', closeFrom: '', closeTo: '', minValue: '', maxValue: '',
};

function shortName(deal) {
  const prefix = `${deal.accountName} - `;
  return deal.name?.startsWith(prefix) ? deal.name.slice(prefix.length) : deal.name;
}

function shortDate(day) {
  if (!day) return '—';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useTeam();
  const [meta, setMeta] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [pack, setPack] = useState(null);
  const [filters, setFilters] = useState(() => ({ ...BLANK, owner: isHeadOfSales(user?.role) ? 'All' : user?.id || 'All' }));
  const [closedPeriod, setClosedPeriod] = useState('This Month');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState('');
  const [winning, setWinning] = useState(null);
  const [losing, setLosing] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('pipelineView') || 'board');

  useEffect(() => { localStorage.setItem('pipelineView', view); }, [view]);

  useEffect(() => {
    api('/api/deals/meta').then(setMeta).catch((err) => setError(err.message));
    api('/api/accounts').then(setAccounts).catch(() => {});
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    ['q', 'owner', 'account', 'stage', 'product', 'priority'].forEach((key) => {
      if (filters[key] && filters[key] !== 'All') params.set(key, filters[key]);
    });
    const close = filters.close === 'Custom' ? { from: filters.closeFrom, to: filters.closeTo } : dateRange(filters.close);
    if (close.from) params.set('closeFrom', close.from);
    if (close.to) params.set('closeTo', close.to);
    if (filters.minValue !== '') params.set('minValue', filters.minValue);
    if (filters.maxValue !== '') params.set('maxValue', filters.maxValue);
    const closed = dateRange(closedPeriod);
    if (closed.from) params.set('closedFrom', closed.from);
    if (closed.to) params.set('closedTo', closed.to);
    return params.toString();
  }, [filters, closedPeriod]);

  async function load() {
    try {
      setPack(await api(`/api/deals?${query}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const set = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });
  const filtered = JSON.stringify({ ...filters, owner: '' }) !== JSON.stringify({ ...BLANK, owner: '' }) || filters.owner !== 'All';

  async function drop(stage, event) {
    event.preventDefault();
    setDragOver('');
    const id = event.dataTransfer.getData('text/plain');
    const deal = pack?.deals.find((item) => item.id === id);
    if (!deal || deal.stage === stage) return;
    if (stage === 'Won') { setWinning(deal); return; }
    if (stage === 'Lost') { setLosing(deal); return; }
    setPack((current) => ({ ...current, deals: current.deals.map((item) => (item.id === id ? { ...item, stage } : item)) }));
    try {
      await api(`/api/deals/${id}/stage`, { method: 'PATCH', body: { stage } });
    } catch (err) {
      setError(err.status ? err.message : 'Could not reach the server, so the stage was not changed.');
    }
    await load();
  }

  async function closed() {
    setWinning(null);
    setLosing(null);
    await load();
  }

  const summary = pack?.summary;
  const stages = meta?.stages || [];
  const totals = Object.fromEntries((pack?.stages || []).map((row) => [row.name, row]));
  const noDealsAtAll = summary && summary.totalDeals === 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Sales Pipeline</h1>
        <p className="text-sm text-slate-500">Manage active deals from qualification to closure.</p>
        {summary && (
          <p className="mt-1 text-sm font-medium text-slate-600">
            {summary.openDeals} open {summary.openDeals === 1 ? 'deal' : 'deals'} • {compact(summary.totalPipeline)} pipeline
          </p>
        )}
      </div>
      {error && <div className="mb-3"><Banner tone="danger">{error}</Banner></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Pipeline" value={compact(summary?.totalPipeline || 0)} note={`${summary?.openDeals || 0} open deals`} />
        <SummaryCard label="Open Deals" value={summary?.openDeals ?? 0} note="Active opportunities" />
        <SummaryCard
          label="Won Revenue"
          value={compact(summary?.wonRevenue || 0)}
          tone="good"
          note={(
            <select className="-ml-1 rounded-md bg-transparent px-1 text-xs text-slate-500 outline-none hover:bg-slate-100" value={closedPeriod} onChange={(event) => setClosedPeriod(event.target.value)} aria-label="Won revenue period">
              {CLOSED_PERIODS.map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
        />
        <SummaryCard label="Weighted Forecast" value={compact(summary?.weightedForecast || 0)} note="Based on deal probability" />
      </div>

      <div className="card mb-4 !p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input className="field !w-64 !py-2" placeholder="Search deals…" value={filters.q} onChange={set('q')} />
          <Select label="Owner" value={filters.owner} onChange={set('owner')} options={[['All', 'All'], ...members.map((m) => [m.id, m.id === user?.id ? `${m.name} (me)` : m.name])]} />
          <Select label="Account" value={filters.account} onChange={set('account')} options={[['All', 'All'], ...accounts.map((a) => [a.id, a.name])]} />
          <Select label="Stage" value={filters.stage} onChange={set('stage')} options={[['All', 'All'], ...stages.map((s) => [s.name, s.name])]} />
          <Select label="Product" value={filters.product} onChange={set('product')} options={[['All', 'All'], ...(meta?.products || []).map((p) => [p, p])]} />
          <Select label="Priority" value={filters.priority} onChange={set('priority')} options={[['All', 'All'], ...(meta?.priorities || []).map((p) => [p, p])]} />
          <Select label="Expected Close" value={filters.close} onChange={set('close')} options={CLOSE_RANGES.map((r) => [r, r])} />
          {filters.close === 'Custom' && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <input type="date" className="field !w-auto !py-1.5" value={filters.closeFrom} onChange={set('closeFrom')} aria-label="Close from" />
              to
              <input type="date" className="field !w-auto !py-1.5" value={filters.closeTo} min={filters.closeFrom || undefined} onChange={set('closeTo')} aria-label="Close to" />
            </span>
          )}
          <span className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 text-sm text-slate-500">
            Value ₹
            <input className="w-20 bg-transparent py-1.5 outline-none" inputMode="numeric" placeholder="min" value={filters.minValue} onChange={(event) => setFilters({ ...filters, minValue: event.target.value.replace(/[^\d]/g, '') })} />
            –
            <input className="w-20 bg-transparent py-1.5 outline-none" inputMode="numeric" placeholder="max" value={filters.maxValue} onChange={(event) => setFilters({ ...filters, maxValue: event.target.value.replace(/[^\d]/g, '') })} />
          </span>
          {filtered && (
            <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => setFilters({ ...BLANK })}>Reset Filters</button>
          )}
        </div>
      </div>

      {noDealsAtAll ? (
        <div className="card py-16 text-center">
          <p className="text-lg font-semibold text-slate-800">No deals in your pipeline yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Deals are created when you convert a qualified lead. Open a Qualified lead and click Convert to create its account, contact and deal.
          </p>
          <button type="button" className="btn mt-5" onClick={() => navigate('/leads')}>Go to Leads</button>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex rounded-full bg-slate-100 p-1">
              {[['board', 'Board'], ['list', 'List']].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setView(key)} className={cx('rounded-full px-4 py-1 text-sm', view === key ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">{view === 'board' ? 'Drag a deal to another stage to move it.' : 'Click a deal to open it.'}</p>
          </div>

          {view === 'board' ? (
            <div className="flex gap-3 overflow-x-auto bg-slate-50/60 p-4">
              {stages.map((stage, index) => {
                const column = (pack?.deals || []).filter((deal) => deal.stage === stage.name);
                const total = totals[stage.name] || { count: 0, value: 0 };
                const firstClosed = !stage.active && stages[index - 1]?.active;
                const tone = stageTone(stage.name);
                const share = summary?.totalPipeline && stage.active ? Math.round((total.value / summary.totalPipeline) * 100) : 0;
                return (
                  <div key={stage.name} className={cx('flex min-w-[15rem] flex-1 gap-3', firstClosed && 'border-l border-dashed border-slate-300 pl-3')}>
                    <section
                      onDragOver={(event) => { event.preventDefault(); setDragOver(stage.name); }}
                      onDragLeave={() => setDragOver('')}
                      onDrop={(event) => drop(stage.name, event)}
                      className={cx(
                        'flex w-full flex-col rounded-2xl bg-white ring-1 ring-slate-200/70 transition',
                        dragOver === stage.name && 'ring-2 ring-blue-400 bg-blue-50/40',
                      )}
                    >
                      <div className={cx('h-1 rounded-t-2xl', tone.bar)} />
                      <div className="border-b border-slate-100 px-3 pb-3 pt-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cx('flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', tone.text)}>
                            {stage.name}
                            <span className={cx('rounded-full px-1.5 py-0.5 text-[11px] font-semibold normal-case', tone.pill)}>{total.count}</span>
                          </p>
                          <span className="text-[11px] text-slate-400" title="Default win probability">{stage.probability}%</span>
                        </div>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{compact(total.value)}</p>
                        {stage.active ? (
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100" title={`${share}% of open pipeline value`}>
                            <div className={cx('h-full rounded-full', tone.bar)} style={{ width: `${share}%` }} />
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">Closed · {closedPeriod}</p>
                        )}
                      </div>
                      <div className="max-h-[calc(100vh-24rem)] min-h-[9rem] flex-1 space-y-2 overflow-y-auto p-2">
                        {column.map((deal) => <DealCard key={deal.id} deal={deal} onOpen={() => navigate(`/deals/${deal.id}`)} onAccount={() => navigate(`/accounts/${deal.accountId}`)} />)}
                        {column.length === 0 && (
                          <div className={cx('grid h-full min-h-[8rem] place-items-center rounded-xl text-center text-xs', dragOver === stage.name ? 'text-blue-600' : 'text-slate-300')}>
                            {dragOver === stage.name ? 'Drop to move here' : 'No deals'}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                );
              })}
            </div>
          ) : (
            <DealList stages={stages} deals={pack?.deals || []} onOpen={(deal) => navigate(`/deals/${deal.id}`)} onAccount={(deal) => navigate(`/accounts/${deal.accountId}`)} />
          )}
        </div>
      )}

      {winning && <WonModal deal={winning} onClose={() => setWinning(null)} onDone={closed} />}
      {losing && <LostModal deal={losing} reasons={meta?.lostReasons || []} onClose={() => setLosing(null)} onDone={closed} />}
    </div>
  );
}

function SummaryCard({ label, value, note, tone }) {
  return (
    <div className="card !p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cx('text-2xl font-semibold', tone === 'good' && 'text-emerald-700')}>{value}</p>
      <div className="text-xs text-slate-500">{note}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white pl-2 text-sm text-slate-500">
      {label}:
      <select className="max-w-[10rem] bg-transparent py-1.5 pr-2 font-medium text-slate-800 outline-none" value={value} onChange={onChange}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

const STAGE_TONES = {
  Qualified: { bar: 'bg-sky-500', text: 'text-sky-700', pill: 'bg-sky-50 text-sky-700' },
  'Demo / Meeting': { bar: 'bg-indigo-500', text: 'text-indigo-700', pill: 'bg-indigo-50 text-indigo-700' },
  Proposal: { bar: 'bg-violet-500', text: 'text-violet-700', pill: 'bg-violet-50 text-violet-700' },
  Negotiation: { bar: 'bg-amber-500', text: 'text-amber-700', pill: 'bg-amber-50 text-amber-700' },
  Won: { bar: 'bg-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-700' },
  Lost: { bar: 'bg-rose-500', text: 'text-rose-600', pill: 'bg-rose-50 text-rose-600' },
};

function stageTone(name) {
  return STAGE_TONES[name] || { bar: 'bg-slate-400', text: 'text-slate-700', pill: 'bg-slate-100 text-slate-600' };
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
}

function Priority({ value }) {
  return value === 'High' ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">🔥 High</span> : <PriorityPill value={value} />;
}

function closeInfo(deal) {
  if (deal.status === 'Won') return { label: `Won ${shortDate(deal.wonDate)}`, className: 'text-emerald-700' };
  if (deal.status === 'Lost') return { label: deal.lostReason === 'Other' ? deal.lostReasonOther : deal.lostReason, className: 'text-rose-600' };
  const overdue = deal.expectedCloseDate && deal.expectedCloseDate < isoDay(new Date());
  return { label: shortDate(deal.expectedCloseDate), className: overdue ? 'font-medium text-rose-600' : 'text-slate-500' };
}

function DealCard({ deal, onOpen, onAccount }) {
  const open = deal.status === 'Open';
  const next = nextActionLabel(deal.nextAction);
  const close = closeInfo(deal);
  return (
    <article
      draggable
      onDragStart={(event) => { event.dataTransfer.setData('text/plain', deal.id); event.dataTransfer.effectAllowed = 'move'; }}
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button type="button" className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline" onClick={(event) => { event.stopPropagation(); onAccount(); }}>
            {deal.accountName}
          </button>
          <p className="truncate text-xs text-slate-500">{shortName(deal)}</p>
        </div>
        <Priority value={deal.priority} />
      </div>
      <p className="mt-2 text-base font-semibold text-slate-900">{money(deal.value)}</p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-slate-600" title={`Owner: ${deal.ownerName}`}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{initials(deal.ownerName)}</span>
          <span className="truncate">{deal.ownerName}</span>
        </span>
        <span className={cx('shrink-0', close.className)} title={open ? 'Expected close' : undefined}>{open ? '📅 ' : ''}{close.label}</span>
      </div>
      {open && (
        <p className={cx('mt-2 truncate rounded-md px-2 py-1 text-[11px]', next ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700')}>
          {next ? `${next.icon} ${next.type} — ${next.when}` : 'No next action scheduled'}
        </p>
      )}
    </article>
  );
}

function DealList({ stages, deals, onOpen, onAccount }) {
  const order = Object.fromEntries(stages.map((stage, index) => [stage.name, index]));
  const rows = [...deals].sort((a, b) => (order[a.stage] ?? 99) - (order[b.stage] ?? 99) || (b.value || 0) - (a.value || 0));
  if (rows.length === 0) return <p className="py-12 text-center text-sm text-slate-400">No deals match these filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Deal</th>
            <th className="px-4 py-2.5 font-medium">Stage</th>
            <th className="px-4 py-2.5 text-right font-medium">Value</th>
            <th className="px-4 py-2.5 font-medium">Priority</th>
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Close</th>
            <th className="px-4 py-2.5 font-medium">Next Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((deal) => {
            const tone = stageTone(deal.stage);
            const next = nextActionLabel(deal.nextAction);
            const close = closeInfo(deal);
            return (
              <tr key={deal.id} onClick={() => onOpen(deal)} className="cursor-pointer hover:bg-blue-50/40">
                <td className="max-w-[16rem] px-4 py-3">
                  <button type="button" className="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-blue-600 hover:underline" onClick={(event) => { event.stopPropagation(); onAccount(deal); }}>
                    {deal.accountName}
                  </button>
                  <span className="block truncate text-xs text-slate-500">{shortName(deal)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', tone.pill)}>
                    <span className={cx('h-1.5 w-1.5 rounded-full', tone.bar)} />{deal.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{money(deal.value)}</td>
                <td className="px-4 py-3"><Priority value={deal.priority} /></td>
                <td className="px-4 py-3 text-slate-700">{deal.ownerName}</td>
                <td className={cx('whitespace-nowrap px-4 py-3 text-xs', close.className)}>{close.label}</td>
                <td className="max-w-[14rem] truncate px-4 py-3 text-xs">
                  {deal.status !== 'Open' ? <span className="text-slate-300">—</span>
                    : next ? <span className="text-blue-700">{next.icon} {next.type} — {next.when}</span>
                      : <span className="text-amber-700">No next action</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
