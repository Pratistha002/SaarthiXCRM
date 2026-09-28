import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { isPlatformAdmin } from '../lib';
import { Logo } from '../ui';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#team', label: 'Team' },
];

const FEATURES = [
  ['Visual pipeline', 'Drag deals across New, Qualified, Proposal, Won and Lost without losing the story.'],
  ['Lead activity', 'See every movement, owner and deal value in one activity table your team can act on.'],
  ['Follow-ups', 'Upcoming tasks sit on the dashboard so nothing slips past the next call.'],
  ['Shared team workspace', 'Invite teammates, assign owners, and keep one pipeline everyone can see.'],
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[74px] max-w-6xl items-center gap-6 px-4 md:px-6">
          <Link to="/" aria-label="SaarthiX CRM home"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                {isPlatformAdmin(user) && <Link to="/admin" className="btn-ghost">Admin</Link>}
                <Link to={isPlatformAdmin(user) ? '/admin' : '/dashboard'} className="btn">{isPlatformAdmin(user) ? 'Open console' : 'Open dashboard'}</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Log in</Link>
                <Link to="/register" className="btn">Sign up</Link>
                <Link to="/login?next=/admin" className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Admin</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="text-sm font-medium text-blue-600">SaarthiX CRM for sales teams</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.15]">
                Close more deals with a pipeline your team can actually run.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-500">
                One workspace for leads, contacts, notes and follow-ups — then a live dashboard that shows pipeline value, engagement and what to do next.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login" className="btn h-12 px-6">Log in</Link>
                <Link to="/register" className="btn-ghost h-12 px-6">Sign up</Link>
              </div>
            </div>
            <div className="rounded-[28px] bg-gradient-to-br from-[#4aa7ff] to-[#1d7be8] p-6 text-white shadow-[0_18px_40px_rgba(29,123,232,0.28)]">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>SaarthiX CRM</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] tracking-normal">LIVE</span>
              </div>
              <p className="mt-10 text-xs text-white/80">Pipeline value</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">Your book, your numbers</p>
              <p className="mt-4 text-sm text-white/80">Add a lead after you sign in and it shows up on the dashboard, pipeline and follow-ups.</p>
              <div className="mt-8 flex items-center justify-between text-[11px] tracking-[0.18em] text-white/80">
                <span>•••• PIPELINE</span>
                <span>TEAM READY</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Everything the sales floor needs</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">The same screens your team already uses — dashboard, leads, pipeline, contacts and follow-ups — in one shared workspace.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(([title, body]) => (
              <article key={title} className="card">
                <h3 className="font-semibold text-slate-800">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pipeline" className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <div className="card grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">A pipeline you can see at a glance</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Pipeline Goal, engagement and revenue sit on one dashboard. Move a deal and the numbers update — no sample data, only what your team puts in.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="rounded-2xl bg-slate-50 px-4 py-3">Pipeline Goal · total deal value</li>
              <li className="rounded-2xl bg-slate-50 px-4 py-3">Pipeline Engagement · new leads by month</li>
              <li className="rounded-2xl bg-slate-50 px-4 py-3">Revenue Goal · closed-won total</li>
            </ul>
          </div>
        </section>

        <section id="team" className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1c86e0] via-[#1674cb] to-[#0e5ea8] px-8 py-12 text-white md:px-12">
            <h2 className="text-3xl font-semibold tracking-tight">Ready for your sales team</h2>
            <p className="mt-3 max-w-xl text-sm text-white/85">
              Sign in to an existing workspace, or create one and invite the rest of the team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-blue-700">Log in</Link>
              <Link to="/register" className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-sm font-semibold text-white hover:bg-white/10">Sign up</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
