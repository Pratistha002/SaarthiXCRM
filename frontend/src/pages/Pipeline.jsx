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
        <div className="flex gap-4 overflow-x-auto pb-3">
          {stages.map((stage, index) => {
            const column = (pack?.deals || []).filter((deal) => deal.stage === stage.name);
            const total = totals[stage.name] || { count: 0, value: 0 };
            const firstClosed = !stage.active && stages[index - 1]?.active;
            return (
              <section
                key={stage.name}
                onDragOver={(event) => { event.preventDefault(); setDragOver(stage.name); }}
                onDragLeave={() => setDragOver('')}
                onDrop={(event) => drop(stage.name, event)}
                className={cx(
                  'flex w-72 shrink-0 flex-col rounded-3xl p-3',
                  stage.name === 'Won' ? 'bg-emerald-50/70' : stage.name === 'Lost' ? 'bg-rose-50/60' : 'bg-slate-100/80',
                  firstClosed && 'ml-4',
                  dragOver === stage.name && 'ring-2 ring-blue-400',
                )}
              >
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <p className={cx('text-xs font-semibold uppercase tracking-wide', stage.name === 'Won' ? 'text-emerald-700' : stage.name === 'Lost' ? 'text-rose-600' : 'text-slate-700')}>
                      {stage.name}
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200" title="Default win probability">{stage.probability}%</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {total.count} {total.count === 1 ? 'deal' : 'deals'} · <span className="font-semibold text-slate-800">{compact(total.value)}</span>
                  </p>
                  {!stage.active && <p className="text-[11px] text-slate-400">Closed · {closedPeriod}</p>}
                </div>
                <div className="space-y-3">
                  {column.map((deal) => <DealCard key={deal.id} deal={deal} onOpen={() => navigate(`/deals/${deal.id}`)} onAccount={() => navigate(`/accounts/${deal.accountId}`)} />)}
                  {column.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">No deals in this stage</p>}
                </div>
              </section>
            );
          })}
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

function DealCard({ deal, onOpen, onAccount }) {
  const open = deal.status === 'Open';
  const overdue = open && deal.expectedCloseDate && deal.expectedCloseDate < isoDay(new Date());
  const next = nextActionLabel(deal.nextAction);
  return (
    <article
      draggable
      onDragStart={(event) => { event.dataTransfer.setData('text/plain', deal.id); event.dataTransfer.effectAllowed = 'move'; }}
      onClick={onOpen}
      className="cursor-pointer rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 hover:ring-blue-300 active:cursor-grabbing"
    >
      <button type="button" className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline" onClick={(event) => { event.stopPropagation(); onAccount(); }}>
        {deal.accountName}
      </button>
      <p className="truncate text-sm text-slate-600">{shortName(deal)}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-slate-900">{money(deal.value)}</span>
        {deal.priority === 'High' ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">🔥 High</span> : <PriorityPill value={deal.priority} />}
      </div>
      <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
        <div className="flex justify-between gap-2"><dt>Owner</dt><dd className="truncate text-slate-700">{deal.ownerName}</dd></div>
        {open ? (
          <div className="flex justify-between gap-2"><dt>Expected Close</dt><dd className={cx(overdue ? 'font-medium text-rose-600' : 'text-slate-700')}>{shortDate(deal.expectedCloseDate)}</dd></div>
        ) : deal.status === 'Won' ? (
          <div className="flex justify-between gap-2"><dt>Won</dt><dd className="text-emerald-700">{shortDate(deal.wonDate)}</dd></div>
        ) : (
          <div className="flex justify-between gap-2"><dt>Reason</dt><dd className="truncate text-rose-600">{deal.lostReason === 'Other' ? deal.lostReasonOther : deal.lostReason}</dd></div>
        )}
      </dl>
      {open && (
        <p className={cx('mt-2 truncate rounded-lg px-2 py-1 text-xs', next ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700')}>
          {next ? `${next.icon} ${next.type} — ${next.when}` : 'No next action scheduled'}
        </p>
      )}
    </article>
  );
}
