import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import { compact, cx, isHeadOfSales, isoDay, money } from '../lib';
import { Banner } from '../ui';
import { stageTone } from './Pipeline';

const PERIODS = ['This Month', 'Next Month', 'This Quarter', 'Next Quarter', 'This Year'];

const CATEGORIES = [
  { key: 'won', label: 'Closed Won', hint: 'Already won in this period', color: 'bg-emerald-500', text: 'text-emerald-700' },
  { key: 'commit', label: 'Commit', hint: 'Negotiation', color: 'bg-blue-600', text: 'text-blue-700' },
  { key: 'best', label: 'Best Case', hint: 'Proposal', color: 'bg-violet-400', text: 'text-violet-700' },
  { key: 'pipeline', label: 'Pipeline', hint: 'Qualified and Demo / Meeting', color: 'bg-slate-300', text: 'text-slate-600' },
];

const CATEGORY_OF_STAGE = { Negotiation: 'commit', Proposal: 'best', Qualified: 'pipeline', 'Demo / Meeting': 'pipeline' };

function periodRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  const span = (start, end) => ({ from: isoDay(start), to: isoDay(end) });
  switch (key) {
    case 'Next Month': return span(new Date(y, m + 1, 1), new Date(y, m + 2, 0));
    case 'This Quarter': return span(new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 0));
    case 'Next Quarter': return span(new Date(y, q * 3 + 3, 1), new Date(y, q * 3 + 6, 0));
    case 'This Year': return span(new Date(y, 0, 1), new Date(y, 11, 31));
    default: return span(new Date(y, m, 1), new Date(y, m + 1, 0));
  }
}

const closedOn = (deal) => deal.closedDate || deal.wonDate || '';
const inRange = (day, range) => Boolean(day) && day >= range.from && day <= range.to;
const weighted = (deal) => deal.weightedValue ?? Math.round(((deal.value || 0) * (deal.probability || 0)) / 100);
const sum = (rows, pick = (d) => d.value || 0) => rows.reduce((total, row) => total + pick(row), 0);

function shortDate(day) {
  if (!day) return '—';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthKey(day) {
  return day ? day.slice(0, 7) : '';
}

export default function Sales() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useTeam();
  const manager = isHeadOfSales(user?.role);
  const [period, setPeriod] = useState('This Month');
  const [owner, setOwner] = useState(() => (manager ? 'All' : user?.id || 'All'));
  const [product, setProduct] = useState('All');
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/deals/meta').then((meta) => setProducts(meta.products || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (owner !== 'All') params.set('owner', owner);
    if (product !== 'All') params.set('product', product);
    let stale = false;
    api(`/api/deals?${params}`)
      .then((pack) => { if (!stale) { setDeals(pack.deals || []); setError(''); } })
      .catch((err) => { if (!stale) setError(err.message); });
    return () => { stale = true; };
  }, [owner, product]);

  const range = periodRange(period);
  const today = isoDay(new Date());

  const data = useMemo(() => {
    if (!deals) return null;
    const open = deals.filter((d) => d.status === 'Open');
    const won = deals.filter((d) => d.status === 'Won' && inRange(closedOn(d), range));
    const lost = deals.filter((d) => d.status === 'Lost' && inRange(closedOn(d), range));
    const closing = open.filter((d) => inRange(d.expectedCloseDate, range));
    const overdue = open.filter((d) => d.expectedCloseDate && d.expectedCloseDate < today);
    const categories = {
      won: sum(won),
      commit: sum(closing.filter((d) => CATEGORY_OF_STAGE[d.stage] === 'commit')),
      best: sum(closing.filter((d) => CATEGORY_OF_STAGE[d.stage] === 'best')),
      pipeline: sum(closing.filter((d) => CATEGORY_OF_STAGE[d.stage] === 'pipeline')),
    };
    const expected = categories.won + sum(closing, weighted);
    const decided = won.length + lost.length;

    const now = new Date();
    const months = [];
    for (let offset = -5; offset <= 3; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const key = isoDay(date).slice(0, 7);
      const monthWon = deals.filter((d) => d.status === 'Won' && monthKey(closedOn(d)) === key);
      const monthOpen = offset >= 0 ? open.filter((d) => monthKey(d.expectedCloseDate) === key) : [];
      months.push({
        key,
        label: date.toLocaleDateString('en-GB', { month: 'short' }),
        year: date.getFullYear(),
        current: offset === 0,
        future: offset > 0,
        won: sum(monthWon),
        forecast: sum(monthOpen, weighted),
      });
    }

    const owners = new Map();
    const row = (d) => {
      const id = d.ownerId || 'none';
      if (!owners.has(id)) owners.set(id, { id, name: d.ownerName || 'Unassigned', won: 0, wonCount: 0, lostCount: 0, closing: 0, weighted: 0, open: 0 });
      return owners.get(id);
    };
    won.forEach((d) => { const r = row(d); r.won += d.value || 0; r.wonCount += 1; });
    lost.forEach((d) => { row(d).lostCount += 1; });
    closing.forEach((d) => { const r = row(d); r.closing += d.value || 0; r.weighted += weighted(d); });
    open.forEach((d) => { row(d).open += 1; });

    return {
      open, won, lost, closing, overdue, categories, expected, months,
      bestCase: categories.won + categories.commit + categories.best,
      winRate: decided ? Math.round((won.length / decided) * 100) : null,
      avgDeal: won.length ? Math.round(categories.won / won.length) : 0,
      owners: [...owners.values()].sort((a, b) => (b.won + b.weighted) - (a.won + a.weighted)),
    };
  }, [deals, range.from, range.to, today]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sales &amp; Forecast</h1>
          <p className="text-sm text-slate-500">What you have closed, and what is likely to close next.</p>
          <p className="mt-1 text-sm font-medium text-slate-600">{shortDate(range.from)} – {shortDate(range.to)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-white p-1 ring-1 ring-slate-200">
            {PERIODS.map((item) => (
              <button key={item} type="button" onClick={() => setPeriod(item)} className={cx('rounded-full px-3 py-1 text-sm', period === item ? 'bg-slate-900 font-medium text-white' : 'text-slate-600 hover:text-slate-900')}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 !p-3">
        <FilterSelect label="Owner" value={owner} onChange={setOwner} options={[['All', 'All'], ...members.map((m) => [m.id, m.id === user?.id ? `${m.name} (me)` : m.name])]} />
        <FilterSelect label="Product" value={product} onChange={setProduct} options={[['All', 'All'], ...products.map((p) => [p, p])]} />
        {(product !== 'All' || owner !== (manager ? 'All' : user?.id)) && (
          <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => { setProduct('All'); setOwner(manager ? 'All' : user?.id || 'All'); }}>Reset</button>
        )}
      </div>

      {error && <div className="mb-3"><Banner tone="danger">{error}</Banner></div>}
      {!data ? <p className="py-20 text-center text-sm text-slate-400">Loading sales…</p> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Closed Won" value={compact(data.categories.won)} note={`${data.won.length} ${data.won.length === 1 ? 'deal' : 'deals'} won`} tone="good" />
            <Kpi label="Expected Revenue" value={compact(data.expected)} note="Won + probability-weighted open deals" tone="blue" />
            <Kpi label="Best Case" value={compact(data.bestCase)} note="Won + Commit + Best Case" />
            <Kpi label="Win Rate" value={data.winRate == null ? '—' : `${data.winRate}%`} note={data.winRate == null ? 'No deals closed yet' : `${data.won.length} won · ${data.lost.length} lost · avg ${compact(data.avgDeal)}`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <TrendChart months={data.months} />
            <ForecastBreakdown categories={data.categories} expected={data.expected} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <ClosingDeals deals={data.closing} period={period} today={today} onOpen={(deal) => navigate(`/deals/${deal.id}`)} />
            <div className="space-y-4">
              <Attention overdue={data.overdue} onOpen={(deal) => navigate(`/deals/${deal.id}`)} onPipeline={() => navigate('/pipeline')} />
              <RecentWins deals={data.won} onOpen={(deal) => navigate(`/deals/${deal.id}`)} />
            </div>
          </div>

          {data.owners.length > 0 && <OwnerTable owners={data.owners} />}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white pl-2 text-sm text-slate-500">
      {label}:
      <select className="max-w-[12rem] bg-transparent py-1.5 pr-2 font-medium text-slate-800 outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

function Kpi({ label, value, note, tone }) {
  return (
    <div className="card !p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cx('text-2xl font-semibold', tone === 'good' && 'text-emerald-700', tone === 'blue' && 'text-blue-700')}>{value}</p>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="card !p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TrendChart({ months }) {
  const max = Math.max(1, ...months.map((m) => m.won + m.forecast));
  return (
    <Panel
      title="Revenue Trend"
      subtitle="Won revenue for the last 6 months and weighted forecast for the next 3"
      action={(
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Won</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-300" />Forecast</span>
        </div>
      )}
    >
      <div className="flex h-56 items-end gap-2 border-b border-slate-200 pb-0">
        {months.map((m) => {
          const total = m.won + m.forecast;
          return (
            <div key={m.key} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <span className={cx('mb-1 text-[11px] font-medium', total ? 'text-slate-700' : 'text-slate-300')}>{total ? compact(total) : '—'}</span>
              <div className="flex w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 80}%` }}>
                {m.forecast > 0 && <div className="w-full bg-blue-300" style={{ height: `${(m.forecast / total) * 100}%` }} />}
                {m.won > 0 && <div className="w-full bg-emerald-500" style={{ height: `${(m.won / total) * 100}%` }} />}
              </div>
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-40 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                <p className="font-semibold">{m.label} {m.year}</p>
                <p>Won: {money(m.won)}</p>
                {!m.current && !m.future ? null : <p>Forecast: {money(m.forecast)}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {months.map((m) => (
          <span key={m.key} className={cx('flex-1 text-center text-xs', m.current ? 'font-semibold text-slate-900' : m.future ? 'text-blue-500' : 'text-slate-500')}>
            {m.label}{m.current && ' •'}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function ForecastBreakdown({ categories, expected }) {
  const total = CATEGORIES.reduce((acc, c) => acc + categories[c.key], 0);
  return (
    <Panel title="Forecast Breakdown" subtitle="Won deals plus open deals expected to close in this period">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {total > 0 && CATEGORIES.map((c) => categories[c.key] > 0 && (
          <div key={c.key} className={c.color} style={{ width: `${(categories[c.key] / total) * 100}%` }} title={`${c.label}: ${money(categories[c.key])}`} />
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {CATEGORIES.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2.5">
              <span className={cx('h-3 w-3 rounded-sm', c.color)} />
              <span>
                <span className="block font-medium text-slate-800">{c.label}</span>
                <span className="block text-xs text-slate-400">{c.hint}</span>
              </span>
            </span>
            <span className={cx('font-semibold', c.text)}>{money(categories[c.key])}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-sm">
        <span className="font-medium text-blue-800">Expected revenue</span>
        <span className="text-lg font-semibold text-blue-800">{money(expected)}</span>
      </div>
    </Panel>
  );
}

function StagePill({ stage }) {
  const tone = stageTone(stage);
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tone.pill)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', tone.bar)} />{stage}
    </span>
  );
}

function ClosingDeals({ deals, period, today, onOpen }) {
  const rows = [...deals].sort((a, b) => (a.expectedCloseDate || '').localeCompare(b.expectedCloseDate || ''));
  return (
    <Panel title="Deals Expected to Close" subtitle={`${rows.length} open ${rows.length === 1 ? 'deal' : 'deals'} · ${period.toLowerCase()} · ${compact(sum(rows))} total`}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No open deals are expected to close in this period.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 pb-2 font-medium">Deal</th>
                <th className="px-3 pb-2 font-medium">Stage</th>
                <th className="px-3 pb-2 text-right font-medium">Value</th>
                <th className="px-3 pb-2 text-right font-medium">Weighted</th>
                <th className="px-5 pb-2 font-medium">Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((deal) => (
                <tr key={deal.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(deal)}>
                  <td className="max-w-[14rem] px-5 py-2.5">
                    <span className="block truncate font-medium text-slate-900">{deal.accountName}</span>
                    <span className="block truncate text-xs text-slate-500">{deal.ownerName} · {deal.product}</span>
                  </td>
                  <td className="px-3 py-2.5"><StagePill stage={deal.stage} /></td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-900">{money(deal.value)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{money(weighted(deal))} <span className="text-xs text-slate-400">({deal.probability}%)</span></td>
                  <td className={cx('whitespace-nowrap px-5 py-2.5 text-xs', deal.expectedCloseDate < today ? 'font-medium text-rose-600' : 'text-slate-600')}>{shortDate(deal.expectedCloseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Attention({ overdue, onOpen, onPipeline }) {
  return (
    <Panel title="Needs Attention" subtitle="Open deals past their expected close date">
      {overdue.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">✓ No overdue deals. Every open deal has a future close date.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {overdue.slice(0, 4).map((deal) => (
              <li key={deal.id}>
                <button type="button" onClick={() => onOpen(deal)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-rose-50/60 px-3 py-2 text-left text-sm hover:bg-rose-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{deal.accountName}</span>
                    <span className="block text-xs text-rose-600">Was due {shortDate(deal.expectedCloseDate)}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-slate-800">{compact(deal.value)}</span>
                </button>
              </li>
            ))}
          </ul>
          {overdue.length > 4 && (
            <button type="button" className="mt-3 text-sm font-medium text-blue-600 hover:underline" onClick={onPipeline}>+{overdue.length - 4} more in Pipeline</button>
          )}
        </>
      )}
    </Panel>
  );
}

function RecentWins({ deals, onOpen }) {
  const rows = [...deals].sort((a, b) => closedOn(b).localeCompare(closedOn(a))).slice(0, 5);
  return (
    <Panel title="Recent Wins" subtitle="Deals won in this period">
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No deals won in this period yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((deal) => (
            <li key={deal.id}>
              <button type="button" onClick={() => onOpen(deal)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-blue-700">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs text-emerald-600">✓</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{deal.accountName}</span>
                    <span className="block text-xs text-slate-500">{deal.ownerName} · {shortDate(closedOn(deal))}</span>
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-emerald-700">{compact(deal.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OwnerTable({ owners }) {
  const max = Math.max(1, ...owners.map((o) => o.won + o.weighted));
  return (
    <Panel title="Performance by Owner" subtitle="Won revenue and weighted forecast for this period">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 pb-2 font-medium">Owner</th>
              <th className="px-3 pb-2 font-medium">Won vs forecast</th>
              <th className="px-3 pb-2 text-right font-medium">Won</th>
              <th className="px-3 pb-2 text-right font-medium">Closing</th>
              <th className="px-3 pb-2 text-right font-medium">Weighted</th>
              <th className="px-3 pb-2 text-right font-medium">Win rate</th>
              <th className="px-5 pb-2 text-right font-medium">Open deals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {owners.map((o) => {
              const decided = o.wonCount + o.lostCount;
              return (
                <tr key={o.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{o.name}</td>
                  <td className="w-1/3 px-3 py-3">
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="bg-emerald-500" style={{ width: `${(o.won / max) * 100}%` }} />
                      <div className="bg-blue-300" style={{ width: `${(o.weighted / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700">{compact(o.won)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{compact(o.closing)}</td>
                  <td className="px-3 py-3 text-right text-blue-700">{compact(o.weighted)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{decided ? `${Math.round((o.wonCount / decided) * 100)}%` : '—'}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{o.open}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
