import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { compact, cx, dueLabel, isOverdue, money, prettyDate, prettyTime, stageDot } from '../lib';
import { Avatar, PriorityPill, StagePill } from '../ui';

function rangeLabel() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (value) => String(value).padStart(2, '0');
  return `01 ${months[0]} – ${pad(now.getDate())} ${months[now.getMonth()]}, ${now.getFullYear()}`;
}

function Expand() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 5h10v10M19 5L9 15" />
    </svg>
  );
}

function Signal() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/90" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 14.5a8 8 0 0 1 15 0" strokeLinecap="round" />
      <path d="M7.5 17a4.8 4.8 0 0 1 9 0" strokeLinecap="round" />
      <circle cx="12" cy="19.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function peak(series) {
  if (!series?.length) return { index: 0, changePct: 0 };
  let index = 0;
  series.forEach((item, i) => {
    if (item.count > series[index].count) index = i;
  });
  const previous = index === 0 ? 0 : series[index - 1].count;
  const current = series[index].count;
  const changePct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return { index, changePct: Math.round(changePct * 10) / 10 };
}

function Bars({ series }) {
  const max = Math.max(...(series || []).map((item) => item.count), 0);
  const top = Math.max(12, Math.ceil(max / 3) * 3 || 12);
  const ticks = [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0];
  const mark = peak(series || []);

  return (
    <div className="mt-5 flex h-56 gap-4">
      <div className="flex h-[11.5rem] flex-col justify-between pt-1 text-[11px] text-slate-300">
        {ticks.map((tick) => <span key={tick}>{tick}</span>)}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-0 top-1 flex h-[11.5rem] flex-col justify-between">
          {ticks.map((tick) => <div key={tick} className="border-t border-slate-100" />)}
        </div>
        <div className="relative flex h-[11.5rem] items-end gap-5 px-2">
          {(series || []).map((item, index) => {
            const hot = index === mark.index && item.count > 0;
            const height = Math.max(item.count > 0 ? 10 : 6, (item.count / top) * 100);
            return (
              <div key={`${item.month}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="relative flex h-full w-full items-end justify-center">
                  {hot && (
                    <span className="absolute -top-1 z-10 rounded-full bg-[#10233f] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                      +{mark.changePct}%
                    </span>
                  )}
                  <div
                    className={cx('w-9 rounded-t-2xl', hot ? 'bg-[#163a73]' : 'bg-[#c8e4ff]')}
                    style={{ height: `${height}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-5 px-2">
          {(series || []).map((item, index) => (
            <span key={`${item.month}-label-${index}`} className="flex-1 text-center text-xs text-slate-400">{item.month}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Spark({ series }) {
  const values = (series || []).map((item) => item.value);
  const max = Math.max(...values, 1);
  const width = 260;
  const height = 78;
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => [index * step, height - 10 - (value / max) * (height - 22)]);
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point[0]},${point[1]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-[72px] w-full">
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ sources, total }) {
  const colors = ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#38bdf8', '#818cf8'];
  const rows = (sources || []).filter((item) => item.count > 0);
  const legend = rows.length ? rows : (sources || []).slice(0, 4);
  const sum = rows.reduce((acc, item) => acc + item.count, 0) || 1;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="mt-3 flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-[132px] w-[132px]">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e8eef6" strokeWidth="14" />
        {legend.map((item, index) => {
          const length = ((item.count || 0) / sum) * circ;
          const node = (
            <circle
              key={item.name}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="14"
              strokeDasharray={`${Math.max(length, item.count ? 4 : 0)} ${circ}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += length;
          return node;
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-slate-900 text-[26px] font-semibold">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-slate-400 text-[11px]">leads</text>
      </svg>
      <ul className="space-y-2 text-sm text-slate-600">
        {legend.map((item, index) => (
          <li key={item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} />
            <span className="w-28">{item.name}</span>
            <span className="font-semibold text-slate-800">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EMPTY = {
  leadCount: 0,
  pipelineValue: 0,
  weeklyRevenue: 0,
  weeklyChangePct: 0,
  totalWon: 0,
  conversionPct: 0,
  conversionChangePct: 0,
  openTasks: 0,
  engagement: [
    { month: 'Jan', count: 0 },
    { month: 'Feb', count: 0 },
    { month: 'Mar', count: 0 },
    { month: 'Apr', count: 0 },
    { month: 'May', count: 0 },
    { month: 'Jun', count: 0 },
  ],
  annual: [],
  revenueSeries: [],
  activity: [],
  sources: [],
  upcoming: [],
  topDeals: [],
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('Monthly');

  useEffect(() => {
    api('/api/dashboard').then(setData).catch((err) => setError(err.message));
  }, []);

  const view = data || EMPTY;
  const series = period === 'Annually' ? (view.annual?.length ? view.annual : view.engagement) : view.engagement;
  const first = user?.name?.split(' ')[0] || 'there';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[34px] font-semibold tracking-tight text-slate-900">Welcome Back, {first}</h1>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-500">
            <CalendarIcon />
            {rangeLabel()}
          </span>
          <button type="button" className="btn" onClick={() => navigate('/leads?new=1')}>+ Add New Lead</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-3">
          <section className="card">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">Pipeline Goal</p>
              <Expand />
            </div>
            <p className="text-xs text-slate-400">Total deal value</p>
            <div className="mt-4 rounded-[22px] bg-gradient-to-br from-[#4aa7ff] to-[#1d7be8] p-5 text-white shadow-[0_14px_28px_rgba(29,123,232,0.28)]">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>SaarthiX CRM</span>
                <Signal />
              </div>
              <p className="mt-8 text-xs text-white/80">Pipeline value</p>
              <p className="mt-1 text-[28px] font-semibold tracking-tight">{money(view.pipelineValue)}</p>
              <div className="mt-5 flex items-center justify-between text-[11px] tracking-[0.18em] text-white/80">
                <span>•••• PIPELINE</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 tracking-normal">LIVE</span>
              </div>
            </div>
          </section>

          <section className="card">
            <p className="text-sm text-slate-500">Weekly Revenue</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-[32px] font-semibold tracking-tight">{compact(view.weeklyRevenue)}</p>
              <span className={cx('text-sm font-medium', view.weeklyChangePct >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                {view.weeklyChangePct >= 0 ? '↗' : '↘'} {Math.abs(view.weeklyChangePct)}%
              </span>
            </div>
          </section>

          <section className="card">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400">◎</span>
              Conversion
            </div>
            <p className="mt-1 text-xs text-slate-400">Win rate</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-[40px] font-semibold leading-none">{Math.round(view.conversionPct)}%</p>
              <span className={cx('mb-1 text-sm font-medium', view.conversionChangePct >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                {view.conversionChangePct >= 0 ? '↗' : '↘'} {Math.abs(view.conversionChangePct)}%
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">{view.leadCount} leads · {view.openTasks} open tasks</p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-800">Upcoming Follow-ups</p>
                <p className="text-xs text-slate-400">Don&apos;t let these slip</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-400">
                <ClockIcon />
              </span>
            </div>
            <div className="space-y-3">
              {(view.upcoming || []).length === 0 && (
                <p className="py-2 text-sm text-slate-400">No upcoming follow-ups yet.</p>
              )}
              {(view.upcoming || []).map((task) => (
                <button key={task.id} type="button" onClick={() => navigate('/follow-ups')} className="flex w-full items-start gap-2 text-left">
                  <span className={cx('mt-0.5 text-sm', isOverdue(task) ? 'text-rose-500' : 'text-amber-500')}>△</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">{task.title}</span>
                    <span className="text-xs text-slate-400">{dueLabel(task.dueDate)} · {task.assigneeName}</span>
                  </span>
                  <PriorityPill value={task.priority} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5 xl:col-span-6">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">Pipeline Engagement</p>
                <p className="text-xs text-slate-400">New leads per month</p>
              </div>
              <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium">
                {['Monthly', 'Annually'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPeriod(item)}
                    className={cx('rounded-full px-3.5 py-1.5', period === item ? 'bg-[#10233f] text-white' : 'text-slate-500')}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <Bars series={series || []} />
          </section>

          <section className="card overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Lead Activity</p>
                <p className="text-xs text-slate-400">Recent lead movements</p>
              </div>
              <Expand />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(view.activity || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="border-t border-slate-100 py-8 text-center text-slate-400">
                        Add a lead and it will show up here.
                      </td>
                    </tr>
                  )}
                  {(view.activity || []).map((lead) => (
                    <tr key={lead.id} className="cursor-pointer border-t border-slate-100" onClick={() => navigate(`/leads?lead=${lead.id}`)}>
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} size="sm" />
                          <div>
                            <p className="font-medium text-slate-800">{lead.name}</p>
                            <p className="text-xs text-slate-400">{lead.company}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-500">{prettyDate(lead.updatedAt)}</td>
                      <td className="text-slate-500">{prettyTime(lead.updatedAt)}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageDot[lead.stage] }} />
                          {lead.stage}
                        </span>
                      </td>
                      <td className="text-right font-medium">{money(lead.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-5 xl:col-span-3">
          <section className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">Revenue Goal</p>
              <Expand />
            </div>
            <p className="mt-3 text-xs text-slate-400">Closed-won total</p>
            <p className="text-xs text-slate-400">Total Converted</p>
            <p className="mt-1 text-[32px] font-semibold tracking-tight">{money(view.totalWon)}</p>
            <Spark series={view.revenueSeries || []} />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => navigate('/leads?new=1')}>+ Add Lead</button>
              <button type="button" className="btn-ghost flex-1" onClick={() => navigate('/follow-ups?new=1')}>
                <ClockIcon /> Task
              </button>
            </div>
          </section>

          <section className="card">
            <p className="font-semibold text-slate-800">Leads by Source</p>
            <p className="text-xs text-slate-400">Where leads come from</p>
            <Donut sources={view.sources} total={view.leadCount} />
          </section>

          <section className="card">
            <p className="font-semibold text-slate-800">Top Open Deals</p>
            <p className="text-xs text-slate-400">Biggest active opportunities</p>
            <ol className="mt-3 space-y-3">
              {(view.topDeals || []).length === 0 && (
                <p className="py-2 text-sm text-slate-400">Open deals will show up here.</p>
              )}
              {(view.topDeals || []).map((lead, index) => (
                <li key={lead.id}>
                  <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => navigate(`/leads?lead=${lead.id}`)}>
                    <span className="w-4 text-xs text-slate-400">{index + 1}</span>
                    <Avatar name={lead.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{lead.name}</span>
                      <span className="block truncate text-xs text-slate-400">{lead.company}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold">{compact(lead.value)}</span>
                      <StagePill value={lead.stage} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
