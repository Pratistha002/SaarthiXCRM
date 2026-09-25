import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ago, compact, cx, dueLabel, isOverdue, money, prettyDate, prettyTime, stageDot } from '../lib';
import { Avatar, PriorityPill, StagePill } from '../ui';

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
  const max = Math.max(...series.map((item) => item.count), 1);
  const mark = peak(series);
  return (
    <div className="mt-6 flex h-44 items-end gap-3">
      {series.map((item, index) => {
        const hot = index === mark.index && item.count > 0;
        return (
          <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex h-36 w-full items-end justify-center">
              {hot && (
                <span className="absolute -top-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  +{mark.changePct}%
                </span>
              )}
              <div
                className={cx('w-8 rounded-t-xl', hot ? 'bg-[#163a73]' : 'bg-sky-200')}
                style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{item.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function Spark({ series }) {
  const values = series.map((item) => item.value);
  const max = Math.max(...values, 1);
  const width = 240;
  const height = 72;
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => [index * step, height - 8 - (value / max) * (height - 16)]);
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point[0]},${point[1]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-16 w-full">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.4" />
    </svg>
  );
}

function Donut({ sources, total }) {
  const colors = ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#38bdf8', '#818cf8'];
  const sum = sources.reduce((acc, item) => acc + item.count, 0) || 1;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="mt-2 flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-36 w-36">
        {sources.map((item, index) => {
          const length = (item.count / sum) * circ;
          const node = (
            <circle
              key={item.name}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="14"
              strokeDasharray={`${length} ${circ - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 70 70)"
            />
          );
          offset += length;
          return node;
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-slate-900 text-[22px] font-semibold">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="fill-slate-400 text-[11px]">leads</text>
      </svg>
      <ul className="space-y-1.5 text-xs text-slate-600">
        {sources.map((item, index) => (
          <li key={item.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} />
            <span className="w-24">{item.name}</span>
            <span className="font-semibold text-slate-800">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('Monthly');
  const [welcome, setWelcome] = useState(Boolean(location.state?.welcome));
  const [insight, setInsight] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    const next = await api('/api/dashboard');
    setData(next);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!welcome) return undefined;
    const timer = setTimeout(() => setWelcome(false), 5000);
    return () => clearTimeout(timer);
  }, [welcome]);

  async function analyze() {
    setAnalyzing(true);
    try {
      const result = await api('/api/ai/pipeline', { method: 'POST' });
      setInsight(result.summary);
    } catch (err) {
      setInsight(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (error) return <div className="card text-sm text-rose-600">{error}</div>;
  if (!data) return <div className="py-20 text-center text-slate-400">Loading your workspace…</div>;

  if (data.leadCount === 0) {
    return (
      <div className="card mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold">Your pipeline is empty</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Nothing here yet. Add a lead and it will show up on the dashboard, pipeline, contacts, notes and follow-ups.</p>
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn" onClick={() => navigate('/leads?new=1')}>Add a lead</button>
        </div>
      </div>
    );
  }

  const series = period === 'Annually' ? data.annual : data.engagement;
  const first = user?.name?.split(' ')[0] || 'there';

  return (
    <div>
      {welcome && (
        <div className="mb-4 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] text-white">✓</span>
            Welcome back, {first}
            <button type="button" className="text-emerald-500" onClick={() => setWelcome(false)}>×</button>
          </div>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome Back, {first}</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">{data.rangeLabel}</span>
          <button type="button" className="btn" onClick={() => navigate('/leads?new=1')}>+ Add New Lead</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-3">
          <section className="card">
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span>Pipeline Goal</span>
              <span className="text-slate-300">↗</span>
            </div>
            <p className="text-xs text-slate-400">Total deal value</p>
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 p-4 text-white shadow-lg shadow-blue-200">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">SaarthiX CRM</span>
                <span className="opacity-80">))) </span>
              </div>
              <p className="mt-6 text-xs text-white/80">Pipeline value</p>
              <p className="text-3xl font-semibold tracking-tight">{money(data.pipelineValue)}</p>
              <div className="mt-4 flex items-center justify-between text-[11px] tracking-[0.18em] text-white/80">
                <span>•••• PIPELINE</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 tracking-normal">LIVE</span>
              </div>
            </div>
          </section>

          <section className="card">
            <p className="text-sm font-medium">Weighted forecast</p>
            <p className="mt-1 text-xs text-slate-400">New 15% · Qualified 40% · Proposal 70%</p>
            <p className="mt-2 text-3xl font-semibold">{compact(data.forecast)}</p>
            <p className="mt-1 text-xs text-slate-400">Not the sum of every open deal — a confidence-weighted number the team can plan against.</p>
          </section>

          <section className="card">
            <p className="text-sm text-slate-500">Weekly Revenue</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-semibold">{compact(data.weeklyRevenue)}</p>
              <span className={cx('text-sm font-medium', data.weeklyChangePct >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                {data.weeklyChangePct >= 0 ? '↗' : '↘'} {Math.abs(data.weeklyChangePct)}%
              </span>
            </div>
          </section>

          <section className="card">
            <div className="flex items-center gap-2 text-sm text-slate-500"><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100">◎</span> Conversion</div>
            <p className="mt-1 text-xs text-slate-400">Win rate</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-4xl font-semibold">{Math.round(data.conversionPct)}%</p>
              <span className={cx('mb-1 text-sm font-medium', data.conversionChangePct >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                {data.conversionChangePct >= 0 ? '↗' : '↘'} {Math.abs(data.conversionChangePct)}%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{data.leadCount} leads · {data.openTasks} open tasks</p>
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">Upcoming Follow-ups</p>
                <p className="text-xs text-slate-400">Don&apos;t let these slip</p>
              </div>
            </div>
            <div className="space-y-3">
              {data.upcoming.map((task) => (
                <button key={task.id} type="button" onClick={() => navigate('/follow-ups')} className="flex w-full gap-2 text-left">
                  <span className={cx('mt-0.5 text-sm', isOverdue(task) ? 'text-rose-500' : 'text-amber-500')}>△</span>
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{task.title}</span>
                    <span className="text-xs text-slate-400">{dueLabel(task.dueDate)} · {task.assigneeName}</span>
                  </span>
                  <PriorityPill value={task.priority} />
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">Top Contacts</p>
                <p className="text-xs text-slate-400">Your key relationships</p>
              </div>
              <button type="button" className="text-xs font-medium text-blue-600" onClick={() => navigate('/contacts')}>View all</button>
            </div>
            <div className="flex items-center gap-2">
              {data.topContacts.slice(0, 4).map((contact) => <Avatar key={contact.id} name={contact.name} size="sm" />)}
              {data.topContacts.length > 4 && <span className="text-xs font-medium text-slate-400">+{data.topContacts.length - 4}</span>}
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:col-span-6">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Pipeline Engagement</p>
                <p className="text-xs text-slate-400">New leads per month</p>
              </div>
              <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium">
                {['Monthly', 'Annually'].map((item) => (
                  <button key={item} type="button" onClick={() => setPeriod(item)} className={cx('rounded-full px-3 py-1.5', period === item ? 'bg-blue-600 text-white' : 'text-slate-500')}>{item}</button>
                ))}
              </div>
            </div>
            <Bars series={series || []} />
          </section>

          <section className="card overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">Lead Activity</p>
                <p className="text-xs text-slate-400">Recent lead movements</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.map((lead) => (
                    <tr key={lead.id} className="cursor-pointer border-t border-slate-100" onClick={() => navigate(`/leads?lead=${lead.id}`)}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} size="sm" />
                          <div>
                            <p className="font-medium">{lead.name}</p>
                            <p className="text-xs text-slate-400">{lead.company}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-500">{prettyDate(lead.updatedAt)}</td>
                      <td className="text-slate-500">{prettyTime(lead.updatedAt)}</td>
                      <td><span className="inline-flex items-center gap-1 text-xs"><span className="h-1.5 w-1.5 rounded-full" style={{ background: stageDot[lead.stage] }} />{lead.stage}</span></td>
                      <td className="text-right font-medium">{money(lead.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="mb-4">
              <p className="font-semibold">Pipeline by Stage</p>
              <p className="text-xs text-slate-400">Deal value across each stage</p>
            </div>
            <div className="space-y-3">
              {data.stages.map((stage) => (
                <div key={stage.stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: stageDot[stage.stage] }} />{stage.stage} · {stage.count}</span>
                    <span className="text-slate-500">{compact(stage.value)} <span className="text-slate-400">{stage.pct}%</span></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${stage.pct}%`, background: stageDot[stage.stage] }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <p className="font-semibold">Win and loss reasons</p>
            <p className="text-xs text-slate-400">Why the conversion rate moved</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sky-600">Won</p>
                {Object.entries(data.wonReasons || {}).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-sm">
                    <span>{reason}</span><span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-rose-500">Lost</p>
                {Object.entries(data.lostReasons || {}).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-sm">
                    <span>{reason}</span><span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:col-span-3">
          <section className="card">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Revenue Goal</span>
              <span className="text-slate-300">↗</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">Closed-won total</p>
            <p className="text-xs text-slate-400">Total Won</p>
            <p className="text-3xl font-semibold">{money(data.totalWon)}</p>
            <Spark series={data.revenueSeries || []} />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => navigate('/leads?new=1')}>+ Add Lead</button>
              <button type="button" className="btn-ghost flex-1" onClick={() => navigate('/follow-ups?new=1')}>Task</button>
            </div>
          </section>

          <section className="card">
            <p className="font-semibold">AI Sales Insights</p>
            <p className="text-xs text-slate-400">Powered by your pipeline</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {insight || 'Get an instant, data-driven read on your pipeline health and what to do next.'}
            </p>
            <button type="button" className="btn mt-4 w-full" onClick={analyze} disabled={analyzing}>
              {analyzing ? 'Analyzing…' : '✦ Analyze pipeline'}
            </button>
          </section>

          <section className="card">
            <p className="font-semibold">Leads by Source</p>
            <p className="text-xs text-slate-400">Where leads come from</p>
            <Donut sources={data.sources} total={data.leadCount} />
          </section>

          <section className="card">
            <p className="font-semibold">Top Open Deals</p>
            <p className="text-xs text-slate-400">Biggest active opportunities</p>
            <ol className="mt-3 space-y-3">
              {data.topDeals.map((lead, index) => (
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
      <p className="sr-only">{ago(new Date().toISOString())}</p>
    </div>
  );
}
