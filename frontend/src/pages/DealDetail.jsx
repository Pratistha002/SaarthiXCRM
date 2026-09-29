import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import {
  NEXT_ACTIONS, NO_FURTHER_ACTION, PRIORITIES, REMINDERS, ago, cx, isOverdue, isoDay, money, nextActionLabel, prettyDate, prettyTime,
} from '../lib';
import { Banner, Field, Modal, Spinner } from '../ui';
import CallModal from './CallModal';
import { LostModal, WonModal } from './DealModals';
import {
  CallEntry, Empty, Info, Section, callResult, dayKey, dueText, groupByDay, size, splitChange, stamp,
} from './LeadDetail';

const MEETING_TYPES = ['Meeting', 'Demo', 'Visit'];
const TASK_TYPES = NEXT_ACTIONS.filter((item) => item !== NO_FURTHER_ACTION);

const RELATED = [
  ['followups', 'Follow-ups'],
  ['meetings', 'Meetings'],
  ['calls', 'Calls'],
  ['closed', 'Closed Activities'],
  ['notes', 'Notes'],
  ['documents', 'Documents'],
  ['emails', 'Emails'],
];

function day(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useTeam();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);

  async function load() {
    try {
      setData(await api(`/api/deals/${id}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setData(null);
    setModal(null);
    setNotice('');
    load();
  }, [id]);

  useEffect(() => { api('/api/deals/meta').then(setMeta).catch(() => {}); }, []);

  if (error && !data) {
    return (
      <div className="card text-center">
        <p className="text-sm text-rose-600">{error}</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => navigate('/pipeline')}>Back to pipeline</button>
      </div>
    );
  }
  if (!data) return <p className="py-20 text-center text-sm text-slate-400">Loading deal…</p>;

  const { deal, contact } = data;
  const open = deal.status === 'Open';
  const followups = data.openActivities.filter((task) => !MEETING_TYPES.includes(task.type));
  const meetings = [...data.openActivities, ...data.closedActivities].filter((task) => MEETING_TYPES.includes(task.type));
  const closedTasks = data.closedActivities.filter((task) => !MEETING_TYPES.includes(task.type));
  const counts = {
    followups: followups.length, meetings: meetings.length, calls: data.calls.length, closed: closedTasks.length,
    notes: data.notes.length, documents: data.attachments.length, emails: data.emails.length,
  };
  const next = nextActionLabel(deal.nextAction);

  async function moveStage(stage) {
    if (stage === deal.stage) return;
    if (stage === 'Won') { setModal('won'); return; }
    if (stage === 'Lost') { setModal('lost'); return; }
    try {
      await api(`/api/deals/${id}/stage`, { method: 'PATCH', body: { stage } });
      await load();
    } catch (err) {
      setError(err.status ? err.message : 'Could not reach the server, so the stage was not changed.');
    }
  }

  async function done(message) {
    setModal(null);
    if (message) setNotice(message);
    await load();
  }

  function jump(key) {
    setTab('overview');
    setTimeout(() => document.getElementById(`related-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const callTarget = {
    id: deal.id, name: contact?.name || deal.primaryContactName || deal.accountName, company: deal.accountName,
    phone: contact?.phone || '', mobile: '', stage: '',
  };

  return (
    <div className="-mx-2">
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-xl text-slate-600 hover:bg-slate-100" onClick={() => navigate('/pipeline')} aria-label="Back">←</button>
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-lg font-semibold text-blue-600">₹</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{deal.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(`/accounts/${deal.accountId}`)}>{deal.accountName}</button>
            <span>·</span>
            <span className="font-semibold text-slate-800">{money(deal.value)}</span>
            <span>·</span>
            <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium',
              deal.status === 'Won' ? 'bg-emerald-50 text-emerald-700' : deal.status === 'Lost' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700')}
            >
              {deal.stage}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn !rounded-lg !py-2" onClick={() => setModal('call')}>📞 Call</button>
          <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={() => setModal('email')}>✉ Email</button>
          <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={() => setModal('activity')}>+ Add Activity</button>
          <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={() => setModal('edit')}>Edit</button>
          {deal.status !== 'Won' && <button type="button" className="btn-ghost !rounded-lg !border-emerald-300 !py-2 !text-emerald-700 hover:!bg-emerald-50" onClick={() => setModal('won')}>Mark Won</button>}
          {deal.status !== 'Lost' && <button type="button" className="btn-ghost !rounded-lg !border-rose-200 !py-2 !text-rose-600 hover:!bg-rose-50" onClick={() => setModal('lost')}>Mark Lost</button>}
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

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full bg-white p-1 ring-1 ring-slate-200">
              {[['overview', 'Overview'], ['timeline', 'Timeline']].map(([key, label]) => (
                <button key={key} type="button" className={cx('rounded-full px-5 py-1.5 text-sm', tab === key ? 'bg-slate-100 font-semibold text-slate-900 ring-1 ring-slate-300' : 'text-slate-600')} onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>
            <p className="text-sm text-slate-500">◷ Last Update : {prettyTime(deal.updatedAt)} · {prettyDate(deal.updatedAt)}</p>
          </div>

          <DealStageBar stages={meta?.stages || []} deal={deal} onMove={moveStage} />

          {tab === 'overview' ? (
            <>
              <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                {open && (
                  <div className={cx('mb-5 rounded-xl px-4 py-3 text-sm', next ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800')}>
                    <span className="font-medium">Next action: </span>
                    {next ? `${next.icon} ${next.type} — ${next.when}` : 'No next action scheduled'}
                    {!next && <button type="button" className="ml-2 font-medium text-blue-600 hover:underline" onClick={() => setModal('activity')}>Schedule one</button>}
                  </div>
                )}
                <dl className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
                  <Info label="Deal Owner">{deal.ownerName}</Info>
                  <Info label="Account">
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(`/accounts/${deal.accountId}`)}>{deal.accountName}</button>
                  </Info>
                  <Info label="Primary Contact">
                    {deal.primaryContactId
                      ? <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(`/contacts/${deal.primaryContactId}`)}>{contact?.name || deal.primaryContactName}</button>
                      : '—'}
                  </Info>
                  <Info label="Product">{deal.product || '—'}</Info>
                  <Info label="Deal Value">{money(deal.value)}</Info>
                  <Info label="Probability">{deal.probability}% <span className="text-xs text-slate-400">· weighted {money(deal.weightedValue)}</span></Info>
                  <Info label="Expected Close Date">
                    <span className={cx(open && deal.expectedCloseDate < isoDay(new Date()) && 'font-medium text-rose-600')}>{day(deal.expectedCloseDate)}</span>
                  </Info>
                  <Info label="Priority">{deal.priority}</Info>
                  {deal.status === 'Won' && <Info label="Won Date"><span className="text-emerald-700">{day(deal.wonDate)}</span></Info>}
                  {deal.status === 'Lost' && <Info label="Lost Reason"><span className="text-rose-600">{deal.lostReason === 'Other' ? deal.lostReasonOther : deal.lostReason}</span></Info>}
                  <Info label="Created">{stamp(deal.createdAt)}{deal.createdByName ? ` · ${deal.createdByName}` : ''}</Info>
                  <Info label="Last Updated">{stamp(deal.updatedAt)}</Info>
                  {deal.leadId && (
                    <Info label="Source Lead">
                      <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(`/leads/${deal.leadId}`)}>Open lead</button>
                    </Info>
                  )}
                  {contact && <Info label="Contact Details">{[contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}</Info>}
                </dl>
              </section>

              <TaskSection id="followups" title="Follow-ups" tasks={followups} onChange={load} action={<button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={() => setModal('activity')}>+ Add Activity</button>} empty="No open follow-ups." />
              <TaskSection id="meetings" title="Meetings" tasks={meetings} onChange={load} empty="No meetings or demos scheduled." />
              <Section id="calls" title="Calls" action={<button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={() => setModal('call')}>📞 Log call</button>}>
                <ul className="divide-y divide-slate-100">
                  {data.calls.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-3 text-sm">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-50 text-xs text-emerald-600">📞</span>
                      <div className="flex-1">
                        <p className="font-medium">{callResult(item.call)}</p>
                        {item.call?.notes && <p className="line-clamp-2 text-xs text-slate-500">{item.call.notes}</p>}
                        <p className="mt-0.5 text-xs text-slate-400">{stamp(item.createdAt)} · {item.call?.phone} · {item.actorName}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {data.calls.length === 0 && <Empty>No calls logged on this deal.</Empty>}
              </Section>
              <TaskSection id="closed" title="Closed Activities" tasks={closedTasks} onChange={load} empty="No completed follow-ups." />
              <DealNotes deal={deal} notes={data.notes} onChange={load} />
              <DealDocuments deal={deal} files={data.attachments} onChange={load} />
              <Section id="emails" title="Emails" action={<button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={() => setModal('email')}>Compose</button>}>
                <ul className="divide-y divide-slate-100">
                  {data.emails.map((mail) => (
                    <li key={mail.id} className="py-3 text-sm">
                      <p className="font-medium">{mail.title.replace(/^Email sent: /, '')}</p>
                      <p className="line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">{mail.detail}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{mail.actorName} · {ago(mail.createdAt)}</p>
                    </li>
                  ))}
                </ul>
                {data.emails.length === 0 && <Empty>No emails sent from this deal yet.</Empty>}
              </Section>
            </>
          ) : (
            <DealTimeline items={data.timeline} deal={deal} contact={contact} />
          )}
        </div>
      </div>

      {modal === 'call' && (
        <CallModal
          lead={callTarget}
          endpoint={`/api/deals/${deal.id}/activities/call`}
          showStatus={false}
          record="contact"
          editLabel="Edit deal"
          onClose={() => setModal(null)}
          onEditLead={() => setModal('edit')}
          onSaved={(result) => {
            const call = result.activity?.call || {};
            const when = call.nextActionAt ? ` Next: ${call.nextAction} on ${prettyDate(call.nextActionAt)}, ${prettyTime(call.nextActionAt)}.` : '';
            return done(`Call logged (${call.outcome}).${when}`);
          }}
        />
      )}
      {modal === 'email' && <DealEmailModal deal={deal} contact={contact} onClose={() => setModal(null)} onSent={() => done('Email sent.')} />}
      {modal === 'activity' && <ActivityModal deal={deal} members={members} user={user} onClose={() => setModal(null)} onSaved={() => done('Activity scheduled.')} />}
      {modal === 'edit' && <EditDealModal deal={deal} meta={meta} members={members} contacts={data.accountContacts} onClose={() => setModal(null)} onSaved={() => done('Deal updated.')} />}
      {modal === 'won' && <WonModal deal={deal} onClose={() => setModal(null)} onDone={() => done('Deal marked as Won.')} />}
      {modal === 'lost' && <LostModal deal={deal} reasons={meta?.lostReasons || []} onClose={() => setModal(null)} onDone={() => done('Deal marked as Lost.')} />}
    </div>
  );
}

function DealStageBar({ stages, deal, onMove }) {
  const active = stages.filter((stage) => stage.active);
  const current = active.findIndex((stage) => stage.name === deal.stage);
  const closed = deal.status !== 'Open';
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
      <div className={cx('flex flex-1 overflow-x-auto', closed && 'opacity-60')}>
        {active.map((stage, i) => {
          const isCurrent = stage.name === deal.stage;
          const done = current >= 0 && i < current;
          return (
            <button
              key={stage.name}
              type="button"
              onClick={() => onMove(stage.name)}
              title={`${stage.probability}% probability`}
              className={cx(
                'relative -ml-2 min-w-[130px] flex-1 whitespace-nowrap px-6 py-2 text-sm first:ml-0',
                isCurrent ? 'bg-blue-100 font-medium text-blue-700' : done ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
              )}
              style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)' }}
            >
              {stage.name}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onMove('Won')} className={cx('rounded-lg border px-3 py-2 text-sm', deal.status === 'Won' ? 'border-emerald-300 bg-emerald-100 font-medium text-emerald-700' : 'border-slate-200 text-emerald-700 hover:bg-emerald-50')}>
        ✓ Won
      </button>
      <button type="button" onClick={() => onMove('Lost')} className={cx('rounded-lg border px-3 py-2 text-sm', deal.status === 'Lost' ? 'border-rose-300 bg-rose-50 font-medium text-rose-600' : 'border-slate-200 text-rose-500 hover:bg-rose-50')}>
        ✕ Lost
      </button>
    </div>
  );
}

function TaskSection({ id, title, tasks, onChange, action, empty }) {
  async function toggle(task) {
    await api(`/api/followups/${task.id}/status`, { method: 'PATCH', body: { status: task.status === 'Completed' ? 'Pending' : 'Completed' } });
    await onChange();
  }
  return (
    <Section id={id} title={title} action={action}>
      <ul className="divide-y divide-slate-100">
        {tasks.map((task) => {
          const done = task.status === 'Completed';
          return (
            <li key={task.id} className="flex items-start gap-3 py-3 text-sm">
              <input type="checkbox" className="mt-1" checked={done} onChange={() => toggle(task)} aria-label={done ? 'Reopen' : 'Mark complete'} />
              <div className="flex-1">
                <p className={cx('font-medium', done && 'text-slate-400 line-through')}>
                  {task.type && <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{task.type}</span>}
                  {task.title}
                </p>
                {task.details && <p className="text-xs text-slate-500">{task.details}</p>}
                <p className={cx('mt-0.5 text-xs', !done && isOverdue(task) ? 'text-rose-600' : 'text-slate-400')}>
                  Due {dueText(task)} · {task.assigneeName}
                  {task.reminder && task.reminder !== 'None' ? ` · 🔔 ${task.reminder}` : ''}
                  {!done && isOverdue(task) ? ' · Overdue' : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {tasks.length === 0 && <Empty>{empty}</Empty>}
    </Section>
  );
}

function DealNotes({ deal, notes, onChange }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  async function add(event) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await api('/api/notes', { method: 'POST', body: { body, linkedType: 'deal', linkedId: deal.id, linkedName: deal.name } });
      setBody('');
      await onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section id="notes" title="Notes">
      <form onSubmit={add} className="flex gap-2">
        <textarea className="field min-h-[44px] flex-1 !rounded-md" placeholder="Add a note…" value={body} onChange={(event) => setBody(event.target.value)} />
        <button type="submit" className="btn !rounded-lg self-start" disabled={busy || !body.trim()}>Save</button>
      </form>
      <ul className="mt-3 divide-y divide-slate-100">
        {notes.map((note) => (
          <li key={note.id} className="py-3">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
            <p className="mt-1 text-xs text-slate-400">{note.authorName} · {ago(note.createdAt)}</p>
          </li>
        ))}
      </ul>
      {notes.length === 0 && <Empty>No notes yet.</Empty>}
    </Section>
  );
}

function DealDocuments({ deal, files, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Documents must be 5 MB or smaller.'); return; }
    setBusy(true);
    setError('');
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await api(`/api/deals/${deal.id}/attachments`, { method: 'POST', body: { fileName: file.name, contentType: file.type, data } });
      await onChange();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function download(file) {
    const result = await api(`/api/deals/${deal.id}/attachments/${file.id}`);
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
    await api(`/api/deals/${deal.id}/attachments/${file.id}`, { method: 'DELETE' });
    await onChange();
  }

  return (
    <Section
      id="documents"
      title="Documents"
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
      {files.length === 0 && <Empty>No documents. Proposals, quotes and contracts up to 5 MB.</Empty>}
    </Section>
  );
}

const DEAL_ICONS = { call: '📞', stage: '➜', won: '🏆', lost: '✕', field: '✎', note: '🗒', task: '☑', email: '✉', attachment: '📎', created: '✚' };

function dealHistoryText(item, deal, contact) {
  if (item.type === 'call') return <CallEntry item={item} lead={{ name: contact?.name || deal.primaryContactName, company: deal.accountName }} />;
  if (item.type === 'stage') {
    const { from, to } = splitChange(item.detail);
    return <><b className="font-medium">Deal Stage Changed</b><span className="block">{from} → {to}</span></>;
  }
  if (item.type === 'field') {
    const { from, to } = splitChange(item.detail);
    return <>{item.title.replace(/ was updated$/, '')} was updated from <b>{from}</b> to <b>{to}</b></>;
  }
  return (
    <>
      <b className={cx('font-medium', item.type === 'won' && 'text-emerald-700', item.type === 'lost' && 'text-rose-600')}>{item.title}</b>
      {item.detail && <span className="block whitespace-pre-wrap text-xs text-slate-500">{item.detail}</span>}
    </>
  );
}

function DealTimeline({ items, deal, contact }) {
  return (
    <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
      <h2 className="mb-5 font-semibold text-slate-800">Timeline History</h2>
      {groupByDay(items).map((group) => (
        <div key={group.key} className="mb-6">
          <span className="inline-block rounded-md bg-slate-100 px-4 py-1 text-xs text-slate-600">{group.key}</span>
          <ol className="mt-4">
            {group.items.map((item, i) => (
              <li key={item.id} className="grid grid-cols-[72px_32px_1fr] gap-3">
                <span className="pt-1.5 text-right text-xs text-slate-500">{prettyTime(item.createdAt)}</span>
                <div className="flex flex-col items-center">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-sm text-slate-500">{DEAL_ICONS[item.type] || '•'}</span>
                  {i < group.items.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                </div>
                <div className="pb-6 pt-1 text-sm text-slate-700">
                  <div>{dealHistoryText(item, deal, contact)}</div>
                  <p className="mt-0.5 text-xs text-slate-500">Changed by {item.actorName} · {dayKey(item.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {items.length === 0 && <Empty>No history yet.</Empty>}
    </section>
  );
}

function DealEmailModal({ deal, contact, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/mail/send', { method: 'POST', body: { dealId: deal.id, subject, body } });
      await onSent();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Send Email" subtitle={contact ? `To ${contact.name}${contact.email ? ` <${contact.email}>` : ''}` : 'No primary contact'} onClose={onClose} wide>
      {!contact?.email && <div className="mb-3"><Banner tone="warn">The primary contact has no email address. Add one on the contact first.</Banner></div>}
      <form onSubmit={send} className="space-y-3">
        <Field label="Subject"><input className="field" required value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <Field label="Message"><textarea className="field min-h-48" required value={body} onChange={(event) => setBody(event.target.value)} /></Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy || !contact?.email}>{busy && <Spinner />}Send</button>
        </div>
      </form>
    </Modal>
  );
}

function ActivityModal({ deal, members, user, onClose, onSaved }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [form, setForm] = useState({
    type: 'Follow-up', title: '', dueDate: isoDay(tomorrow), dueTime: '', reminder: 'None',
    assigneeId: deal.ownerId || user?.id || '', details: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!form.dueDate || !form.dueTime) { setError('Please select a date and time for this activity.'); return; }
    setBusy(true);
    setError('');
    try {
      await api(`/api/deals/${deal.id}/tasks`, {
        method: 'POST',
        body: {
          title: form.title.trim() || `${form.type} · ${deal.accountName}`,
          details: form.details,
          dueDate: form.dueDate,
          dueTime: form.dueTime,
          dueAt: new Date(`${form.dueDate}T${form.dueTime}`).toISOString(),
          reminder: form.reminder,
          type: form.type,
          priority: deal.priority || 'Medium',
          status: 'Pending',
          assigneeId: form.assigneeId,
        },
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Activity" subtitle={deal.name} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select className="field" value={form.type} onChange={set('type')}>{TASK_TYPES.map((item) => <option key={item}>{item}</option>)}</select>
        </Field>
        <Field label="Title"><input className="field" placeholder={`${form.type} · ${deal.accountName}`} value={form.title} onChange={set('title')} /></Field>
        <Field label="Date *"><input className="field" type="date" min={isoDay(new Date())} value={form.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Time *"><input className="field" type="time" value={form.dueTime} onChange={set('dueTime')} /></Field>
        <Field label="Reminder">
          <select className="field" value={form.reminder} onChange={set('reminder')}>{REMINDERS.map((item) => <option key={item}>{item}</option>)}</select>
        </Field>
        <Field label="Assign to">
          <select className="field" value={form.assigneeId} onChange={set('assigneeId')}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <div className="sm:col-span-2"><Field label="Details"><textarea className="field min-h-20" value={form.details} onChange={set('details')} /></Field></div>
        {error && <div className="sm:col-span-2"><Banner tone="danger">{error}</Banner></div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy && <Spinner />}Save Activity</button>
        </div>
      </form>
    </Modal>
  );
}

function EditDealModal({ deal, meta, members, contacts, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: deal.name, product: deal.product || '', value: String(deal.value), expectedCloseDate: deal.expectedCloseDate || '',
    priority: deal.priority, ownerId: deal.ownerId, primaryContactId: deal.primaryContactId || '', probability: String(deal.probability),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const open = deal.status === 'Open';

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/deals/${deal.id}`, {
        method: 'PUT',
        body: { ...form, value: Number(form.value || 0), probability: open ? Number(form.probability) : null },
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit Deal" subtitle={deal.accountName} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Deal Name *"><input className="field" required value={form.name} onChange={set('name')} /></Field></div>
        <Field label="Product">
          <input className="field" list="deal-products" value={form.product} onChange={set('product')} />
          <datalist id="deal-products">{(meta?.products || []).map((item) => <option key={item} value={item} />)}</datalist>
        </Field>
        <Field label="Deal Value (₹) *">
          <input className="field" inputMode="numeric" required value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value.replace(/[^\d]/g, '') })} />
        </Field>
        <Field label={open ? 'Expected Close Date *' : 'Expected Close Date'}>
          <input className="field" type="date" required={open} value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
        </Field>
        <Field label="Priority">
          <select className="field" value={form.priority} onChange={set('priority')}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select>
        </Field>
        <Field label="Deal Owner">
          <select className="field" value={form.ownerId} onChange={set('ownerId')}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="Primary Contact">
          <select className="field" value={form.primaryContactId} onChange={set('primaryContactId')}>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {open && (
          <Field label="Probability (%)" hint="Resets to the stage default when the stage changes.">
            <input className="field" type="number" min="0" max="100" value={form.probability} onChange={set('probability')} />
          </Field>
        )}
        {error && <div className="sm:col-span-2"><Banner tone="danger">{error}</Banner></div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy && <Spinner />}Save Deal</button>
        </div>
      </form>
    </Modal>
  );
}
