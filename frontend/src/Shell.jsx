import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';
import { ago, cx, isHeadOfSales, isPlatformAdmin } from './lib';
import { Field, Logo, Modal, RolePicker } from './ui';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/follow-ups', label: 'Follow-ups' },
  { to: '/notes', label: 'Notes' },
];

function Icon({ name }) {
  const common = { viewBox: '0 0 24 24', className: 'h-[18px] w-[18px]', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="M20 20l-3.5-3.5" /></svg>;
  if (name === 'menu') return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" /></svg>;
  if (name === 'bell') return <svg {...common}><path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 7H4s2 0 2-7" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>;
  if (name === 'dash') return <svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'leads') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M4 19c.6-3 2.6-4.5 5-4.5S13.4 16 14 19" /><path d="M16 8h4M18 6v4" /></svg>;
  if (name === 'pipe') return <svg {...common}><path d="M4 7h16M4 12h10M4 17h13" /></svg>;
  if (name === 'people') return <svg {...common}><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2" /><path d="M3.5 19c.7-3 2.8-4.5 5.5-4.5s4.8 1.5 5.5 4.5M15 14.5c1.8.2 3.2 1.3 3.8 3.5" /></svg>;
  if (name === 'note') return <svg {...common}><path d="M7 4h8l4 4v12H7z" /><path d="M15 4v4h4M9 13h6M9 17h4" /></svg>;
  return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
}

const RAIL = [
  { to: '/dashboard', icon: 'dash', label: 'Dashboard' },
  { to: '/leads', icon: 'leads', label: 'Leads' },
  { to: '/pipeline', icon: 'pipe', label: 'Pipeline' },
  { to: '/contacts', icon: 'people', label: 'Contacts' },
  { to: '/follow-ups', icon: 'task', label: 'Follow-ups' },
  { to: '/notes', icon: 'note', label: 'Notes' },
];

export default function Shell({ children }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    company: user?.company || '',
    title: user?.title || '',
    role: isHeadOfSales(user?.role) ? 'HEAD_OF_SALES' : 'SALES_EXECUTIVE',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/notifications').then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setHits(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(query.trim())}`).then(setHits).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searchOpen]);

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
    <div className="min-h-screen bg-[#f3f6fb]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center border-r border-slate-200/80 bg-white py-4 lg:flex">
        <div className="mb-6 h-9 w-9" />
        <div className="flex flex-1 flex-col items-center gap-2">
          {RAIL.map((item) => (
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
        <header className="sticky top-0 z-20 flex h-[74px] items-center gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-6">
          <Logo />
          <nav className="ml-2 hidden items-center gap-1 xl:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cx(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition',
                  isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700',
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 sm:inline-flex">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] text-white">✓</span>
              Welcome back, {user?.name?.split(' ')[0] || 'there'}
            </div>
            <div className="relative">
              <button
                type="button"
                className="relative grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                onClick={() => { setNotificationsOpen((open) => !open); setMenuOpen(false); setSearchOpen(false); }}
                aria-label="Notifications"
                title="Notifications"
              >
                <Icon name="bell" />
                {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 w-[340px] rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-200">
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
            <div className="relative">
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => { setMenuOpen((open) => !open); setSearchOpen(false); setNotificationsOpen(false); }} aria-label="Menu">
                <Icon name="menu" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200">
                  <p className="px-3 pt-2 text-sm font-semibold">{user?.name}</p>
                  <p className="px-3 text-xs text-slate-500">{user?.email}</p>
                  <div className="mt-2 space-y-1">
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}>Search</button>
                    {isPlatformAdmin(user) && (
                      <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/admin'); }}>Admin console</button>
                    )}
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/team'); }}>Team</button>
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => {
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
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
                  </div>
                </div>
              )}
              {searchOpen && (
                <div className="absolute right-0 top-12 w-[340px] rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-200">
                  <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, contacts, notes" className="field" />
                  {hits && (
                    <div className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
                      {hits.leads?.map((lead) => (
                        <button key={lead.id} type="button" className="block w-full rounded-xl px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setSearchOpen(false); navigate(`/leads?lead=${lead.id}`); }}>
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-xs text-slate-500">{lead.company} · Lead</div>
                        </button>
                      ))}
                      {hits.contacts?.map((contact) => (
                        <button key={contact.id} type="button" className="block w-full rounded-xl px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setSearchOpen(false); navigate('/contacts'); }}>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-xs text-slate-500">{contact.company} · Contact</div>
                        </button>
                      ))}
                      {hits.notes?.map((note) => (
                        <button key={note.id} type="button" className="block w-full rounded-xl px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setSearchOpen(false); navigate('/notes'); }}>
                          <div className="line-clamp-2">{note.body}</div>
                          <div className="text-xs text-slate-500">Note</div>
                        </button>
                      ))}
                      {!hits.leads?.length && !hits.contacts?.length && !hits.notes?.length && (
                        <p className="px-2 py-3 text-slate-400">No matches</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex gap-2 overflow-auto border-b border-slate-200/70 bg-white px-4 py-2 xl:hidden">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => cx('whitespace-nowrap rounded-full px-3 py-1.5 text-sm', isActive ? 'bg-slate-900 text-white' : 'text-slate-500')}>
              {item.label}
            </NavLink>
          ))}
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
