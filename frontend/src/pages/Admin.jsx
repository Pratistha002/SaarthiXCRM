import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { prettyDate, prettyTime } from '../lib';
import { Avatar, Logo, RolePill } from '../ui';

function when(iso) {
  if (!iso) return 'Never signed in';
  return `${prettyDate(iso)} · ${prettyTime(iso)}`;
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('teams');

  useEffect(() => {
    if (!user?.platformAdmin) return undefined;
    api('/api/admin').then(setData).catch((err) => setError(err.message));
  }, [user]);

  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!user.platformAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f6fb] px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold">Admin access only</h1>
          <p className="mt-2 text-sm text-slate-500">This console is for the SaarthiX platform admin. Sign in with the admin account to see every team and who logged in.</p>
          <Link to="/dashboard" className="btn mt-6">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[74px] max-w-6xl items-center gap-4 px-4 md:px-6">
          <Link to="/" aria-label="Home"><Logo /></Link>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-wide text-white">ADMIN</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/dashboard" className="btn-ghost">Workspace</Link>
            <button type="button" className="btn-ghost" onClick={() => { logout(); window.location.assign('/'); }}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-blue-600">Platform console</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Teams and sign-ins</h1>
          <p className="mt-2 text-sm text-slate-500">Every workspace on SaarthiX CRM, and everyone who has logged in.</p>
        </div>

        {error && <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
        {!data && !error && <p className="py-16 text-center text-slate-400">Loading the directory…</p>}

        {data && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="card !p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Teams</p>
                <p className="mt-2 text-3xl font-semibold">{data.teamCount}</p>
              </div>
              <div className="card !p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">People</p>
                <p className="mt-2 text-3xl font-semibold">{data.userCount}</p>
              </div>
              <div className="card !p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Signed in today</p>
                <p className="mt-2 text-3xl font-semibold">{data.signedInToday}</p>
              </div>
            </div>

            <div className="mb-4 flex rounded-full bg-slate-100 p-1 text-sm font-medium">
              {[
                ['teams', 'All teams'],
                ['people', 'Who logged in'],
                ['sessions', 'Login history'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-full px-4 py-2 ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'teams' && (
              <div className="space-y-4">
                {data.teams.map((team) => (
                  <section key={team.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{team.name}</h2>
                        <p className="text-xs text-slate-400">Invite {team.inviteCode} · {team.memberCount} member{team.memberCount === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <ul className="mt-4 divide-y divide-slate-100">
                      {team.members.map((member) => (
                        <li key={member.id} className="flex items-center gap-3 py-3">
                          <Avatar name={member.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{member.name}</p>
                            <p className="truncate text-xs text-slate-400">{member.email}</p>
                          </div>
                          <RolePill value={member.role} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {tab === 'people' && (
              <section className="card overflow-hidden !p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Person</th>
                      <th className="px-5 py-3 font-medium">Team</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Last login</th>
                      <th className="px-5 py-3 text-right font-medium">Logins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((person) => (
                      <tr key={person.id} className="border-t border-slate-100">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={person.name} size="sm" />
                            <div>
                              <p className="font-medium">{person.name} {person.platformAdmin && <span className="ml-1 text-[10px] font-semibold text-blue-600">ADMIN</span>}</p>
                              <p className="text-xs text-slate-400">{person.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{person.team}</td>
                        <td className="px-5 py-3"><RolePill value={person.role} /></td>
                        <td className="px-5 py-3 text-slate-500">{when(person.lastLoginAt)}</td>
                        <td className="px-5 py-3 text-right font-medium">{person.loginCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {tab === 'sessions' && (
              <section className="card">
                {data.sessions.length === 0 && <p className="text-sm text-slate-400">No sign-ins recorded yet.</p>}
                <ul className="divide-y divide-slate-100">
                  {data.sessions.map((session) => (
                    <li key={session.id} className="flex items-center gap-3 py-3">
                      <Avatar name={session.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{session.name}</p>
                        <p className="truncate text-xs text-slate-400">{session.email} · {session.team}</p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-500">{when(session.at)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
