import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { dueLabel, isPlatformAdmin, money, prettyDate, prettyTime } from '../lib';
import { Avatar, Logo, RolePill, StagePill } from '../ui';

function when(iso) {
  if (!iso) return 'Never signed in';
  return `${prettyDate(iso)} · ${prettyTime(iso)}`;
}

function Stat({ label, value }) {
  return (
    <div className="card !p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Empty({ children }) {
  return <p className="px-1 py-4 text-sm text-slate-400">{children}</p>;
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('teams');
  const [openPerson, setOpenPerson] = useState('');
  const admin = isPlatformAdmin(user);

  useEffect(() => {
    if (!admin) return undefined;
    api('/api/admin').then(setData).catch((err) => setError(err.message));
  }, [admin]);

  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!admin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f6fb] px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold">Admin access only</h1>
          <p className="mt-2 text-sm text-slate-500">This console is for the SaarthiX platform admin. Sign in with the admin account to see every team and every record.</p>
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
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">All teams and user data</h1>
          <p className="mt-2 text-sm text-slate-500">Every workspace, every person, and the leads, contacts, follow-ups and notes they have added.</p>
        </div>

        {error && <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
        {!data && !error && <p className="py-16 text-center text-slate-400">Loading every team and record…</p>}

        {data && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Teams" value={data.teamCount} />
              <Stat label="People" value={data.userCount} />
              <Stat label="Leads" value={data.leadCount} />
              <Stat label="Pipeline" value={money(data.pipelineValue)} />
              <Stat label="Signed in today" value={data.signedInToday} />
            </div>

            <div className="mb-4 flex rounded-full bg-slate-100 p-1 text-sm font-medium">
              {[
                ['teams', 'All teams'],
                ['people', 'All users'],
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
              <div className="space-y-5">
                {data.teams.length === 0 && <section className="card"><Empty>No teams yet.</Empty></section>}
                {data.teams.map((team) => (
                  <section key={team.id} className="card space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{team.name}</h2>
                        <p className="text-xs text-slate-400">Invite {team.inviteCode} · {team.memberCount} member{team.memberCount === 1 ? '' : 's'}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{money(team.pipelineValue)} pipeline</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <MiniStat label="Members" value={team.memberCount} />
                      <MiniStat label="Leads" value={team.leadCount} />
                      <MiniStat label="Contacts" value={team.contactCount} />
                      <MiniStat label="Follow-ups" value={team.followUpCount} />
                      <MiniStat label="Notes" value={team.noteCount} />
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Members</h3>
                      {team.members.length === 0 && <Empty>No people on this team yet.</Empty>}
                      <ul className="mt-2 divide-y divide-slate-100">
                        {team.members.map((member) => (
                          <li key={member.id} className="flex items-center gap-3 py-3">
                            <Avatar name={member.name} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{member.name} {member.platformAdmin && <span className="ml-1 text-[10px] font-semibold text-blue-600">ADMIN</span>}</p>
                              <p className="truncate text-xs text-slate-400">{member.email} · {member.leadCount} leads · {member.contactCount} contacts · {member.followUpCount} follow-ups</p>
                            </div>
                            <p className="hidden text-xs font-medium text-slate-500 sm:block">{money(member.pipelineValue)}</p>
                            <RolePill value={member.role} />
                          </li>
                        ))}
                      </ul>
                    </div>

                    <RecordTable
                      title="Leads"
                      empty="No leads yet — they appear when this team adds them."
                      headers={['Name', 'Company', 'Owner', 'Stage', 'Value']}
                      rows={team.leads}
                      render={(lead) => (
                        <>
                          <td className="px-4 py-2.5 font-medium">{lead.name}</td>
                          <td className="px-4 py-2.5 text-slate-500">{lead.company || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{lead.ownerName || '—'}</td>
                          <td className="px-4 py-2.5"><StagePill value={lead.stage} /></td>
                          <td className="px-4 py-2.5 text-right font-medium">{money(lead.value)}</td>
                        </>
                      )}
                    />

                    <RecordTable
                      title="Contacts"
                      empty="No contacts yet."
                      headers={['Name', 'Company', 'Email', 'Phone']}
                      rows={team.contacts}
                      render={(contact) => (
                        <>
                          <td className="px-4 py-2.5 font-medium">{contact.name}</td>
                          <td className="px-4 py-2.5 text-slate-500">{contact.company || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{contact.email || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{contact.phone || '—'}</td>
                        </>
                      )}
                    />

                    <RecordTable
                      title="Follow-ups"
                      empty="No follow-ups yet."
                      headers={['Task', 'Lead', 'Assignee', 'Due', 'Status']}
                      rows={team.followUps}
                      render={(task) => (
                        <>
                          <td className="px-4 py-2.5 font-medium">{task.title}</td>
                          <td className="px-4 py-2.5 text-slate-500">{task.leadName || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{task.assigneeName || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{dueLabel(task.dueDate) || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{task.status || '—'}</td>
                        </>
                      )}
                    />

                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</h3>
                      {(!team.notes || team.notes.length === 0) && <Empty>No notes yet.</Empty>}
                      <ul className="mt-2 space-y-2">
                        {(team.notes || []).map((note) => (
                          <li key={note.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-sm text-slate-700">{note.body}</p>
                            <p className="mt-1 text-xs text-slate-400">{note.authorName}{note.linkedName ? ` · ${note.linkedName}` : ''}{note.createdAt ? ` · ${prettyDate(note.createdAt)}` : ''}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                      <th className="px-5 py-3 font-medium">Records</th>
                      <th className="px-5 py-3 font-medium">Last login</th>
                      <th className="px-5 py-3 text-right font-medium">Pipeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((person) => (
                      <Fragment key={person.id}>
                        <tr className="border-t border-slate-100">
                          <td className="px-5 py-3">
                            <button type="button" className="flex items-center gap-3 text-left" onClick={() => setOpenPerson((id) => (id === person.id ? '' : person.id))}>
                              <Avatar name={person.name} size="sm" />
                              <div>
                                <p className="font-medium">{person.name} {person.platformAdmin && <span className="ml-1 text-[10px] font-semibold text-blue-600">ADMIN</span>}</p>
                                <p className="text-xs text-slate-400">{person.email}</p>
                              </div>
                            </button>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{person.team}</td>
                          <td className="px-5 py-3 text-xs text-slate-500">{person.leadCount} leads · {person.contactCount} contacts · {person.followUpCount} follow-ups</td>
                          <td className="px-5 py-3 text-slate-500">{when(person.lastLoginAt)}</td>
                          <td className="px-5 py-3 text-right font-medium">{money(person.pipelineValue)}</td>
                        </tr>
                        {openPerson === person.id && (
                          <tr className="border-t border-slate-100 bg-slate-50/70">
                            <td colSpan={5} className="px-5 py-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Leads owned by {person.name}</p>
                              {person.leads?.length ? (
                                <ul className="space-y-1.5">
                                  {person.leads.map((lead) => (
                                    <li key={lead.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                                      <span>{lead.name}{lead.company ? ` · ${lead.company}` : ''}</span>
                                      <span className="flex items-center gap-2">
                                        <StagePill value={lead.stage} />
                                        <span className="font-medium">{money(lead.value)}</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <Empty>This person has not added any leads yet.</Empty>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {tab === 'sessions' && (
              <section className="card">
                {data.sessions.length === 0 && <Empty>No sign-ins recorded yet.</Empty>}
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

function RecordTable({ title, empty, headers, rows, render }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {(!rows || rows.length === 0) && <Empty>{empty}</Empty>}
      {rows?.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-2xl ring-1 ring-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {headers.map((header) => (
                  <th key={header} className={`px-4 py-2 font-medium ${header === 'Value' ? 'text-right' : ''}`}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  {render(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
