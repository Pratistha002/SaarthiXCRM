import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import {
  CALENDAR_TYPES, EVENT_TONE, INTEREST_LEVELS, MEETING_LOG_TYPES, ago, canLogMeeting, cx, dueLabel,
  eventIcon, formatClock,
} from '../lib';
import { Banner, Drawer, Field, Modal, Spinner } from '../ui';

export default function MeetingLogs() {
  const [params, setParams] = useSearchParams();
  const [pack, setPack] = useState({ logs: [], unlogged: [], summary: {} });
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [leadId, setLeadId] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [logging, setLogging] = useState(null);

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (type) query.set('type', type);
    if (leadId) query.set('leadId', leadId);
    setPack(await api(`/api/meeting-logs?${query.toString()}`));
  }

  useEffect(() => {
    const timer = setTimeout(() => { load().catch((err) => setError(err.message)); }, 200);
    return () => clearTimeout(timer);
  }, [q, type, leadId]);

  useEffect(() => {
    api('/api/leads').then((data) => setLeads(data.leads || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const eventId = params.get('event');
    if (!eventId) return undefined;
    api(`/api/calendar/${eventId}`)
      .then((event) => setLogging(event))
      .catch((err) => setError(err.message));
    const next = new URLSearchParams(params);
    next.delete('event');
    setParams(next, { replace: true });
    return undefined;
  }, [params, setParams]);

  const leadOptions = useMemo(
    () => [...leads].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [leads],
  );
  const logs = pack.logs || [];
  const unlogged = pack.unlogged || [];
  const summary = pack.summary || {};

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Meeting logs</h1>
          <p className="text-sm text-slate-500">Record what happened after a meeting, demo or campus visit — separate from the calendar schedule.</p>
        </div>
        <button type="button" className="btn" onClick={() => setLogging({ pick: true })} disabled={unlogged.length === 0}>
          + Log meeting
        </button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Logs', summary.total || 0],
          ['Waiting to log', summary.unlogged || 0],
          ['Hot interest', summary.hot || 0],
        ].map(([label, value]) => (
          <div key={label} className="card !p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input className="field flex-1" placeholder="Search topics, colleges, decisions…" value={q} onChange={(event) => setQ(event.target.value)} />
          <select className="field lg:max-w-[180px]" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option>
            {MEETING_LOG_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field lg:max-w-sm" value={leadId} onChange={(event) => setLeadId(event.target.value)}>
            <option value="">All leads</option>
            {leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
          </select>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        {unlogged.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Waiting to log</p>
            <div className="mt-2 space-y-2">
              {unlogged.slice(0, 6).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setLogging(event)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-left"
                >
                  <span>
                    <span className="text-xs font-medium text-amber-800">{eventIcon(event.type)} {event.type}</span>
                    <span className="mt-0.5 block font-medium text-slate-800">{event.title}</span>
                    <span className="text-xs text-slate-500">{dueLabel(event.dueDate)}{event.dueTime ? ` · ${formatClock(event.dueTime)}` : ''}{event.leadName ? ` · ${event.leadName}` : ''}</span>
                  </span>
                  <span className="text-sm font-medium text-blue-700">Log</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logged meetings</p>
          {logs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => setSelected(log)}
              className="flex w-full items-start gap-4 rounded-2xl border border-slate-100 p-4 text-left hover:border-blue-200 hover:bg-blue-50/40"
            >
              <span className={cx('mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1', EVENT_TONE[log.type] || EVENT_TONE.Meeting)}>
                {eventIcon(log.type)} {log.type}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-slate-900">{log.title}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{log.topicsDiscussed}</span>
                <span className="mt-2 block text-xs text-slate-400">
                  {dueLabel(log.meetingDate)}
                  {log.leadName ? ` · ${log.leadName}` : ''}
                  {log.interestLevel ? ` · ${log.interestLevel}` : ''}
                  {log.createdAt ? ` · ${ago(log.createdAt)}` : ''}
                </span>
              </span>
            </button>
          ))}
          {logs.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No meeting logs yet. Log a demo, meeting or visit after it happens.</p>}
        </div>
      </div>

      {selected && (
        <Drawer title={selected.type || 'Meeting log'} onClose={() => setSelected(null)}>
          <div className="space-y-4 px-5 py-4 text-sm">
            <div>
              <p className="text-xl font-semibold">{selected.title}</p>
              <p className="mt-1 text-slate-500">{dueLabel(selected.meetingDate)}{selected.meetingTime ? ` · ${formatClock(selected.meetingTime)}` : ''}</p>
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2">
              {selected.leadName && <><dt className="text-slate-400">Lead</dt><dd><Link className="text-blue-700" to={`/leads/${selected.leadId}`}>{selected.leadName}</Link></dd></>}
              {selected.attendees && <><dt className="text-slate-400">Attendees</dt><dd>{selected.attendees}</dd></>}
              <dt className="text-slate-400">Interest</dt><dd>{selected.interestLevel}</dd>
              <dt className="text-slate-400">Discussed</dt><dd className="whitespace-pre-wrap">{selected.topicsDiscussed}</dd>
              {selected.requirements && <><dt className="text-slate-400">Requirements</dt><dd className="whitespace-pre-wrap">{selected.requirements}</dd></>}
              {selected.feedback && <><dt className="text-slate-400">Feedback</dt><dd className="whitespace-pre-wrap">{selected.feedback}</dd></>}
              {selected.decisions && <><dt className="text-slate-400">Decisions</dt><dd className="whitespace-pre-wrap">{selected.decisions}</dd></>}
              {selected.followUpAction && (
                <>
                  <dt className="text-slate-400">Next</dt>
                  <dd>{selected.followUpAction}{selected.nextFollowUpDate ? ` by ${dueLabel(selected.nextFollowUpDate)}` : ''}</dd>
                </>
              )}
              {selected.createdByName && <><dt className="text-slate-400">Logged by</dt><dd>{selected.createdByName}</dd></>}
            </dl>
            <div className="flex gap-2">
              {selected.followUpId && <Link className="btn-ghost" to={`/calendar?event=${selected.followUpId}`}>View on calendar</Link>}
              <button type="button" className="btn" onClick={() => { setLogging({ id: selected.followUpId, type: selected.type, title: selected.title, dueDate: selected.meetingDate, dueTime: selected.meetingTime, attendees: selected.attendees, log: selected }); setSelected(null); }}>Update log</button>
            </div>
          </div>
        </Drawer>
      )}

      {logging && (
        <LogForm
          event={logging.pick ? null : logging}
          unlogged={unlogged}
          onClose={() => setLogging(null)}
          onSaved={async () => { setLogging(null); await load(); }}
        />
      )}
    </div>
  );
}

function LogForm({ event, unlogged, onClose, onSaved }) {
  const [followUpId, setFollowUpId] = useState(event?.id || '');
  const selected = event?.id ? event : (unlogged || []).find((item) => item.id === followUpId);
  const [form, setForm] = useState({
    attendees: event?.attendeeNames?.join(', ') || event?.attendees || event?.assigneeName || '',
    topicsDiscussed: event?.log?.topicsDiscussed || '',
    requirements: event?.log?.requirements || '',
    feedback: event?.log?.feedback || '',
    interestLevel: event?.log?.interestLevel || 'Warm',
    decisions: event?.log?.decisions || '',
    followUpAction: event?.log?.followUpAction || '',
    nextFollowUpDate: event?.log?.nextFollowUpDate || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (change) => setForm((current) => ({ ...current, [key]: change.target.value }));

  async function save(submit) {
    submit.preventDefault();
    if (!followUpId) {
      setError('Pick a meeting, demo or visit to log.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/meeting-logs', { method: 'POST', body: { followUpId, ...form } });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={event?.log ? 'Update meeting log' : 'Log meeting'}
      subtitle="Keep this after the meeting so the team knows what was discussed and what happens next."
      onClose={onClose}
      wide
    >
      <form className="space-y-3" onSubmit={save}>
        {!event?.id && (
          <Field label="Meeting, demo or visit *">
            <select className="field" required value={followUpId} onChange={(change) => setFollowUpId(change.target.value)}>
              <option value="">Choose an event</option>
              {(unlogged || []).map((item) => (
                <option key={item.id} value={item.id}>{item.type} · {item.title}{item.dueDate ? ` · ${dueLabel(item.dueDate)}` : ''}</option>
              ))}
            </select>
          </Field>
        )}
        {selected && (
          <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {canLogMeeting(selected.type) ? eventIcon(selected.type) : '📅'} {selected.title}
            {selected.dueDate || selected.meetingDate ? ` · ${dueLabel(selected.dueDate || selected.meetingDate)}` : ''}
            {(selected.dueTime || selected.meetingTime) ? ` · ${formatClock(selected.dueTime || selected.meetingTime)}` : ''}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Attendees"><input className="field" value={form.attendees} onChange={set('attendees')} /></Field>
          <Field label="Interest level *">
            <select className="field" value={form.interestLevel} onChange={set('interestLevel')}>
              {INTEREST_LEVELS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Topics discussed *"><textarea className="field min-h-20" required placeholder="Walked through TalentX placement workflow, student volume, and reporting." value={form.topicsDiscussed} onChange={set('topicsDiscussed')} /></Field>
        <Field label="College requirements or questions"><textarea className="field min-h-16" value={form.requirements} onChange={set('requirements')} /></Field>
        <Field label="Feedback"><textarea className="field min-h-16" value={form.feedback} onChange={set('feedback')} /></Field>
        <Field label="Decisions made"><textarea className="field min-h-16" value={form.decisions} onChange={set('decisions')} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Follow-up action">
            <select className="field" value={form.followUpAction} onChange={set('followUpAction')}>
              <option value="">None yet</option>
              {CALENDAR_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Next follow-up date"><input className="field" type="date" value={form.nextFollowUpDate} onChange={set('nextFollowUpDate')} /></Field>
        </div>
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" type="submit" disabled={busy}>{busy && <Spinner />}Save log</button>
        </div>
      </form>
    </Modal>
  );
}
