import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PRIORITIES, canSeeTeamData, cx, dueLabel, followUpStatusLabel, formatClock, isAwaitingApproval, isOverdue, isoDay, weekDays } from '../lib';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import { Avatar, Drawer, Field, Modal, PriorityPill } from '../ui';

const TABS = ['All', 'Awaiting Approval', 'Pending', 'In Progress', 'Approved', 'Completed', 'Overdue'];
const EMPTY = { title: '', details: '', dueDate: '', priority: 'Medium', status: 'Pending', leadId: '', assigneeId: '' };
const WORK_STATUSES = ['Pending', 'In Progress', 'Approved', 'Completed'];

export default function FollowUps() {
  const { user } = useAuth();
  const { members } = useTeam();
  const canAssign = canSeeTeamData(user);
  const [params, setParams] = useSearchParams();
  const [pack, setPack] = useState(null);
  const [filter, setFilter] = useState(() => params.get('filter') || 'All');
  const [editor, setEditor] = useState(null);
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [view, setView] = useState('list');
  const [viewing, setViewing] = useState(null);
  const [weekStart, setWeekStart] = useState(() => weekDays()[0]);

  async function load(next = filter) {
    const query = next === 'All' ? '' : `?filter=${encodeURIComponent(next)}`;
    setPack(await api(`/api/followups${query}`));
  }

  useEffect(() => { load(view === 'week' ? 'All' : filter).catch((err) => setError(err.message)); }, [filter, view]);
  useEffect(() => { api('/api/leads').then((data) => setLeads(data.leads)).catch(() => {}); }, []);
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditor({ ...EMPTY, dueDate: isoDay(new Date()), assigneeId: user?.id || '' });
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  async function save(event) {
    event.preventDefault();
    setError('');
    const body = { ...editor, assigneeId: editor.assigneeId || user?.id };
    try {
      if (editor.id) await api(`/api/followups/${editor.id}`, { method: 'PUT', body });
      else await api('/api/followups', { method: 'POST', body });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function approve(task) {
    setError('');
    try {
      await api(`/api/followups/${task.id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function complete(task) {
    if (isAwaitingApproval(task)) return;
    const status = task.status === 'Completed' ? 'Pending' : 'Completed';
    await api(`/api/followups/${task.id}/status`, { method: 'PATCH', body: { status } });
    await load();
  }

  async function remove(task) {
    if (!window.confirm('Delete this follow-up?')) return;
    await api(`/api/followups/${task.id}`, { method: 'DELETE' });
    await load();
  }

  const summary = pack?.summary;
  const tasks = pack?.tasks || [];
  const overdue = tasks.filter((task) => isOverdue(task));
  const rest = tasks.filter((task) => !isOverdue(task));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" /></svg>
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Follow-ups</h1>
            <p className="mt-1 text-sm text-slate-500">{canAssign ? 'Approve teammate follow-ups, then keep every commitment on track.' : 'New follow-ups go to Head of Sales for approval before you can edit them.'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium">
            {['list', 'week'].map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={cx('rounded-full px-3 py-1.5 capitalize', view === item ? 'bg-blue-600 text-white' : 'text-slate-500')}>{item}</button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setEditor({ ...EMPTY, dueDate: isoDay(new Date()), assigneeId: user?.id || '' })}>+ Add task</button>
        </div>
      </div>
      {summary && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Total tasks', summary.total, 'All', 'bg-white'],
              ['Awaiting approval', summary.awaiting || 0, 'Awaiting Approval', 'bg-white'],
              ['Pending', summary.pending, 'Pending', 'bg-white'],
              ['Overdue', summary.overdue, 'Overdue', 'bg-white'],
              ['Completed', summary.completed, 'Completed', 'bg-gradient-to-br from-sky-500 to-blue-700 text-white'],
            ].map(([label, value, key, tone]) => (
              <button key={label} type="button" onClick={() => setFilter(key)} className={cx('rounded-3xl p-5 text-left shadow-sm ring-1 ring-slate-200/70', tone, filter === key && key !== 'Completed' && 'ring-2 ring-blue-400')}>
                <p className="text-3xl font-semibold">{value}</p>
                <p className={cx('text-sm', key === 'Completed' ? 'text-white/80' : 'text-slate-500')}>{label}</p>
              </button>
            ))}
          </div>
          <div className="card mb-4 !py-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>{summary.completed} of {summary.total} tasks done</span>
              <span className="font-medium text-blue-600">{summary.donePct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${summary.donePct}%` }} />
            </div>
          </div>
        </>
      )}
      <div className="card">
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => setFilter(tab)} className={cx('rounded-full px-3 py-1.5 text-sm', filter === tab ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}>{tab}</button>
          ))}
        </div>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        {view === 'week' ? (
          <WeekBoard
            tasks={pack?.tasks || []}
            start={weekStart}
            onPrev={() => setWeekStart((current) => { const next = new Date(current); next.setDate(current.getDate() - 7); return next; })}
            onNext={() => setWeekStart((current) => { const next = new Date(current); next.setDate(current.getDate() + 7); return next; })}
            onToday={() => setWeekStart(weekDays()[0])}
            onSelect={(day) => setEditor({ ...EMPTY, dueDate: isoDay(day), assigneeId: user?.id || '' })}
            onEdit={setViewing}
          />
        ) : (
          <>
            {filter === 'All' && overdue.length > 0 && <Section title={`Overdue ${overdue.length}`} danger tasks={overdue} canAssign={canAssign} onToggle={complete} onView={setViewing} onEdit={setEditor} onDelete={remove} onApprove={approve} />}
            <Section title={filter === 'All' ? 'Up next' : filter} tasks={filter === 'All' ? rest : tasks} canAssign={canAssign} onToggle={complete} onView={setViewing} onEdit={setEditor} onDelete={remove} onApprove={approve} />
            {tasks.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No follow-ups in this view.</p>}
          </>
        )}
      </div>

      {viewing && (
        <TaskDrawer
          task={viewing}
          canAssign={canAssign}
          onClose={() => setViewing(null)}
          onEdit={() => { setViewing(null); if (canAssign || !isAwaitingApproval(viewing)) setEditor(viewing); }}
          onComplete={() => { complete(viewing); setViewing(null); }}
          onDelete={() => { remove(viewing); setViewing(null); }}
          onApprove={() => { approve(viewing); setViewing(null); }}
        />
      )}

      {editor && (
        <Modal title={editor.id ? 'Edit task' : 'New task'} subtitle={canAssign || editor.id ? 'Give it a date so it shows up before it slips.' : 'Head of Sales will approve this before you can edit it.'} onClose={() => setEditor(null)}>
          <form className="space-y-3" onSubmit={save}>
            <Field label="Title"><input className="field" required value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></Field>
            <Field label="Details"><textarea className="field min-h-20" value={editor.details || ''} onChange={(event) => setEditor({ ...editor, details: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date"><input className="field" type="date" required value={editor.dueDate} onChange={(event) => setEditor({ ...editor, dueDate: event.target.value })} /></Field>
              <Field label="Priority">
                <select className="field" value={editor.priority} onChange={(event) => setEditor({ ...editor, priority: event.target.value })}>
                  {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              {(canAssign || editor.id) && (
              <Field label="Status">
                <select className="field" value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value })}>
                  {WORK_STATUSES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              )}
              <Field label="Related lead">
                <select className="field" value={editor.leadId || ''} onChange={(event) => setEditor({ ...editor, leadId: event.target.value })}>
                  <option value="">None</option>
                  {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                </select>
              </Field>
              {canAssign && (
              <Field label="Assignee">
                <select className="field" value={editor.assigneeId || user?.id || ''} onChange={(event) => setEditor({ ...editor, assigneeId: event.target.value })}>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              )}
            </div>
            {!canAssign && !editor.id && (
              <p className="text-sm text-slate-500">This follow-up will be sent to Head of Sales for approval. You can edit it after it is approved.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn" type="submit">{editor.id ? 'Save task' : canAssign ? 'Save task' : 'Submit for approval'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function WeekBoard({ tasks, start, onPrev, onNext, onToday, onSelect, onEdit }) {
  const days = weekDays(start);
  const today = isoDay(new Date());
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium">{dueLabel(isoDay(days[0]))} – {dueLabel(isoDay(days[6]))}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost !px-3" onClick={onPrev}>←</button>
          <button type="button" className="btn-ghost !px-3" onClick={onToday}>This week</button>
          <button type="button" className="btn-ghost !px-3" onClick={onNext}>→</button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((day) => {
          const key = isoDay(day);
          const items = tasks.filter((task) => task.dueDate === key);
          return (
            <button key={key} type="button" onClick={() => onSelect(day)} className={cx('min-h-40 rounded-2xl border p-2 text-left', key === today ? 'border-blue-400 bg-blue-50/60' : 'border-slate-100')}>
              <p className="text-xs font-medium text-slate-500">{day.toLocaleDateString('en-GB', { weekday: 'short' })} {day.getDate()}</p>
              <div className="mt-2 space-y-2">
                {items.map((task) => (
                  <div key={task.id} className="rounded-xl bg-white p-2 text-xs shadow-sm ring-1 ring-slate-100" onClick={(event) => { event.stopPropagation(); onEdit(task); }}>
                    <p className="font-medium text-slate-800">{task.title}</p>
                    <p className="text-slate-400">{task.assigneeName}</p>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, tasks, canAssign, onToggle, onView, onEdit, onDelete, onApprove, danger }) {
  if (!tasks.length) return null;
  return (
    <div className="mb-4">
      <p className={cx('mb-2 text-xs font-semibold uppercase tracking-wide', danger ? 'text-rose-500' : 'text-slate-400')}>{title}</p>
      <div className="space-y-2">
        {tasks.map((task) => {
          const awaiting = isAwaitingApproval(task);
          const canEdit = canAssign || !awaiting;
          const done = task.status === 'Completed';
          return (
          <div key={task.id} className={cx('flex items-start gap-3 rounded-2xl border px-3 py-3 transition', done ? 'border-slate-100 bg-slate-50/70' : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/30')}>
            <button type="button" onClick={() => onToggle(task)} disabled={awaiting} className={cx('mt-1 grid h-5 w-5 place-items-center rounded-full border', done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300', awaiting && 'opacity-40')} aria-label="Toggle complete">
              {done && <span className="text-[10px] leading-none">✓</span>}
            </button>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onView(task)}>
              <p className={cx('font-medium', done && 'text-slate-400 line-through')}>{task.title}</p>
              {task.details && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{task.details}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {isOverdue(task) && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-600">Overdue · {dueLabel(task.dueDate)}</span>}
                {!isOverdue(task) && <span className="text-slate-400">{dueLabel(task.dueDate)}</span>}
                <PriorityPill value={task.priority} />
                <span className={cx('rounded-full px-2 py-0.5', awaiting ? 'bg-amber-50 text-amber-700' : followUpStatusLabel(task) === 'Approved' ? 'bg-emerald-50 text-emerald-700' : followUpStatusLabel(task) === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-600')}>{followUpStatusLabel(task)}</span>
                {task.assigneeName && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Avatar name={task.assigneeName} size="sm" />
                    {task.assigneeName}
                  </span>
                )}
              </div>
            </button>
            {awaiting && canAssign && (
              <button type="button" className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700" onClick={() => onApprove(task)}>Approve</button>
            )}
            {canEdit ? <button type="button" className="text-xs font-medium text-slate-400 hover:text-slate-700" onClick={() => onEdit(task)}>Edit</button> : <span className="text-xs text-amber-600">Waiting</span>}
            <button type="button" className="text-xs font-medium text-rose-400 hover:text-rose-600" onClick={() => onDelete(task)}>Delete</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskDrawer({ task, canAssign, onClose, onEdit, onComplete, onDelete, onApprove }) {
  const awaiting = isAwaitingApproval(task);
  const overdue = isOverdue(task);
  const done = task.status === 'Completed';
  const status = followUpStatusLabel(task);
  const canEdit = canAssign || !awaiting;
  const when = [
    dueLabel(task.dueDate),
    task.dueTime ? formatClock(task.dueTime) : null,
    task.durationMinutes ? `${task.durationMinutes} min` : null,
  ].filter(Boolean).join(' · ');
  return (
    <Drawer title={task.type || 'Follow-up'} onClose={onClose}>
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-5 px-6 py-6">
          {done && (
            <div className="rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
              This follow-up is marked complete.
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
            <p className="text-[22px] font-semibold leading-snug tracking-tight text-slate-900">{task.title}</p>
            {when && <p className="mt-1.5 text-[13px] text-slate-400">{when}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              <span className={cx('grid h-3.5 w-3.5 place-items-center rounded-[3px] text-[9px] ring-1', done ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-400 ring-slate-300')}>{done ? '✓' : ''}</span>
              {task.type || 'Follow-up'}
            </span>
            <span className={cx(
              'rounded-full px-3 py-1.5 text-xs font-medium ring-1',
              done ? 'bg-slate-50 text-slate-600 ring-slate-200' : awaiting ? 'bg-amber-50 text-amber-800 ring-amber-100' : 'bg-blue-50 text-blue-700 ring-blue-100',
            )}>{status}</span>
            {task.priority && <PriorityPill value={task.priority} />}
            {overdue && !done && <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-100">Overdue</span>}
          </div>

          <div className="divide-y divide-slate-100">
            {task.leadName && (
              <DetailRow label="Lead">
                <Link className="font-medium text-blue-600 hover:underline" to={`/leads/${task.leadId}`}>{task.leadName}</Link>
              </DetailRow>
            )}
            {task.dealName && (
              <DetailRow label="Deal">
                <Link className="font-medium text-blue-600 hover:underline" to={`/deals/${task.dealId}`}>{task.dealName}</Link>
              </DetailRow>
            )}
            <DetailRow label="Owner">{task.assigneeName || 'Unassigned'}</DetailRow>
            {task.reminder && task.reminder !== 'None' && <DetailRow label="Reminder">{task.reminder}</DetailRow>}
            {task.details && <DetailRow label="Notes">{task.details}</DetailRow>}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-6 py-4">
          <div className="flex flex-wrap gap-2.5">
            {canEdit && <button type="button" className="btn-ghost min-w-[88px]" onClick={onEdit}>Edit</button>}
            {!awaiting && (
              <button type="button" className={cx('btn-ghost min-w-[88px]', done && '!border-emerald-200 !bg-emerald-50 !text-emerald-800')} onClick={onComplete}>
                {done ? 'Reopen' : 'Mark done'}
              </button>
            )}
            {awaiting && canAssign && <button type="button" className="btn min-w-[88px]" onClick={onApprove}>Approve</button>}
            {(canAssign || !awaiting) && <button type="button" className="btn-ghost min-w-[88px] !border-rose-100 !text-rose-500 hover:!bg-rose-50" onClick={onDelete}>Delete</button>}
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
