import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';
import { ago, cx, isHeadOfSales, isPlatformAdmin } from './lib';
import { useTheme } from './theme';
import { Avatar, Field, Logo, Modal, RolePicker } from './ui';

const NAV = [
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/sales', label: 'Sales & Forecast' },
  { to: '/contacts', label: 'Contacts' },
  {
    label: 'Activities',
    children: [
      { to: '/notes', label: 'Notes', hint: 'Lead notes in one thread' },
      { to: '/calendar', label: 'Calendar', hint: 'Calls, demos, visits and tasks' },
      { to: '/follow-ups', label: 'Follow-ups', hint: 'Tasks and next actions' },
      { to: '/meeting-logs', label: 'Meeting logs', hint: 'What was discussed and next steps' },
    ],
  },
];

function Icon({ name }) {
  const common = { viewBox: '0 0 24 24', className: 'h-[18px] w-[18px]', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="M20 20l-3.5-3.5" /></svg>;
  if (name === 'menu') return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" /></svg>;
  if (name === 'bell') return <svg {...common}><path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 7H4s2 0 2-7" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>;
  if (name === 'dash') return <svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'leads') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M4 19c.6-3 2.6-4.5 5-4.5S13.4 16 14 19" /><path d="M16 8h4M18 6v4" /></svg>;
  if (name === 'chart') return <svg {...common}><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" strokeLinecap="round" /></svg>;
  if (name === 'pipe') return <svg {...common}><path d="M4 7h16M4 12h10M4 17h13" /></svg>;
  if (name === 'people') return <svg {...common}><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2" /><path d="M3.5 19c.7-3 2.8-4.5 5.5-4.5s4.8 1.5 5.5 4.5M15 14.5c1.8.2 3.2 1.3 3.8 3.5" /></svg>;
  if (name === 'note') return <svg {...common}><path d="M7 4h8l4 4v12H7z" /><path d="M15 4v4h4M9 13h6M9 17h4" /></svg>;
  if (name === 'task') return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" /></svg>;
  if (name === 'cal') return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
  if (name === 'log') return <svg {...common}><path d="M7 4h10v16H7z" /><path d="M10 8h4M10 12h4M10 16h3" /></svg>;
  if (name === 'activity') return <svg {...common}><path d="M4 7h16M4 12h10M4 17h13" /><circle cx="18" cy="12" r="2" /></svg>;
  return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
}

const RAIL = [
  { to: '/dashboard', icon: 'dash', label: 'Dashboard' },
  { to: '/leads', icon: 'leads', label: 'Leads' },
  { to: '/pipeline', icon: 'pipe', label: 'Pipeline' },
  { to: '/sales', icon: 'chart', label: 'Sales & Forecast' },
  { to: '/contacts', icon: 'people', label: 'Contacts' },
  {
    icon: 'activity',
    label: 'Activities',
    children: [
      { to: '/notes', icon: 'note', label: 'Notes' },
      { to: '/calendar', icon: 'cal', label: 'Calendar' },
      { to: '/follow-ups', icon: 'task', label: 'Follow-ups' },
      { to: '/meeting-logs', icon: 'log', label: 'Meeting logs' },
    ],
  },
];

function activityActive(pathname, children) {
  return children.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}

function ActivitiesMenu({ item, compact }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const active = activityActive(location.pathname, item.children);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cx(
          compact ? 'whitespace-nowrap rounded-full px-3 py-1.5 text-sm' : 'rounded-full px-3 py-2 text-sm font-medium transition',
          compact
            ? (active || open ? 'bg-slate-900 text-white' : 'text-slate-500')
            : (active || open ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'),
        )}
      >
        {item.label}
        <span className="ml-1 text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className={cx('absolute z-50 mt-2 w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700', compact ? 'left-0' : 'left-0')}>
            {item.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cx('block rounded-xl px-3 py-2 hover:bg-slate-50', isActive && 'bg-blue-50')}
              >
                <p className="text-sm font-medium text-slate-800">{child.label}</p>
                {child.hint && <p className="text-xs text-slate-400">{child.hint}</p>}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DashboardButton({ compact }) {
  return (
    <NavLink
      to="/dashboard"
      className={({ isActive }) => cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition',
        compact ? 'whitespace-nowrap px-3 py-1.5 text-sm' : 'px-3.5 py-2 text-sm',
        isActive
          ? 'bg-teal-600 text-white shadow-sm shadow-teal-200 dark:shadow-none'
          : 'bg-teal-50 text-teal-800 ring-1 ring-teal-200 hover:bg-teal-600 hover:text-white dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800 dark:hover:bg-teal-600 dark:hover:text-white',
      )}
    >
      <Icon name="dash" />
      Dashboard
    </NavLink>
  );
}

export default function Shell({ children }) {
  const { user, logout, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [railOpen, setRailOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const knownNotificationIds = useRef(null);
  const audioRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    company: user?.company || '',
    title: user?.title || '',
    role: isHeadOfSales(user?.role) ? 'HEAD_OF_SALES' : 'SALES_EXECUTIVE',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = audioRef.current || (audioRef.current = new Ctx());
        if (ctx.state === 'suspended') ctx.resume();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications(playSound) {
      try {
        const rows = await api('/api/notifications');
        if (cancelled) return;
        const incoming = Array.isArray(rows) ? rows : [];
        const nextIds = new Set(incoming.map((item) => item.id));
        if (playSound && knownNotificationIds.current) {
          const fresh = incoming.filter((item) => !item.read && !knownNotificationIds.current.has(item.id));
          if (fresh.length) playNotificationChime(audioRef);
        }
        knownNotificationIds.current = nextIds;
        setNotifications(incoming);
      } catch {
        /* keep the last list */
      }
    }

    loadNotifications(false);
    const timer = setInterval(() => loadNotifications(true), 12000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(query.trim())}`).then(setHits).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const unread = notifications.filter((item) => !item.read).length;

  async function markAll() {
    await api('/api/notifications/read-all', { method: 'POST' });
    setNotifications((rows) => rows.map((row) => ({ ...row, read: true })));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    try {
      const next = await api('/api/auth/me', { method: 'PATCH', body: profile });
      updateUser(next);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] dark:bg-slate-950">
      <header className="sticky top-0 z-40 flex h-[74px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:px-4">
        <Logo />
        <nav className="hidden shrink-0 items-center gap-0.5 lg:flex">
          {NAV.map((item) => item.children ? (
            <ActivitiesMenu key={item.label} item={item} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cx(
                'rounded-full px-3 py-2 text-sm font-medium transition',
                isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700',
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="relative mx-2 min-w-0 max-w-md flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search leads, contacts, notes"
            className="pill-input !py-2.5"
            aria-label="Search leads, contacts and notes"
          />
          {query && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-700"
              onClick={() => { setQuery(''); setHits(null); }}
            >
              Clear
            </button>
          )}
          {hits && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-80 overflow-auto rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              {hits.leads?.map((lead) => (
                <button key={lead.id} type="button" className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setQuery(''); setHits(null); navigate(`/leads?lead=${lead.id}`); }}>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-xs text-slate-500">{lead.company} · Lead</div>
                </button>
              ))}
              {hits.contacts?.map((contact) => (
                <button key={contact.id} type="button" className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setQuery(''); setHits(null); navigate('/contacts'); }}>
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-xs text-slate-500">{contact.company} · Contact</div>
                </button>
              ))}
              {hits.notes?.map((note) => (
                <button key={note.id} type="button" className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setQuery(''); setHits(null); navigate('/notes'); }}>
                  <div className="line-clamp-2">{note.body}</div>
                  <div className="text-xs text-slate-500">Note</div>
                </button>
              ))}
              {!hits.leads?.length && !hits.contacts?.length && !hits.notes?.length && (
                <p className="px-3 py-3 text-sm text-slate-400">No matches</p>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="relative order-1">
            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
              onClick={() => { setNotificationsOpen((open) => !open); setMenuOpen(false); }}
              aria-label="Notifications"
              title="Notifications"
            >
              <Icon name="bell" />
              {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-12 w-[340px] rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold">Notifications</p>
                  <button type="button" className="text-xs font-medium text-blue-600" onClick={markAll}>Mark all read</button>
                </div>
                <div className="max-h-80 space-y-1 overflow-auto">
                  {notifications.length === 0 && <p className="px-2 py-4 text-sm text-slate-400">You are all caught up.</p>}
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cx('w-full rounded-xl px-3 py-2 text-left', item.read ? '' : 'bg-blue-50/70')}
                      onClick={() => { setNotificationsOpen(false); if (item.link) navigate(item.link); }}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{ago(item.createdAt)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative order-3">
            <button
              type="button"
              title={user?.name || 'Account'}
              aria-label="Account"
              className="relative grid h-10 w-10 place-items-center rounded-full ring-2 ring-slate-100 dark:ring-slate-700"
              onClick={() => { setMenuOpen((open) => !open); setNotificationsOpen(false); setAppearanceOpen(false); }}
            >
              <Avatar name={user?.name || 'Account'} />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <p className="px-3 pt-2 text-sm font-semibold">{user?.name}</p>
                <p className="px-3 text-xs text-slate-500">{user?.email}</p>
                <div className="mt-2 space-y-1">
                  {isPlatformAdmin(user) && (
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); navigate('/admin'); }}>Admin console</button>
                  )}
                  <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); navigate('/team'); }}>Team</button>
                  <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => {
                    setMenuOpen(false);
                    setError('');
                    setProfile({
                      name: user?.name || '',
                      company: user?.company || '',
                      title: user?.title || '',
                      role: isHeadOfSales(user?.role) ? 'HEAD_OF_SALES' : 'SALES_EXECUTIVE',
                    });
                    setEditing(true);
                  }}>Edit profile</button>
                  <div className="relative">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => setAppearanceOpen((open) => !open)}
                    >
                      Appearance
                      <span className="text-xs text-slate-400">{theme === 'dark' ? 'Dark' : 'Light'} ▾</span>
                    </button>
                    {appearanceOpen && (
                      <div className="mx-2 mb-1 overflow-hidden rounded-xl bg-slate-50 py-1 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        {[
                          ['light', 'Light', SunGlyph],
                          ['dark', 'Dark', MoonGlyph],
                        ].map(([value, label, Glyph]) => (
                          <button
                            key={value}
                            type="button"
                            className={cx(
                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                              theme === value
                                ? 'bg-white font-medium text-slate-900 dark:bg-slate-700 dark:text-white'
                                : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700',
                            )}
                            onClick={() => { setTheme(value); setAppearanceOpen(false); }}
                          >
                            <Glyph />
                            {label}
                            {theme === value && <span className="ml-auto text-xs text-teal-600">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
                </div>
              </div>
              )}
          </div>
          <div className="order-2">
            <DashboardButton />
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-[74px] z-30 hidden w-[72px] flex-col items-center border-r border-slate-200/80 bg-white py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex flex-1 flex-col items-center gap-2">
          {RAIL.map((item) => item.children ? (
            <div key={item.label} className="relative">
              <button
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => setRailOpen((open) => !open)}
                className={cx(
                  'grid h-11 w-11 place-items-center rounded-2xl text-slate-400 transition',
                  activityActive(location.pathname, item.children) || railOpen
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'hover:bg-slate-100 hover:text-slate-700',
                )}
              >
                <Icon name={item.icon} />
              </button>
              {railOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close activities" onClick={() => setRailOpen(false)} />
                  <div className="absolute left-14 top-0 z-50 w-56 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={() => setRailOpen(false)}
                        className={({ isActive }) => cx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-50', isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700')}
                      >
                        <Icon name={child.icon} />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) => cx(
                'grid h-11 w-11 place-items-center rounded-2xl text-slate-400 transition',
                isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              <Icon name={item.icon} />
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="lg:pl-[72px]">
        <div className="flex gap-2 overflow-auto border-b border-slate-200/70 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          {NAV.map((item) => item.children ? (
            <ActivitiesMenu key={item.label} item={item} compact />
          ) : (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => cx('whitespace-nowrap rounded-full px-3 py-1.5 text-sm', isActive ? 'bg-slate-900 text-white' : 'text-slate-500')}>
              {item.label}
            </NavLink>
          ))}
          <div className="ml-auto">
            <DashboardButton compact />
          </div>
        </div>
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>

      {editing && (
        <Modal title="Your profile" subtitle="Choose whether you are Head of Sales or a Sales Executive." onClose={() => setEditing(false)}>
          <form className="space-y-4" onSubmit={saveProfile}>
            <Field label="Name"><input className="field" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
            <Field label="Company"><input className="field" value={profile.company} onChange={(event) => setProfile({ ...profile, company: event.target.value })} /></Field>
            <Field label="Title"><input className="field" value={profile.title || ''} onChange={(event) => setProfile({ ...profile, title: event.target.value })} /></Field>
            <Field label="Role" hint="Head of Sales can add and remove teammates. Sales executives cannot.">
              <RolePicker value={isHeadOfSales(profile.role) ? 'HEAD_OF_SALES' : 'SALES_EXECUTIVE'} onChange={(role) => setProfile({ ...profile, role })} />
            </Field>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn" type="submit">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function playNotificationChime(audioRef) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = audioRef.current || (audioRef.current = new Ctx());
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const ping = (frequency, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.14, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    };
    ping(880, 0, 0.16);
    ping(1174, 0.12, 0.22);
  } catch {
    /* ignore autoplay limits */
  }
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 4.5A7.5 7.5 0 1 0 19.5 14 6 6 0 0 1 16 4.5z" strokeLinejoin="round" />
    </svg>
  );
}
