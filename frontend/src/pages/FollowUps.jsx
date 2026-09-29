import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PRIORITIES, canSeeTeamData, cx, dueLabel, followUpStatusLabel, isAwaitingApproval, isOverdue, isoDay, weekDays } from '../lib';
import { useAuth } from '../auth';
import { useTeam } from '../useTeam';
import { Avatar, Field, Modal, PriorityPill } from '../ui';

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
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-slate-500">{canAssign ? 'Approve teammate follow-ups, then keep every commitment on track.' : 'New follow-ups go to Head of Sales for approval before you can edit them.'}</p>
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
            onEdit={(task) => { if (canAssign || !isAwaitingApproval(task)) setEditor(task); }}
          />
        ) : (
          <>
            {filter === 'All' && overdue.length > 0 && <Section title={`Overdue ${overdue.length}`} danger tasks={overdue} canAssign={canAssign} onToggle={complete} onEdit={setEditor} onDelete={remove} onApprove={approve} />}
            <Section title={filter === 'All' ? 'Up next' : filter} tasks={filter === 'All' ? rest : tasks} canAssign={canAssign} onToggle={complete} onEdit={setEditor} onDelete={remove} onApprove={approve} />
            {tasks.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No follow-ups in this view.</p>}
          </>
        )}
      </div>

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

function Section({ title, tasks, canAssign, onToggle, onEdit, onDelete, onApprove, danger }) {
  if (!tasks.length) return null;
  return (
    <div className="mb-4">
      <p className={cx('mb-2 text-xs font-semibold uppercase tracking-wide', danger ? 'text-rose-500' : 'text-slate-400')}>{title}</p>
      <div className="divide-y divide-slate-100">
        {tasks.map((task) => {
          const awaiting = isAwaitingApproval(task);
          const canEdit = canAssign || !awaiting;
          return (
          <div key={task.id} className="flex items-start gap-3 py-3">
            <button type="button" onClick={() => onToggle(task)} disabled={awaiting} className={cx('mt-1 h-5 w-5 rounded-full border', task.status === 'Completed' ? 'border-blue-600 bg-blue-600' : 'border-slate-300', awaiting && 'opacity-40')} aria-label="Toggle complete" />
            <div className="min-w-0 flex-1">
              <p className={cx('font-medium', task.status === 'Completed' && 'text-slate-400 line-through')}>{task.title}</p>
              {task.details && <p className="text-sm text-slate-500">{task.details}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {isOverdue(task) && <span className="text-rose-500">△ Overdue · {dueLabel(task.dueDate)}</span>}
                {!isOverdue(task) && <span className="text-slate-400">{dueLabel(task.dueDate)}</span>}
                <PriorityPill value={task.priority} />
                <span className={cx('rounded-full px-2 py-0.5', awaiting ? 'bg-amber-50 text-amber-700' : followUpStatusLabel(task) === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-600')}>{followUpStatusLabel(task)}</span>
                {task.assigneeName && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Avatar name={task.assigneeName} size="sm" />
                    {task.assigneeName}
                  </span>
                )}
              </div>
            </div>
            {awaiting && canAssign && (
              <button type="button" className="text-xs font-medium text-emerald-600" onClick={() => onApprove(task)}>Approve</button>
            )}
            {canEdit ? <button type="button" className="text-xs text-slate-400" onClick={() => onEdit(task)}>Edit</button> : <span className="text-xs text-amber-600">Waiting for approval</span>}
            <button type="button" className="text-xs text-rose-400" onClick={() => onDelete(task)}>Delete</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
