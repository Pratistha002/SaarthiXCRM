import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { STAGES, closeReasons, compact, cx, money, stageDot } from '../lib';
import { Avatar, Field, Modal, PriorityPill } from '../ui';

export default function Pipeline() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState('');
  const [closing, setClosing] = useState(null);

  async function load() {
    const data = await api('/api/leads');
    setLeads(data.leads);
    setSummary(data.summary);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function drop(stage, event) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    setDragOver('');
    if (!id) return;
    if (stage === 'Won' || stage === 'Lost') {
      const lead = leads.find((item) => item.id === id);
      setClosing({ id, stage, name: lead?.name || 'this deal', closeReason: '', closeNote: '' });
      return;
    }
    await move(id, { stage });
  }

  async function move(id, body) {
    setLeads((rows) => rows.map((lead) => lead.id === id ? { ...lead, stage: body.stage } : lead));
    try {
      await api(`/api/leads/${id}/stage`, { method: 'PATCH', body });
      await load();
    } catch (err) {
      setError(err.message);
      await load();
    }
  }

  const won = summary?.stages?.Won || 0;
  const lost = summary?.stages?.Lost || 0;
  const decided = won + lost;
  const winRate = decided ? Math.round((won / decided) * 100) : 0;
  const open = (summary?.total || 0) - won - lost;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-slate-500">{summary?.total || 0} leads · {compact(summary?.openPipeline || 0)} in play</p>
      </div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total pipeline', compact(summary?.totalValue || 0)],
          ['Open deals', open],
          ['Won value', compact(summary?.wonValue || 0)],
          ['Weighted forecast', compact(summary?.forecast || 0)],
        ].map(([label, value]) => (
          <div key={label} className="card !p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        {STAGES.map((stage) => {
          const column = leads.filter((lead) => lead.stage === stage);
          const value = column.reduce((sum, lead) => sum + lead.value, 0);
          return (
            <section
              key={stage}
              onDragOver={(event) => { event.preventDefault(); setDragOver(stage); }}
              onDragLeave={() => setDragOver('')}
              onDrop={(event) => drop(stage, event)}
              className={cx('rounded-3xl bg-slate-100/80 p-3', dragOver === stage && 'ring-2 ring-blue-400')}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: stageDot[stage] }} />
                  {stage} <span className="font-medium text-slate-400">{column.length}</span>
                </p>
                <p className="text-xs text-slate-400">{compact(value)}</p>
              </div>
              <div className="space-y-3">
                {column.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', lead.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                    className="cursor-grab rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <Avatar name={lead.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button type="button" className="block truncate text-left text-sm font-semibold" onClick={() => navigate(`/leads?lead=${lead.id}`)}>{lead.name}</button>
                        <p className="truncate text-xs text-slate-400">{lead.company}{lead.ownerName ? ` · ${lead.ownerName}` : ''}</p>
                      </div>
                      <span className="text-slate-300">⋮</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">{money(lead.value)}</span>
                      <PriorityPill value={lead.priority} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {closing && (
        <Modal title={`Mark as ${closing.stage}`} subtitle={`${closing.name} needs a reason so the team can see why the number moved.`} onClose={() => setClosing(null)}>
          <form className="space-y-3" onSubmit={async (event) => {
            event.preventDefault();
            await move(closing.id, { stage: closing.stage, closeReason: closing.closeReason, closeNote: closing.closeNote });
            setClosing(null);
          }}>
            <Field label="Reason">
              <select className="field" required value={closing.closeReason} onChange={(event) => setClosing({ ...closing, closeReason: event.target.value })}>
                <option value="">Choose a reason</option>
                {closeReasons(closing.stage).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Optional note">
              <textarea className="field min-h-20" value={closing.closeNote} onChange={(event) => setClosing({ ...closing, closeNote: event.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setClosing(null)}>Cancel</button>
              <button className="btn" type="submit">Save {closing.stage.toLowerCase()}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
