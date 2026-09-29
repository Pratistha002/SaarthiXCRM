import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import {
  EXIT_STAGES, FUNNEL_STAGES, PRIORITIES, ago, canSeeTeamData, closeReasons, cx, dueLabel, followUpStatusLabel, isAwaitingApproval, isExitStage, isOverdue, isoDay, money, prettyDate, prettyTime,
  primaryPhone,
} from '../lib';
import { Banner, Field, Modal, Spinner } from '../ui';
import CallModal from './CallModal';
import ConvertLeadModal from './ConvertLeadModal';
import LeadForm from './LeadForm';

const RELATED = [
  ['notes', 'Notes'],
  ['connected', 'Connected Records'],
  ['attachments', 'Attachments'],
  ['open', 'Open Activities'],
  ['closed', 'Closed Activities'],
  ['emails', 'Emails'],
];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { members } = useTeam();
  const [data, setData] = useState(null);
  const [ids, setIds] = useState(location.state?.ids || null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [notice, setNotice] = useState('');
  const [closing, setClosing] = useState(null);
  const [menu, setMenu] = useState(false);
  const [sidebar, setSidebar] = useState(true);

  async function load() {
    try {
      setData(await api(`/api/leads/${id}/related`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setData(null);
    setEditing(false);
    setCallOpen(false);
    setNotice('');
    setTab('overview');
    load();
  }, [id]);

  useEffect(() => {
    if (ids) return;
    api('/api/leads').then((pack) => setIds(pack.leads.map((lead) => lead.id))).catch(() => {});
  }, [ids]);

  if (error && !data) {
    return (
      <div className="card text-center">
        <p className="text-sm text-rose-600">{error}</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => navigate('/leads')}>Back to leads</button>
      </div>
    );
  }
  if (!data) return <p className="py-20 text-center text-sm text-slate-400">Loading lead…</p>;

  const lead = data.lead;

  if (editing) {
    return (
      <LeadForm
        lead={lead}
        members={members}
        user={user}
        onCancel={() => setEditing(false)}
        onSaved={async () => { setEditing(false); await load(); }}
      />
    );
  }

  const index = ids ? ids.indexOf(id) : -1;
  const prevId = index > 0 ? ids[index - 1] : null;
  const nextId = index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;
  const go = (target) => navigate(`/leads/${target}`, { state: { ids } });

  async function moveStage(stage, closeReason = '', closeNote = '') {
    if (isExitStage(stage) && !closeReason) {
      setClosing(stage);
      return;
    }
    if (stage === 'Converted' && !lead.convertedContactId) {
      await convert();
      return;
    }
    try {
      await api(`/api/leads/${id}/stage`, { method: 'PATCH', body: { stage, closeReason, closeNote } });
      setClosing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function convert() {
    if (lead.convertedDealId) return;
    setConverting(true);
  }

  async function converted(result) {
    setConverting(false);
    setNotice(result.deal
      ? `Converted. ${result.deal.name} is now in the Sales Pipeline under Qualified.`
      : `Converted. ${result.contact?.name} is now a contact at ${result.account?.name}.`);
    await load();
  }

  async function remove() {
    setMenu(false);
    if (!window.confirm('Delete this lead?')) return;
    await api(`/api/leads/${id}`, { method: 'DELETE' });
    navigate('/leads');
  }

  async function callSaved(result) {
    setCallOpen(false);
    const call = result.activity?.call || {};
    const next = call.nextActionAt ? ` Next: ${call.nextAction} on ${prettyDate(call.nextActionAt)}, ${prettyTime(call.nextActionAt)}.` : '';
    setNotice(`Call logged (${call.outcome}). Lead status: ${result.lead?.stage || lead.stage}.${next}`);
    await load();
  }

  function jump(key) {
    setTab('overview');
    setTimeout(() => document.getElementById(`related-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const counts = {
    notes: data.notes.length,
    connected: data.contact ? 1 : 0,
    attachments: data.attachments.length,
    open: data.openActivities.length,
    closed: data.closedActivities.length + (data.calls?.length || 0),
    emails: data.emails.length,
  };

  return (
    <div className="-mx-2">
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-xl text-slate-600 hover:bg-slate-100" onClick={() => navigate('/leads')} aria-label="Back">←</button>
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-slate-200 text-lg font-semibold text-slate-600">{(lead.name || '?')[0].toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">
            {lead.name}
            {lead.company && lead.company !== lead.name && <span className="text-base font-normal text-slate-500"> - {lead.company}</span>}
          </h1>
          <Tags lead={lead} onChange={load} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn !rounded-lg !py-2" onClick={() => setCallOpen({ number: primaryPhone(lead) })}>📞 Call</button>
          <button type="button" className="btn-ghost !rounded-lg !py-2" disabled title="WhatsApp is coming soon">💬 WhatsApp</button>
          <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={() => setEmailOpen(true)}>✉ Send Email</button>
          {lead.convertedDealId ? (
            <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={() => navigate(`/deals/${lead.convertedDealId}`)}>Open Deal</button>
          ) : (
            <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={convert}>
              {lead.convertedContactId ? 'Create Deal' : 'Convert'}
            </button>
          )}
          <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={() => setEditing(true)}>Edit</button>
          <div className="relative">
            <button type="button" className="btn-ghost !rounded-lg !px-3 !py-2" onClick={() => setMenu(!menu)} aria-label="More">•••</button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); window.print(); }}>Print</button>
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={remove}>Delete</button>
              </div>
            )}
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={!prevId} onClick={() => go(prevId)} aria-label="Previous lead">‹</button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={!nextId} onClick={() => go(nextId)} aria-label="Next lead">›</button>
        </div>
      </div>

      {error && <div className="mb-3"><Banner tone="danger">{error}</Banner></div>}
      {notice && (
        <div className="mb-3">
          <Banner tone="good">
            <span className="flex items-start justify-between gap-3">
              {notice}
              <button type="button" className="text-emerald-700/70 hover:text-emerald-800" onClick={() => setNotice('')} aria-label="Dismiss">×</button>
            </span>
          </Banner>
        </div>
      )}

      <div className="flex gap-4">
        {sidebar && (
          <aside className="hidden w-52 shrink-0 md:block">
            <div className="sticky top-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
              <p className="mb-2 text-sm font-semibold text-slate-800">Related List</p>
              <ul className="space-y-0.5">
                {RELATED.map(([key, label]) => (
                  <li key={key}>
                    <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50" onClick={() => jump(key)}>
                      {label}
                      {counts[key] > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{counts[key]}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" className="hidden h-9 w-9 place-items-center rounded-full bg-slate-200 text-slate-600 md:grid" onClick={() => setSidebar(!sidebar)} aria-label="Toggle related list">▯</button>
              <div className="flex rounded-full bg-white p-1 ring-1 ring-slate-200">
                {[['overview', 'Overview'], ['timeline', 'Timeline']].map(([key, label]) => (
                  <button key={key} type="button" className={cx('rounded-full px-5 py-1.5 text-sm', tab === key ? 'bg-slate-100 font-semibold text-slate-900 ring-1 ring-slate-300' : 'text-slate-600')} onClick={() => setTab(key)}>{label}</button>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-500">◷ Last Update : {prettyTime(lead.updatedAt)} · {prettyDate(lead.updatedAt)}</p>
          </div>

          <StageBar stage={lead.stage} onMove={moveStage} />

          {tab === 'overview' ? (
            <>
              <OverviewCard lead={lead} onEmail={() => setEmailOpen(true)} onCall={(number) => setCallOpen({ number })} />
              <NotesSection lead={lead} notes={data.notes} onChange={load} />
              <ConnectedSection lead={lead} contact={data.contact} account={data.account} deal={data.deal} onConvert={convert} />
              <AttachmentsSection lead={lead} files={data.attachments} onChange={load} />
              <ActivitiesSection lead={lead} open={data.openActivities} closed={data.closedActivities} calls={data.calls || []} members={members} user={user} onChange={load} />
              <EmailsSection emails={data.emails} onCompose={() => setEmailOpen(true)} />
            </>
          ) : (
            <TimelineTab data={data} onChange={load} />
          )}
        </div>
      </div>

      {emailOpen && <SendEmailModal lead={lead} onClose={() => setEmailOpen(false)} onSent={load} />}
      {converting && (
        <ConvertLeadModal lead={lead} contact={data.contact} members={members} onClose={() => setConverting(false)} onConverted={converted} />
      )}
      {callOpen && (
        <CallModal
          lead={lead}
          phone={callOpen.number}
          onClose={() => setCallOpen(false)}
          onSaved={callSaved}
          onEditLead={() => { setCallOpen(false); setEditing(true); }}
        />
      )}
      {closing && <CloseModal stage={closing} onClose={() => setClosing(null)} onSubmit={(reason, note) => moveStage(closing, reason, note)} />}
    </div>
  );
}

function Tags({ lead, onChange }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const tags = lead.tags || [];

  async function save(next) {
    await api(`/api/leads/${lead.id}/tags`, { method: 'PUT', body: { tags: next } });
    await onChange();
  }

  async function add(event) {
    event.preventDefault();
    const tag = value.trim();
    setValue('');
    setAdding(false);
    if (tag && !tags.includes(tag)) await save([...tags, tag]);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
          {tag}
          <button type="button" className="text-blue-400 hover:text-blue-700" onClick={() => save(tags.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}>×</button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={add}>
          <input autoFocus className="rounded-md border border-slate-300 px-2 py-0.5 text-xs outline-none focus:border-blue-500" value={value} onChange={(event) => setValue(event.target.value)} onBlur={add} placeholder="Tag name" />
        </form>
      ) : (
        <button type="button" className="text-slate-600 hover:text-blue-600" onClick={() => setAdding(true)}>🏷 Add Tags</button>
      )}
    </div>
  );
}

function StageBar({ stage, onMove }) {
  const [exitOpen, setExitOpen] = useState(false);
  const current = FUNNEL_STAGES.indexOf(stage);
  const exited = isExitStage(stage);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
      <div className={cx('flex flex-1 overflow-x-auto', exited && 'opacity-50')}>
        {FUNNEL_STAGES.map((step, i) => {
          const active = step === stage;
          const done = current >= 0 && i < current;
          const converted = step === 'Converted';
          return (
            <button
              key={step}
              type="button"
              onClick={() => !active && onMove(step)}
              className={cx(
                'relative -ml-2 min-w-[120px] flex-1 whitespace-nowrap px-6 py-2 text-sm first:ml-0 transition',
                active && converted ? 'bg-emerald-100 font-medium text-emerald-700'
                  : active ? 'bg-blue-100 font-medium text-blue-700'
                    : done ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
              )}
              style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)' }}
            >
              {step}
            </button>
          );
        })}
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setExitOpen(!exitOpen)}
          className={cx('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm', exited ? 'border-rose-300 bg-rose-50 font-medium text-rose-600' : 'border-slate-200 text-rose-500 hover:bg-rose-50')}
          title="Close this lead without converting"
        >
          👎 {exited ? stage : ''} <span className="text-xs">▾</span>
        </button>
        {exitOpen && (
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Exit states</p>
            {EXIT_STAGES.map((item) => (
              <button
                key={item}
                type="button"
                disabled={item === stage}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 disabled:text-slate-300 disabled:hover:bg-transparent"
                onClick={() => { setExitOpen(false); onMove(item); }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function detailRows(lead) {
  const type = lead.leadType;
  const rows = [['Lead Type', type || '—']];
  if (type === 'Student') {
    rows.push(['First Name', lead.firstName], ['Last Name', lead.lastName], ['College Name', lead.collegeName], ['Course', lead.course], ['Branch', lead.branch]);
  } else if (type === 'Institute') {
    rows.push(['Institute Name', lead.company], ['Contact Person', lead.contactPerson], ['Website', lead.website], ['Rating', lead.rating]);
  } else if (type === 'Industry') {
    rows.push(
      ['Company Name', lead.company], ['Contact Person', lead.contactPerson], ['Fax', lead.fax], ['Website', lead.website],
      ['No. of Employees', lead.employees], ['Annual Revenue', lead.annualRevenue != null ? money(lead.annualRevenue) : ''], ['Rating', lead.rating],
    );
  } else {
    rows.push(['Name', lead.name], ['Company', lead.company]);
  }
  rows.push(
    ['Lead Source', lead.source], ['Deal Value', money(lead.value)], ['Priority', lead.priority],
    ['Created', `${prettyDate(lead.createdAt)} ${prettyTime(lead.createdAt)}`],
  );
  if (lead.closeReason) rows.push([`${lead.stage} Reason`, lead.closeNote ? `${lead.closeReason} — ${lead.closeNote}` : lead.closeReason]);
  return rows;
}

export function stamp(iso) {
  return iso ? `${prettyDate(iso)} • ${prettyTime(iso)}` : '—';
}

function OverviewCard({ lead, onEmail, onCall }) {
  const [details, setDetails] = useState(false);
  const address = [lead.building, lead.street, lead.city, lead.state, lead.zip, lead.country].filter(Boolean);
  return (
    <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
      <dl className="space-y-4">
        <Info label="Lead Owner">{lead.ownerName || '—'}</Info>
        <Info label="Email">
          {lead.email ? <button type="button" className="text-blue-600 hover:underline" onClick={onEmail}>{lead.email}</button> : '—'}
        </Info>
        {lead.leadType !== 'Student' && <Info label="Phone"><PhoneLink value={lead.phone} onCall={() => onCall(lead.phone)} /></Info>}
        <Info label="Mobile"><PhoneLink value={lead.mobile} onCall={() => onCall(lead.mobile)} /></Info>
        <Info label="Lead Status">{lead.stage}</Info>
        <Info label="Last Contacted">{stamp(lead.lastContactedAt)}</Info>
        <Info label="Next Follow-up">
          <span className={cx(lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() && 'text-rose-600')}>{stamp(lead.nextFollowUpAt)}</span>
        </Info>
      </dl>
      <button type="button" className="mt-5 text-sm font-medium text-blue-600" onClick={() => setDetails(!details)}>
        {details ? 'Hide Details' : 'Show Details'}
      </button>
      {details && (
        <div className="mt-5 space-y-6 border-t border-slate-100 pt-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Lead Information</h3>
            <dl className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
              {detailRows(lead).map(([label, value]) => <Info key={label} label={label}>{value === 0 ? 0 : value || '—'}</Info>)}
            </dl>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Address Information</h3>
            <dl className="space-y-3">
              <Info label="Address">{address.length ? address.join(', ') : '—'}</Info>
              {(lead.latitude || lead.longitude) && <Info label="Coordinates">{lead.latitude}, {lead.longitude}</Info>}
            </dl>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Description Information</h3>
            <dl><Info label="Description"><span className="whitespace-pre-wrap">{lead.notes || '—'}</span></Info></dl>
          </div>
        </div>
      )}
    </section>
  );
}

export function Info({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-6 text-sm sm:grid-cols-[170px_1fr]">
      <dt className="text-right text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

function PhoneLink({ value, onCall }) {
  if (!value) return '—';
  return (
    <span className="inline-flex items-center gap-2">
      {value}
      <button type="button" onClick={onCall} className="grid h-6 w-6 place-items-center rounded-md bg-emerald-50 text-xs text-emerald-600 hover:bg-emerald-100" aria-label={`Call ${value}`}>✆</button>
    </span>
  );
}

export function Section({ id, title, action, children }) {
  return (
    <section id={`related-${id}`} className="scroll-mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="py-3 text-sm text-slate-400">{children}</p>;
}

function NotesSection({ lead, notes, onChange }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api('/api/notes', { method: 'POST', body: { body, linkedType: 'lead', linkedId: lead.id, linkedName: lead.name } });
      setBody('');
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(noteId) {
    if (!window.confirm('Delete this note?')) return;
    await api(`/api/notes/${noteId}`, { method: 'DELETE' });
    await onChange();
  }

  return (
    <Section id="notes" title="Notes" action={<Link className="text-sm font-medium text-blue-700" to={`/notes?lead=${lead.id}`}>View all notes</Link>}>
      <form onSubmit={add} className="flex gap-2">
        <textarea className="field min-h-[44px] flex-1 !rounded-md" placeholder="Add a note…" value={body} onChange={(event) => setBody(event.target.value)} />
        <button type="submit" className="btn !rounded-lg self-start" disabled={busy || !body.trim()}>Save</button>
      </form>
      <ul className="mt-3 divide-y divide-slate-100">
        {notes.map((note) => (
          <li key={note.id} className="flex items-start justify-between gap-3 py-3">
            <div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
              <p className="mt-1 text-xs text-slate-400">{note.authorName} · {ago(note.createdAt)}</p>
            </div>
            <button type="button" className="text-xs text-slate-400 hover:text-rose-600" onClick={() => remove(note.id)}>Delete</button>
          </li>
        ))}
      </ul>
      {notes.length === 0 && <Empty>No notes yet.</Empty>}
    </Section>
  );
}

function ConnectedSection({ lead, contact, account, deal, onConvert }) {
  const navigate = useNavigate();
  const rows = [
    account && { key: 'account', kind: 'Account', name: account.name, note: account.type || 'Organisation', to: `/accounts/${account.id}` },
    contact && { key: 'contact', kind: 'Contact', name: contact.name, note: `${contact.company || 'No company'} · converted ${ago(lead.convertedAt)}`, to: `/contacts/${contact.id}` },
    deal && { key: 'deal', kind: 'Deal', name: deal.name, note: `${deal.stage} · ${money(deal.value)}`, to: `/deals/${deal.id}` },
  ].filter(Boolean);
  return (
    <Section id="connected" title="Connected Records">
      {contact ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  <span className="mr-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">{row.kind}</span>
                  {row.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{row.note}</p>
              </div>
              <button type="button" className="text-sm font-medium text-blue-600" onClick={() => navigate(row.to)}>Open</button>
            </div>
          ))}
          {!deal && (
            <div className="flex items-center justify-between">
              <Empty>No deal was created for this lead.</Empty>
              <button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={onConvert}>Create deal</button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Empty>This lead hasn’t been converted yet.</Empty>
          <button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={onConvert}>Convert lead</button>
        </div>
      )}
    </Section>
  );
}

function AttachmentsSection({ lead, files, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Attachments must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await api(`/api/leads/${lead.id}/attachments`, { method: 'POST', body: { fileName: file.name, contentType: file.type, data } });
      await onChange();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function download(file) {
    const result = await api(`/api/leads/${lead.id}/attachments/${file.id}`);
    const bytes = Uint8Array.from(atob(result.data), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function remove(file) {
    if (!window.confirm(`Delete ${file.fileName}?`)) return;
    await api(`/api/leads/${lead.id}/attachments/${file.id}`, { method: 'DELETE' });
    await onChange();
  }

  return (
    <Section
      id="attachments"
      title="Attachments"
      action={(
        <>
          <input ref={input} type="file" className="hidden" onChange={upload} />
          <button type="button" className="btn-ghost !rounded-lg !py-1.5" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : '+ Attach'}</button>
        </>
      )}
    >
      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <button type="button" className="truncate text-left text-blue-600 hover:underline" onClick={() => download(file)}>📎 {file.fileName}</button>
            <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
              {size(file.size)} · {file.uploadedBy} · {ago(file.createdAt)}
              <button type="button" className="hover:text-rose-600" onClick={() => remove(file)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
      {files.length === 0 && <Empty>No attachments. Files up to 5 MB.</Empty>}
    </Section>
  );
}

export function size(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function dueText(task) {
  return task.dueAt ? `${dueLabel(task.dueDate)} • ${prettyTime(task.dueAt)}` : dueLabel(task.dueDate);
}

export function callResult(call = {}) {
  if (call.outcome !== 'Connected') return call.outcome;
  return `Connected · ${call.customerResponse === 'Other' ? call.customerResponseOther : call.customerResponse}`;
}

function ActivitiesSection({ lead, open, closed, calls, members, user, onChange }) {
  const blank = { title: '', dueDate: isoDay(new Date()), priority: 'Medium', assigneeId: user?.id || '', details: '' };
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  async function add(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/followups', { method: 'POST', body: { ...form, status: 'Pending', leadId: lead.id } });
      setForm(null);
      await onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function approve(task) {
    setError('');
    try {
      await api(`/api/followups/${task.id}/approve`, { method: 'POST' });
      await onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function status(task, next) {
    if (isAwaitingApproval(task)) return;
    await api(`/api/followups/${task.id}/status`, { method: 'PATCH', body: { status: next } });
    await onChange();
  }

  const canManage = canSeeTeamData(user);

  const row = (task, done) => {
    const awaiting = isAwaitingApproval(task);
    return (
    <li key={task.id} className="flex items-start gap-3 py-3 text-sm">
      <input type="checkbox" className="mt-1" checked={done} disabled={awaiting} onChange={() => status(task, done ? 'Pending' : 'Completed')} aria-label={done ? 'Reopen' : 'Mark complete'} />
      <div className="flex-1">
        <p className={cx('font-medium', done && 'text-slate-400 line-through')}>
          {task.type && <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 no-underline">{task.type}</span>}
          {task.title}
        </p>
        {task.details && <p className="text-xs text-slate-500">{task.details}</p>}
        <p className={cx('mt-0.5 text-xs', !done && isOverdue(task) ? 'text-rose-600' : 'text-slate-400')}>
          Due {dueText(task)} · {task.priority} · {task.assigneeName} · {followUpStatusLabel(task)}
          {task.reminder && task.reminder !== 'None' ? ` · 🔔 ${task.reminder}` : ''}
          {!done && isOverdue(task) ? ' · Overdue' : ''}
        </p>
      </div>
      {awaiting && canManage && (
        <button type="button" className="text-xs font-medium text-emerald-600" onClick={() => approve(task)}>Approve</button>
      )}
      {awaiting && !canManage && <span className="text-xs text-amber-600">Waiting for approval</span>}
    </li>
    );
  };

  return (
    <>
      <Section
        id="open"
        title="Open Activities"
        action={!form && <button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={() => setForm(blank)}>+ New follow-up</button>}
      >
        {form && (
          <form onSubmit={add} className="mb-3 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Title"><input className="field" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Call to discuss admission" /></Field></div>
            <Field label="Due date"><input className="field" type="date" required value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
            <Field label="Priority">
              <select className="field" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Assign to">
              {canSeeTeamData(user) ? (
              <select className="field" value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              ) : (
                <input className="field" readOnly value={user?.name || 'You'} />
              )}
            </Field>
            <Field label="Details"><input className="field" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></Field>
            {!canSeeTeamData(user) && <p className="text-xs text-slate-500 sm:col-span-2">Head of Sales will approve this follow-up before you can edit it.</p>}
            {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn !rounded-lg !py-1.5">{canSeeTeamData(user) ? 'Save' : 'Submit for approval'}</button>
            </div>
          </form>
        )}
        <ul className="divide-y divide-slate-100">{open.map((task) => row(task, false))}</ul>
        {open.length === 0 && !form && <Empty>No open activities.</Empty>}
      </Section>
      <Section id="closed" title="Closed Activities">
        <ul className="divide-y divide-slate-100">
          {calls.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3 text-sm">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-50 text-xs text-emerald-600">📞</span>
              <div className="flex-1">
                <p className="font-medium">Call · {callResult(item.call)}</p>
                {item.call?.notes && <p className="line-clamp-2 text-xs text-slate-500">{item.call.notes}</p>}
                <p className="mt-0.5 text-xs text-slate-400">{stamp(item.createdAt)} · {item.call?.phone} · {item.actorName}</p>
              </div>
            </li>
          ))}
          {closed.map((task) => row(task, true))}
        </ul>
        {closed.length === 0 && calls.length === 0 && <Empty>No closed activities.</Empty>}
      </Section>
    </>
  );
}

function EmailsSection({ emails, onCompose }) {
  const [open, setOpen] = useState(null);
  return (
    <Section id="emails" title="Emails" action={<button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={onCompose}>Compose</button>}>
      <ul className="divide-y divide-slate-100">
        {emails.map((mail) => (
          <li key={mail.id} className="py-3 text-sm">
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === mail.id ? null : mail.id)}>
              <span className="font-medium">{mail.title.replace(/^Email sent: /, '')}</span>
              <span className="text-xs text-slate-400">{mail.actorName} · {ago(mail.createdAt)}</span>
            </button>
            {open === mail.id && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-600">{mail.detail}</p>}
          </li>
        ))}
      </ul>
      {emails.length === 0 && <Empty>No emails sent yet.</Empty>}
    </Section>
  );
}

const HISTORY_FILTERS = [
  ['calls', 'Calls', ['call']],
  ['status', 'Status changes', ['stage']],
  ['fields', 'Field updates', ['field', 'owner']],
  ['notes', 'Notes', ['note']],
  ['tasks', 'Follow-ups', ['task']],
  ['meetings', 'Meetings', ['meeting']],
  ['emails', 'Emails', ['email']],
  ['files', 'Attachments', ['attachment']],
  ['other', 'Other', ['created', 'converted']],
];

const ICONS = { call: '📞', stage: '✎', field: '✎', owner: '👤', note: '🗒', task: '☑', meeting: '📅', email: '✉', attachment: '📎', created: '✚', converted: '⇄' };

export function dayKey(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function groupByDay(items) {
  const groups = [];
  items.forEach((item) => {
    const key = dayKey(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  });
  return groups;
}

export function splitChange(detail = '') {
  const [change, ...rest] = detail.split(' · ');
  const [from, to] = change.split(' → ');
  return { from, to, extra: rest.join(' · ') };
}

export function CallEntry({ item, lead }) {
  const call = item.call || {};
  const connected = call.outcome === 'Connected';
  return (
    <span className="block">
      <b className="font-semibold text-slate-800">{connected ? 'Call Completed' : 'Call Attempted'}</b>
      <span className="mt-2 block max-w-xl rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
        <span className="block font-medium text-slate-800">{lead.name}</span>
        {lead.company && lead.company !== lead.name && <span className="block text-xs text-slate-500">{lead.company}</span>}
        <span className="mt-2 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-xs">
          <span className="text-slate-500">Outcome</span>
          <span className={cx('font-medium', connected ? 'text-emerald-700' : 'text-slate-700')}>{call.outcome}</span>
          {connected && (
            <>
              <span className="text-slate-500">Customer Response</span>
              <span className="font-medium text-slate-700">{call.customerResponse === 'Other' ? call.customerResponseOther : call.customerResponse}</span>
            </>
          )}
          {call.notes && (
            <>
              <span className="text-slate-500">Notes</span>
              <span className="whitespace-pre-wrap text-slate-700">{call.notes}</span>
            </>
          )}
          <span className="text-slate-500">Next Action</span>
          <span className="text-slate-700">
            {call.nextActionAt ? <>📅 {call.nextAction} · {prettyDate(call.nextActionAt)} • {prettyTime(call.nextActionAt)}</> : call.nextAction}
          </span>
          <span className="text-slate-500">Number</span>
          <span className="text-slate-700">{call.phone}</span>
        </span>
      </span>
    </span>
  );
}

function historyText(item, lead) {
  if (item.type === 'call') return <CallEntry item={item} lead={lead} />;
  if (item.type === 'stage') {
    const { from, to, extra } = splitChange(item.detail);
    return (
      <>
        Lead Status was updated from <b>{from}</b> to <b>{to}</b>
        {extra && <span className="block text-xs text-slate-500">Reason: {extra}</span>}
      </>
    );
  }
  if (item.type === 'owner' || item.type === 'field') {
    const { from, to } = splitChange(item.detail);
    const label = item.type === 'owner' ? 'Lead Owner' : item.title.replace(/ was updated$/, '');
    return <>{label} was updated from <b>{from}</b> to <b>{to}</b></>;
  }
  if (item.type === 'email') {
    return <>Email sent: <b>{item.title.replace(/^Email sent: /, '')}</b></>;
  }
  return (
    <>
      <b className="font-medium">{item.title}</b>
      {item.detail && <span className="block whitespace-pre-wrap text-xs text-slate-500">{item.detail}</span>}
    </>
  );
}

function TimelineTab({ data, onChange }) {
  const [view, setView] = useState('history');
  const [filters, setFilters] = useState(HISTORY_FILTERS.map(([key]) => key));
  const [filterOpen, setFilterOpen] = useState(false);
  const [upcoming, setUpcoming] = useState(false);
  const [noteFor, setNoteFor] = useState(null);

  const allowed = HISTORY_FILTERS.filter(([key]) => filters.includes(key)).flatMap(([, , types]) => types);
  const known = HISTORY_FILTERS.flatMap(([, , types]) => types);
  const history = data.timeline.filter((item) => allowed.includes(item.type) || (!known.includes(item.type) && filters.includes('other')));

  const interactions = [
    ...(data.calls || []).map((item) => ({
      id: `c-${item.id}`, kind: 'Call', icon: '📞', createdAt: item.createdAt, title: callResult(item.call), body: item.call?.notes, by: item.actorName,
    })),
    ...data.notes.map((note) => ({ id: `n-${note.id}`, kind: 'Note', icon: '🗒', createdAt: note.createdAt, title: note.body, by: note.authorName })),
    ...data.emails.map((mail) => ({ id: `e-${mail.id}`, kind: 'Email', icon: '✉', createdAt: mail.createdAt, title: mail.title.replace(/^Email sent: /, ''), body: mail.detail, by: mail.actorName })),
    ...[...data.openActivities, ...data.closedActivities].map((task) => ({
      id: `t-${task.id}`, kind: task.status === 'Completed' ? 'Follow-up · Completed' : 'Follow-up', icon: '☑', createdAt: task.createdAt, title: task.title, body: `Due ${dueText(task)} · ${task.priority}`, by: task.assigneeName,
    })),
  ].filter((item) => item.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function toggleFilter(key) {
    setFilters((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-100">
      <div className="flex gap-6 border-b border-slate-100 px-6">
        {[['history', 'History'], ['interactions', 'Interactions']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)} className={cx('-mb-px border-b-2 py-3 text-sm', view === key ? 'border-blue-600 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}</button>
        ))}
      </div>

      <div className="p-6">
        {view === 'history' ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex items-center gap-3">
                <h2 className="font-semibold text-slate-800">Timeline History</h2>
                <button type="button" className={cx('grid h-8 w-8 place-items-center rounded-md border text-sm', filters.length < HISTORY_FILTERS.length ? 'border-blue-500 text-blue-600' : 'border-slate-300 text-slate-600')} onClick={() => setFilterOpen(!filterOpen)} aria-label="Filter timeline">⏷</button>
                {filterOpen && (
                  <div className="absolute left-0 top-10 z-20 w-56 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
                    {HISTORY_FILTERS.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                        <input type="checkbox" checked={filters.includes(key)} onChange={() => toggleFilter(key)} />
                        {label}
                      </label>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
                      <button type="button" className="text-slate-500" onClick={() => setFilters(HISTORY_FILTERS.map(([key]) => key))}>Select all</button>
                      <button type="button" className="font-semibold text-blue-600" onClick={() => setFilterOpen(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setUpcoming(!upcoming)}>
                {upcoming ? 'Hide' : 'Show'} Upcoming Actions {upcoming ? '▴' : '▾'}
              </button>
            </div>

            {upcoming && (
              <div className="mb-6 rounded-xl bg-amber-50/60 p-4 ring-1 ring-amber-100">
                <p className="mb-2 text-sm font-semibold text-amber-800">Upcoming actions</p>
                {data.openActivities.length === 0 ? (
                  <p className="text-sm text-amber-700/70">Nothing scheduled. Add a follow-up from Open Activities.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {data.openActivities.map((task) => (
                      <li key={task.id} className="flex justify-between gap-3">
                        <span>☑ {task.title}</span>
                        <span className={cx('text-xs', isOverdue(task) ? 'text-rose-600' : 'text-slate-500')}>{dueText(task)} · {task.assigneeName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {groupByDay(history).map((group) => (
              <div key={group.key} className="mb-6">
                <span className="inline-block rounded-md bg-slate-100 px-4 py-1 text-xs text-slate-600">{group.key}</span>
                <ol className="mt-4">
                  {group.items.map((item, i) => (
                    <li key={item.id} className="grid grid-cols-[72px_32px_1fr] gap-3">
                      <span className="pt-1.5 text-right text-xs text-slate-500">{prettyTime(item.createdAt)}</span>
                      <div className="flex flex-col items-center">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-sm text-slate-500">{ICONS[item.type] || '•'}</span>
                        {i < group.items.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="pb-6 pt-1 text-sm text-slate-700">
                        <div>{historyText(item, data.lead)}</div>
                        <p className="mt-0.5 text-xs text-slate-500">by {item.actorName} {dayKey(item.createdAt)}</p>
                        {noteFor === item.id ? (
                          <InlineNote lead={data.lead} onDone={async (saved) => { setNoteFor(null); if (saved) await onChange(); }} />
                        ) : (
                          <button type="button" className="mt-1 text-xs font-medium text-blue-600 hover:underline" onClick={() => setNoteFor(item.id)}>Add Note ▾</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {history.length === 0 && <Empty>No history matches these filters.</Empty>}
          </>
        ) : (
          <>
            {groupByDay(interactions).map((group) => (
              <div key={group.key} className="mb-6">
                <span className="inline-block rounded-md bg-slate-100 px-4 py-1 text-xs text-slate-600">{group.key}</span>
                <ul className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex gap-3 rounded-xl border border-slate-100 p-3 text-sm">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-50">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{item.kind}</span>
                          <span className="text-xs text-slate-400">{prettyTime(item.createdAt)} · {item.by}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{item.title}</p>
                        {item.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500">{item.body}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {interactions.length === 0 && <Empty>No calls, notes, emails or follow-ups with this lead yet.</Empty>}
          </>
        )}
      </div>
    </section>
  );
}

function InlineNote({ lead, onDone }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api('/api/notes', { method: 'POST', body: { body, linkedType: 'lead', linkedId: lead.id, linkedName: lead.name } });
      onDone(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-2 flex max-w-lg gap-2">
      <input autoFocus className="field !rounded-md !py-1.5" placeholder="Write a note…" value={body} onChange={(event) => setBody(event.target.value)} />
      <button type="submit" className="btn !rounded-md !py-1.5" disabled={busy || !body.trim()}>Save</button>
      <button type="button" className="btn-ghost !rounded-md !py-1.5" onClick={() => onDone(false)}>Cancel</button>
    </form>
  );
}

function SendEmailModal({ lead, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/mail/send', { method: 'POST', body: { leadId: lead.id, subject, body } });
      setSent(true);
      await onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Send Email" subtitle={`To ${lead.name}${lead.email ? ` <${lead.email}>` : ''}`} onClose={onClose} wide>
      {!lead.email && <div className="mb-3"><Banner tone="warn">This lead has no email address. Add one with Edit first.</Banner></div>}
      <form onSubmit={send} className="space-y-3">
        <Field label="Subject"><input className="field" required value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <Field label="Message"><textarea className="field min-h-48" required value={body} onChange={(event) => setBody(event.target.value)} /></Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {sent && <Banner tone="good">Email sent to {lead.email}. In Docker you can read it at http://localhost:8025.</Banner>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button type="submit" className="btn" disabled={busy || !lead.email}>{busy ? <Spinner /> : null}Send</button>
        </div>
      </form>
    </Modal>
  );
}

function CloseModal({ stage, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <Modal title={`Mark as ${stage}`} subtitle="Tell the team why." onClose={onClose}>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit(reason, note); }}>
        <Field label={`${stage} reason`}>
          <select className="field" required value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="">Choose a reason</option>
            {closeReasons(stage).map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="What happened"><input className="field" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Save</button>
        </div>
      </form>
    </Modal>
  );
}
