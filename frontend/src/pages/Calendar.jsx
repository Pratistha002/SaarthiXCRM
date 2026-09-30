import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import {
  CALENDAR_TYPES, EVENT_BAR, EVENT_DURATION, EVENT_TONE, PRIORITIES, REMINDERS,
  VISIT_PURPOSES, canLogMeeting, canSeeTeamData, cx, dueLabel, eventIcon, followUpStatusLabel,
  formatClock, isAwaitingApproval, isOverdue, isTimedEvent, isoDay, monthLabel, monthMatrix,
  shiftDate, weekDays,
} from '../lib';
import { Avatar, Banner, Drawer, Field, Modal, Spinner } from '../ui';

const VIEWS = ['day', 'week', 'month'];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 8);
const HOUR_H = 56;
const QUICK = [
  ['Call', 'Call a customer back'],
  ['Meeting', 'Meeting with a college'],
  ['Demo', 'SaarthiX product demo'],
  ['Visit', 'Campus visit'],
  ['Send Proposal', 'Proposal or other work'],
];

function rangeFor(view, cursor) {
  if (view === 'day') {
    const day = isoDay(cursor);
    return { from: day, to: day };
  }
  if (view === 'week') {
    const days = weekDays(cursor);
    return { from: isoDay(days[0]), to: isoDay(days[6]) };
  }
  const grid = monthMatrix(cursor);
  return { from: isoDay(grid[0][0]), to: isoDay(grid[5][6]) };
}

function blankEvent(user, { date, time, type } = {}) {
  const kind = type || 'Call';
  return {
    type: kind,
    title: '',
    details: '',
    dueDate: date || isoDay(new Date()),
    dueTime: time || (isTimedEvent(kind) ? '11:00' : ''),
    reminder: isTimedEvent(kind) ? '1 hour before' : '1 day before',
    priority: 'Medium',
    status: 'Pending',
    leadId: '',
    assigneeId: user?.id || '',
    location: '',
    meetingLink: '',
    contactPerson: '',
    purpose: kind === 'Visit' ? 'Campus visit' : '',
    durationMinutes: EVENT_DURATION[kind] || '',
    attendeeIds: user?.id ? [user.id] : [],
    attendees: '',
  };
}

function payload(form) {
  return {
    title: form.title.trim() || `${form.type}${form.leadName ? ` · ${form.leadName}` : ''}`,
    details: form.details || '',
    dueDate: form.dueDate,
    dueTime: form.dueTime || '',
    dueAt: form.dueTime ? new Date(`${form.dueDate}T${form.dueTime}`).toISOString() : undefined,
    reminder: form.reminder || 'None',
    type: form.type,
    priority: form.priority || 'Medium',
    status: form.status || 'Pending',
    leadId: form.leadId || '',
    assigneeId: form.assigneeId,
    location: form.location || '',
    meetingLink: form.meetingLink || '',
    contactPerson: form.contactPerson || '',
    purpose: form.purpose || '',
    durationMinutes: form.durationMinutes === '' || form.durationMinutes == null ? undefined : Number(form.durationMinutes),
    attendeeIds: form.attendeeIds || [],
    attendees: form.attendees || '',
  };
}

function eventsOn(events, date) {
  const key = typeof date === 'string' ? date : isoDay(date);
  return events.filter((event) => event.dueDate === key);
}

function blockStyle(event) {
  if (!event.dueTime) return { top: 0, height: 28 };
  const [hours, minutes] = event.dueTime.split(':').map(Number);
  const start = Math.max(0, ((hours - 8) * 60) + (minutes || 0));
  const duration = Math.max(20, Number(event.durationMinutes) || 30);
  return { top: (start / 60) * HOUR_H, height: Math.min((duration / 60) * HOUR_H, HOURS.length * HOUR_H - (start / 60) * HOUR_H) };
}

export default function Calendar() {
  const { user } = useAuth();
  const { members } = useTeam();
  const canManage = canSeeTeamData(user);
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [type, setType] = useState('');
  const [assigneeId, setAssigneeId] = useState(canManage ? 'all' : user?.id || '');
  const [pack, setPack] = useState({ events: [], summary: {} });
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [selected, setSelected] = useState(null);
  const today = isoDay(new Date());
  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);

  async function load() {
    const query = new URLSearchParams({ from: range.from, to: range.to });
    if (type) query.set('type', type);
    if (canManage && assigneeId && assigneeId !== 'all') query.set('assigneeId', assigneeId);
    const data = await api(`/api/calendar?${query}`);
    setPack(data);
    return data;
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [range.from, range.to, type, assigneeId]);

  useEffect(() => {
    api('/api/leads').then((data) => setLeads(data.leads || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const eventId = params.get('event');
    if (!eventId) return undefined;
    api(`/api/calendar/${eventId}`)
      .then((event) => setSelected(event))
      .catch(() => {});
    params.delete('event');
    setParams(params, { replace: true });
    return undefined;
  }, [params, setParams]);

  const events = pack.events || [];
  const agenda = useMemo(() => {
    const key = view === 'day' ? isoDay(cursor) : today;
    return eventsOn(events, key);
  }, [events, view, cursor, today]);

  function move(step) {
    if (view === 'day') setCursor((current) => shiftDate(current, step));
    else if (view === 'week') setCursor((current) => shiftDate(current, step * 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + step, 1));
  }

  function openCreate(options) {
    setSelected(null);
    setEditor(blankEvent(user, options));
  }

  async function saveEvent(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const lead = leads.find((item) => item.id === editor.leadId);
      const body = payload({ ...editor, leadName: lead?.name });
      const saved = editor.id
        ? await api(`/api/calendar/${editor.id}`, { method: 'PUT', body })
        : await api('/api/calendar', { method: 'POST', body });
      setEditor(null);
      await load();
      setSelected(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openEvent(event) {
    try {
      setSelected(await api(`/api/calendar/${event.id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function complete(event) {
    await api(`/api/followups/${event.id}/status`, {
      method: 'PATCH',
      body: { status: event.status === 'Completed' ? 'Pending' : 'Completed' },
    });
    await load();
    if (selected?.id === event.id) setSelected(await api(`/api/calendar/${event.id}`));
  }

  async function remove(event) {
    if (!window.confirm('Remove this from the calendar?')) return;
    await api(`/api/followups/${event.id}`, { method: 'DELETE' });
    setSelected(null);
    await load();
  }

  const heading = view === 'day'
    ? dueLabel(isoDay(cursor))
    : view === 'week'
      ? `${dueLabel(range.from)} – ${dueLabel(range.to)}`
      : monthLabel(cursor);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-slate-500">
            {canManage
              ? 'See the team’s calls, demos, visits and work for the day — and catch overlaps before they happen.'
              : 'Your calls, meetings, college visits and follow-up work, in one schedule.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium">
            {VIEWS.map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={cx('rounded-full px-3 py-1.5 capitalize', view === item ? 'bg-blue-600 text-white' : 'text-slate-500')}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => openCreate({ date: isoDay(view === 'month' ? new Date() : cursor), type: 'Call' })}>+ Schedule</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost !px-3" onClick={() => move(-1)}>←</button>
        <button type="button" className="btn-ghost !px-3" onClick={() => setCursor(new Date())}>Today</button>
        <button type="button" className="btn-ghost !px-3" onClick={() => move(1)}>→</button>
        <p className="px-2 text-sm font-semibold text-slate-800">{heading}</p>
        <select className="field !w-auto !py-2" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          {CALENDAR_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
        {canManage && (
          <select className="field !w-auto !py-2" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="all">Whole team</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="mb-4"><Banner tone="danger">{error}</Banner></div>}

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <section className="card">
            <p className="text-sm font-medium text-slate-800">{view === 'day' ? 'This day' : 'Today'}</p>
            <p className="text-xs text-slate-400">{agenda.length} on the schedule</p>
            <div className="mt-3 space-y-2">
              {agenda.length === 0 && <p className="py-4 text-sm text-slate-400">Nothing planned. Schedule a call, demo or visit.</p>}
              {agenda.map((event) => (
                <button key={event.id} type="button" onClick={() => openEvent(event)} className={cx('w-full rounded-2xl px-3 py-2 text-left ring-1', EVENT_TONE[event.type] || EVENT_TONE['Follow-up'])}>
                  <p className="text-xs font-medium">{eventIcon(event.type)} {event.type}{event.dueTime ? ` · ${formatClock(event.dueTime)}` : ''}</p>
                  <p className="truncate text-sm font-semibold">{event.title}</p>
                  {event.conflict && <p className="text-[11px] text-rose-600">Overlaps another event</p>}
                </button>
              ))}
            </div>
          </section>
          <section className="card">
            <p className="text-sm font-medium text-slate-800">Legend</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CALENDAR_TYPES.map((item) => (
                <button key={item} type="button" onClick={() => setType(type === item ? '' : item)} className={cx('rounded-full px-2.5 py-1 text-[11px] font-medium ring-1', EVENT_TONE[item], type === item && 'ring-2 ring-slate-900')}>
                  {eventIcon(item)} {item}
                </button>
              ))}
            </div>
          </section>
          {canManage && pack.summary?.byPerson && Object.keys(pack.summary.byPerson).length > 0 && (
            <section className="card">
              <p className="text-sm font-medium text-slate-800">Team load</p>
              <p className="text-xs text-slate-400">Events in this view</p>
              <div className="mt-3 space-y-2">
                {Object.entries(pack.summary.byPerson).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2"><Avatar name={name} size="sm" />{name}</span>
                    <span className="font-medium text-slate-600">{count}</span>
                  </div>
                ))}
              </div>
              {pack.summary.conflicts > 0 && <p className="mt-3 text-xs text-rose-600">{pack.summary.conflicts} overlapping events</p>}
            </section>
          )}
        </aside>

        <section className="card overflow-hidden !p-0">
          {view === 'month' && (
            <MonthView
              cursor={cursor}
              events={events}
              today={today}
              onSelectDay={(date) => openCreate({ date: isoDay(date), type: 'Visit' })}
              onOpen={openEvent}
            />
          )}
          {view === 'week' && (
            <WeekView
              cursor={cursor}
              events={events}
              today={today}
              onSlot={(date, time) => openCreate({ date: isoDay(date), time, type: 'Meeting' })}
              onDay={(date) => openCreate({ date: isoDay(date), type: 'Send Proposal' })}
              onOpen={openEvent}
            />
          )}
          {view === 'day' && (
            <DayView
              cursor={cursor}
              events={eventsOn(events, cursor)}
              today={today}
              onSlot={(time) => openCreate({ date: isoDay(cursor), time, type: 'Meeting' })}
              onOpen={openEvent}
            />
          )}
        </section>
      </div>

      {editor && (
        <EventForm
          editor={editor}
          setEditor={setEditor}
          leads={leads}
          members={members}
          canManage={canManage}
          user={user}
          busy={busy}
          error={error}
          onClose={() => { setEditor(null); setError(''); }}
          onSubmit={saveEvent}
        />
      )}

      {selected && !editor && (
        <EventDrawer
          event={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditor({ ...blankEvent(user), ...selected, durationMinutes: selected.durationMinutes || EVENT_DURATION[selected.type] || '' }); setSelected(null); }}
          onComplete={() => complete(selected)}
          onDelete={() => remove(selected)}
        />
      )}
    </div>
  );
}

function MonthView({ cursor, events, today, onSelectDay, onOpen }) {
  const weeks = monthMatrix(cursor);
  const month = cursor.getMonth();
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date) => {
          const key = isoDay(date);
          const items = eventsOn(events, key).slice(0, 4);
          const extra = eventsOn(events, key).length - items.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(date)}
              className={cx('min-h-[118px] border-b border-r border-slate-100 p-2 text-left align-top', date.getMonth() !== month && 'bg-slate-50/70 text-slate-400', key === today && 'bg-blue-50/50')}
            >
              <span className={cx('grid h-7 w-7 place-items-center rounded-full text-xs font-semibold', key === today && 'bg-blue-600 text-white')}>{date.getDate()}</span>
              <div className="mt-1 space-y-1">
                {items.map((event) => (
                  <span
                    key={event.id}
                    role="presentation"
                    onClick={(click) => { click.stopPropagation(); onOpen(event); }}
                    className={cx('block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1', EVENT_TONE[event.type] || EVENT_TONE['Follow-up'], event.conflict && 'ring-rose-300')}
                  >
                    {event.dueTime ? `${formatClock(event.dueTime)} · ` : ''}{event.title}
                  </span>
                ))}
                {extra > 0 && <span className="text-[11px] text-slate-400">+{extra} more</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, events, today, onSlot, onDay, onOpen }) {
  const days = weekDays(cursor);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-[72px_repeat(7,1fr)]">
        <div className="border-b border-slate-100" />
        {days.map((day) => {
          const key = isoDay(day);
          return (
            <button key={key} type="button" onClick={() => onDay(day)} className={cx('border-b border-l border-slate-100 px-2 py-3 text-left', key === today && 'bg-blue-50/70')}>
              <p className="text-[11px] uppercase text-slate-400">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
              <p className={cx('text-lg font-semibold', key === today && 'text-blue-700')}>{day.getDate()}</p>
            </button>
          );
        })}
        <div className="border-b border-slate-100 px-2 py-2 text-[11px] text-slate-400">All day</div>
        {days.map((day) => {
          const key = isoDay(day);
          const items = eventsOn(events, key).filter((event) => event.allDay);
          return (
            <div key={`all-${key}`} className="min-h-12 space-y-1 border-b border-l border-slate-100 p-1">
              {items.map((event) => (
                <button key={event.id} type="button" onClick={() => onOpen(event)} className={cx('block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ring-1', EVENT_TONE[event.type])}>
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}
        <div className="relative" style={{ height: HOURS.length * HOUR_H }}>
          {HOURS.map((hour) => (
            <div key={hour} className="border-b border-slate-100 pr-2 text-right text-[11px] text-slate-400" style={{ height: HOUR_H }}>{formatClock(`${String(hour).padStart(2, '0')}:00`)}</div>
          ))}
        </div>
        {days.map((day) => {
          const key = isoDay(day);
          const timed = eventsOn(events, key).filter((event) => !event.allDay);
          return (
            <div key={`grid-${key}`} className="relative border-l border-slate-100" style={{ height: HOURS.length * HOUR_H }}>
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => onSlot(day, `${String(hour).padStart(2, '0')}:00`)}
                  className="block w-full border-b border-slate-50 hover:bg-blue-50/40"
                  style={{ height: HOUR_H }}
                  aria-label={`Schedule at ${hour}:00`}
                />
              ))}
              {timed.map((event) => {
                const style = blockStyle(event);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(click) => { click.stopPropagation(); onOpen(event); }}
                    className={cx('absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-1 text-left text-white shadow-sm', EVENT_BAR[event.type] || 'bg-slate-500', event.conflict && 'ring-2 ring-rose-300')}
                    style={style}
                  >
                    <p className="truncate text-[11px] font-semibold">{event.title}</p>
                    <p className="truncate text-[10px] text-white/80">{formatClock(event.dueTime)} · {event.assigneeName}</p>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ cursor, events, today, onSlot, onOpen }) {
  const timed = events.filter((event) => !event.allDay);
  const allDay = events.filter((event) => event.allDay);
  return (
    <div className="grid md:grid-cols-[1fr_280px]">
      <div>
        {allDay.length > 0 && (
          <div className="space-y-1 border-b border-slate-100 p-3">
            {allDay.map((event) => (
              <button key={event.id} type="button" onClick={() => onOpen(event)} className={cx('block w-full rounded-xl px-3 py-2 text-left text-sm ring-1', EVENT_TONE[event.type])}>
                {eventIcon(event.type)} {event.title}
              </button>
            ))}
          </div>
        )}
        <div className="relative grid grid-cols-[72px_1fr]" style={{ height: HOURS.length * HOUR_H }}>
          <div>
            {HOURS.map((hour) => (
              <div key={hour} className="border-b border-slate-100 pr-2 text-right text-[11px] text-slate-400" style={{ height: HOUR_H }}>{formatClock(`${String(hour).padStart(2, '0')}:00`)}</div>
            ))}
          </div>
          <div className="relative">
            {HOURS.map((hour) => (
              <button key={hour} type="button" onClick={() => onSlot(`${String(hour).padStart(2, '0')}:00`)} className="block w-full border-b border-slate-50 hover:bg-blue-50/40" style={{ height: HOUR_H }} />
            ))}
            {timed.map((event) => {
              const style = blockStyle(event);
              return (
                <button key={event.id} type="button" onClick={() => onOpen(event)} className={cx('absolute inset-x-3 overflow-hidden rounded-xl px-3 py-2 text-left text-white shadow', EVENT_BAR[event.type] || 'bg-slate-500')} style={style}>
                  <p className="text-sm font-semibold">{event.title}</p>
                  <p className="text-xs text-white/80">{formatClock(event.dueTime)} · {event.assigneeName}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className={cx('border-t border-slate-100 p-4 md:border-l md:border-t-0', isoDay(cursor) === today && 'bg-blue-50/20')}>
        <p className="text-sm font-medium">Agenda</p>
        <div className="mt-3 space-y-2">
          {events.length === 0 && <p className="text-sm text-slate-400">Free day. Add a call or visit.</p>}
          {events.map((event) => (
            <button key={event.id} type="button" onClick={() => onOpen(event)} className="w-full rounded-2xl bg-white p-3 text-left ring-1 ring-slate-100">
              <p className="text-xs text-slate-400">{eventIcon(event.type)} {event.type}{event.dueTime ? ` · ${formatClock(event.dueTime)}` : ' · All day'}</p>
              <p className="font-medium">{event.title}</p>
              {event.location && <p className="text-xs text-slate-500">{event.location}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventForm({ editor, setEditor, leads, members, canManage, user, busy, error, onClose, onSubmit }) {
  const timed = isTimedEvent(editor.type);
  const visit = editor.type === 'Visit';
  const meeting = editor.type === 'Meeting' || editor.type === 'Demo';
  const set = (key, value) => {
    if (key === 'type') {
      setEditor((current) => ({
        ...current,
        type: value,
        dueTime: isTimedEvent(value) ? (current.dueTime || '11:00') : '',
        durationMinutes: EVENT_DURATION[value] || '',
        reminder: isTimedEvent(value) ? '1 hour before' : '1 day before',
        purpose: value === 'Visit' ? (current.purpose || 'Campus visit') : current.purpose,
      }));
      return;
    }
    setEditor((current) => ({ ...current, [key]: value }));
  };

  function toggleAttendee(id) {
    const ids = editor.attendeeIds || [];
    set('attendeeIds', ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  return (
    <Modal
      title={editor.id ? 'Edit schedule' : 'Add to calendar'}
      subtitle="Calls, demos, visits and follow-up work share the same calendar."
      onClose={onClose}
      wide
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          {QUICK.map(([value, hint]) => (
            <button key={value} type="button" onClick={() => set('type', value)} className={cx('rounded-full px-3 py-1.5 text-xs font-medium ring-1', editor.type === value ? 'bg-slate-900 text-white ring-slate-900' : 'text-slate-600 ring-slate-200')} title={hint}>
              {eventIcon(value)} {value === 'Send Proposal' ? 'Task' : value}
            </button>
          ))}
        </div>
        <Field label="Title">
          <input className="field" placeholder={`${editor.type} · college or contact`} value={editor.title} onChange={(event) => set('title', event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date *"><input className="field" type="date" required value={editor.dueDate} onChange={(event) => set('dueDate', event.target.value)} /></Field>
          <Field label={timed ? 'Time *' : 'Time (optional)'}>
            <input className="field" type="time" required={timed} value={editor.dueTime || ''} onChange={(event) => set('dueTime', event.target.value)} />
          </Field>
          {timed && (
            <Field label="Duration (minutes)">
              <input className="field" type="number" min="15" max="720" step="15" value={editor.durationMinutes} onChange={(event) => set('durationMinutes', event.target.value)} />
            </Field>
          )}
          <Field label="Reminder">
            <select className="field" value={editor.reminder} onChange={(event) => set('reminder', event.target.value)}>
              {REMINDERS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Related lead">
            <select className="field" value={editor.leadId || ''} onChange={(event) => set('leadId', event.target.value)}>
              <option value="">None</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="field" value={editor.priority} onChange={(event) => set('priority', event.target.value)}>
              {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          {canManage && (
            <Field label="Owner">
              <select className="field" value={editor.assigneeId || user?.id} onChange={(event) => set('assigneeId', event.target.value)}>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        {meeting && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meeting link"><input className="field" placeholder="https://meet.google.com/..." value={editor.meetingLink || ''} onChange={(event) => set('meetingLink', event.target.value)} /></Field>
            <Field label="Location"><input className="field" placeholder="Conference room or campus" value={editor.location || ''} onChange={(event) => set('location', event.target.value)} /></Field>
          </div>
        )}
        {visit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="College location *"><input className="field" required placeholder="ABC College, Pune" value={editor.location || ''} onChange={(event) => set('location', event.target.value)} /></Field>
            <Field label="Contact person"><input className="field" placeholder="Placement coordinator" value={editor.contactPerson || ''} onChange={(event) => set('contactPerson', event.target.value)} /></Field>
            <Field label="Purpose">
              <select className="field" value={editor.purpose || ''} onChange={(event) => set('purpose', event.target.value)}>
                {VISIT_PURPOSES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>
        )}
        {(meeting || visit) && canManage && (
          <Field label="Teammates attending" hint="Head of Sales can add people and see conflicts on their calendars.">
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button key={member.id} type="button" onClick={() => toggleAttendee(member.id)} className={cx('rounded-full px-3 py-1.5 text-xs ring-1', (editor.attendeeIds || []).includes(member.id) ? 'bg-slate-900 text-white ring-slate-900' : 'ring-slate-200 text-slate-600')}>
                  {member.name}
                </button>
              ))}
            </div>
          </Field>
        )}
        {(meeting || visit) && (
          <Field label="External attendees"><input className="field" placeholder="Names, comma separated" value={editor.attendees || ''} onChange={(event) => set('attendees', event.target.value)} /></Field>
        )}
        <Field label="Notes"><textarea className="field min-h-20" value={editor.details || ''} onChange={(event) => set('details', event.target.value)} /></Field>
        {!canManage && !editor.id && <p className="text-sm text-slate-500">Head of Sales will approve this before it is locked onto the team calendar.</p>}
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" type="submit" disabled={busy}>{busy && <Spinner />}{editor.id ? 'Save' : canManage ? 'Add to calendar' : 'Submit for approval'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EventDrawer({ event, canManage, onClose, onEdit, onComplete, onDelete }) {
  const awaiting = isAwaitingApproval(event);
  const overdue = isOverdue(event);
  const done = event.status === 'Completed';
  const status = followUpStatusLabel(event);
  const when = [
    dueLabel(event.dueDate),
    event.dueTime ? formatClock(event.dueTime) : 'All day',
    event.durationMinutes ? `${event.durationMinutes} min` : null,
  ].filter(Boolean).join(' · ');
  return (
    <Drawer title={event.type || 'Event'} onClose={onClose}>
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-5 px-6 py-6">
          {done && (
            <div className="rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
              This {event.type?.toLowerCase() || 'item'} is marked complete.
            </div>
          )}
          {overdue && !done && (
            <div className="rounded-2xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              Overdue — follow up as soon as you can.
            </div>
          )}
          {awaiting && (
            <div className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
              Waiting for Head of Sales to approve.
            </div>
          )}

          <div>
            <p className="text-[22px] font-semibold leading-snug tracking-tight text-slate-900">{event.title}</p>
            <p className="mt-1.5 text-[13px] text-slate-400">{when}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              <span className={cx('grid h-3.5 w-3.5 place-items-center rounded-[3px] text-[9px] ring-1', done ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-400 ring-slate-300')}>{done ? '✓' : ''}</span>
              {event.type}
            </span>
            <span className={cx(
              'rounded-full px-3 py-1.5 text-xs font-medium ring-1',
              done ? 'bg-slate-50 text-slate-600 ring-slate-200' : awaiting ? 'bg-amber-50 text-amber-800 ring-amber-100' : 'bg-blue-50 text-blue-700 ring-blue-100',
            )}>{status}</span>
            {overdue && !done && <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-100">Overdue</span>}
            {event.conflict && <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-100">Scheduling conflict</span>}
            {event.logged && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">Logged</span>}
          </div>

          {event.conflicts?.length > 0 && (
            <Banner tone="warn">Overlaps {event.conflicts.map((item) => item.title).join(', ')}. Move one so the same person is not double-booked.</Banner>
          )}

          <div className="divide-y divide-slate-100">
            {event.leadName && (
              <DetailRow label="Lead">
                <Link className="font-medium text-blue-600 hover:underline" to={`/leads/${event.leadId}`}>{event.leadName}</Link>
              </DetailRow>
            )}
            {event.dealName && (
              <DetailRow label="Deal">
                <Link className="font-medium text-blue-600 hover:underline" to={`/deals/${event.dealId}`}>{event.dealName}</Link>
              </DetailRow>
            )}
            <DetailRow label="Owner">{event.assigneeName || 'Unassigned'}</DetailRow>
            {event.attendeeNames?.length > 0 && <DetailRow label="Attendees">{event.attendeeNames.join(', ')}</DetailRow>}
            {event.location && <DetailRow label="Location">{event.location}</DetailRow>}
            {event.meetingLink && (
              <DetailRow label="Link">
                <a className="break-all text-blue-600 hover:underline" href={event.meetingLink} target="_blank" rel="noreferrer">{event.meetingLink}</a>
              </DetailRow>
            )}
            {event.contactPerson && <DetailRow label="Contact">{event.contactPerson}</DetailRow>}
            {event.purpose && <DetailRow label="Purpose">{event.purpose}</DetailRow>}
            {event.reminder && event.reminder !== 'None' && <DetailRow label="Reminder">{event.reminder}</DetailRow>}
            {event.details && <DetailRow label="Notes">{event.details}</DetailRow>}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-6 py-4">
          <div className="flex flex-wrap gap-2.5">
            {!awaiting && <button type="button" className="btn-ghost min-w-[88px]" onClick={onEdit}>Edit</button>}
            {!awaiting && (
              <button type="button" className={cx('btn-ghost min-w-[88px]', done && '!border-emerald-200 !bg-emerald-50 !text-emerald-800')} onClick={onComplete}>
                {done ? 'Reopen' : 'Mark done'}
              </button>
            )}
            {canLogMeeting(event.type) && !awaiting && (
              <Link className="btn min-w-[88px]" to={`/meeting-logs?event=${event.id}`}>{event.logged ? 'Open log' : 'Log meeting'}</Link>
            )}
            {(canManage || !awaiting) && <button type="button" className="btn-ghost min-w-[88px] !border-rose-100 !text-rose-500 hover:!bg-rose-50" onClick={onDelete}>Delete</button>}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start gap-6 py-3">
      <dt className="w-[88px] shrink-0 text-sm text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{children}</dd>
    </div>
  );
}
