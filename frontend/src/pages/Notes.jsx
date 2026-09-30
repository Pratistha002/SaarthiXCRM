import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ago, cx } from '../lib';
import { Avatar, Drawer, Field, Modal } from '../ui';

const STATUS = ['All', 'Pinned', 'Unlinked'];

function newestFirst(notes) {
  return [...notes].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function groupByLead(notes) {
  const leads = new Map();
  const other = [];
  for (const note of notes) {
    if (note.linkedType === 'lead' && note.linkedId) {
      const current = leads.get(note.linkedId) || {
        linkedId: note.linkedId,
        linkedName: note.linkedName || 'Lead',
        notes: [],
      };
      if (note.linkedName) current.linkedName = note.linkedName;
      current.notes.push(note);
      leads.set(note.linkedId, current);
    } else {
      other.push(note);
    }
  }
  const threads = [...leads.values()].map((thread) => {
    const notesNewest = newestFirst(thread.notes);
    return {
      ...thread,
      notes: notesNewest,
      count: notesNewest.length,
      preview: notesNewest[0]?.body || '',
      latestAt: notesNewest[0]?.createdAt,
      pinned: notesNewest.some((note) => note.pinned),
      authors: [...new Set(notesNewest.map((note) => note.authorName).filter(Boolean))],
    };
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.latestAt || 0) - new Date(a.latestAt || 0);
  });
  return { threads, other: newestFirst(other) };
}

export default function Notes() {
  const [params, setParams] = useSearchParams();
  const [pack, setPack] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [leadId, setLeadId] = useState(() => params.get('lead') || '');
  const [editor, setEditor] = useState(null);
  const [leads, setLeads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const [openLead, setOpenLead] = useState(null);
  const [draft, setDraft] = useState('');

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (status === 'Pinned') query.set('filter', 'Pinned');
    if (status === 'Unlinked') query.set('filter', 'Unlinked');
    if (leadId) query.set('leadId', leadId);
    setPack(await api(`/api/notes?${query.toString()}`));
  }

  useEffect(() => {
    const timer = setTimeout(() => { load().catch((err) => setError(err.message)); }, 200);
    return () => clearTimeout(timer);
  }, [q, status, leadId]);

  useEffect(() => {
    api('/api/leads').then((data) => setLeads(data.leads || [])).catch(() => {});
    api('/api/contacts').then((data) => setContacts(data.contacts || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const fromUrl = params.get('lead') || '';
    if (fromUrl) {
      setLeadId(fromUrl);
      setOpenLead(fromUrl);
    }
    // Keep the first URL lead so a shared /notes?lead=… link opens that thread once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const notes = pack?.notes || [];
    const scoped = leadId
      ? notes.filter((note) => note.linkedType === 'lead' && note.linkedId === leadId)
      : notes;
    return groupByLead(scoped);
  }, [pack, leadId]);
  const leadOptions = useMemo(
    () => [...leads].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [leads],
  );
  const selectedLead = leads.find((lead) => lead.id === leadId) || null;
  const activeThread = openLead
    ? grouped.threads.find((thread) => thread.linkedId === openLead) || (
      selectedLead && selectedLead.id === openLead
        ? { linkedId: selectedLead.id, linkedName: selectedLead.name, notes: [], count: 0, pinned: false }
        : null
    )
    : null;

  function chooseLead(id) {
    setLeadId(id);
    setOpenLead(id || null);
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id);
    else next.delete('lead');
    setParams(next, { replace: true });
  }

  function openNew(forLead) {
    const lead = forLead || selectedLead;
    setEditor({
      body: '',
      pinned: false,
      link: lead ? `lead:${lead.id || lead.linkedId}` : '',
    });
  }

  async function save(event) {
    event.preventDefault();
    const [type, id] = (editor.link || '').split(':');
    const source = type === 'lead' ? leads : contacts;
    const linked = source.find((item) => item.id === id);
    const body = {
      body: editor.body,
      pinned: Boolean(editor.pinned),
      linkedType: linked ? type : '',
      linkedId: linked ? id : '',
      linkedName: linked ? linked.name : '',
    };
    try {
      if (editor.id) await api(`/api/notes/${editor.id}`, { method: 'PUT', body });
      else await api('/api/notes', { method: 'POST', body });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addToLead(event) {
    event.preventDefault();
    if (!draft.trim() || !activeThread) return;
    try {
      await api('/api/notes', {
        method: 'POST',
        body: {
          body: draft.trim(),
          linkedType: 'lead',
          linkedId: activeThread.linkedId,
          linkedName: activeThread.linkedName,
        },
      });
      setDraft('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function pin(note) {
    await api(`/api/notes/${note.id}/pin`, { method: 'PATCH' });
    await load();
  }

  async function remove(note) {
    if (!window.confirm('Delete this note?')) return;
    await api(`/api/notes/${note.id}`, { method: 'DELETE' });
    await load();
  }

  const summary = pack?.summary;
  const emptyLead = Boolean(leadId) && grouped.threads.length === 0 && status !== 'Unlinked';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <NoteGlyph />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
            <p className="mt-1 text-sm text-slate-500">One thread per lead, newest first — from the lead page, a call, or here.</p>
          </div>
        </div>
        <button type="button" className="btn" onClick={() => openNew()}>+ New note</button>
      </div>

      {summary && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total notes', summary.total, 'bg-blue-50 text-blue-700', 'All captured'],
            ['Pinned', summary.pinned, 'bg-amber-50 text-amber-700', 'Kept on top'],
            ['Linked', summary.linked, 'bg-emerald-50 text-emerald-700', 'Tied to a lead'],
            ['Unlinked', summary.unlinked, 'bg-slate-100 text-slate-600', 'Not assigned yet'],
          ].map(([label, value, tone, hint]) => (
            <div key={label} className="card !p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{hint}</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchGlyph />
              </span>
              <input className="field !rounded-2xl !pl-10" placeholder="Search topics, colleges, people…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <select
              className="field lg:max-w-sm !rounded-2xl"
              value={leadId}
              onChange={(event) => chooseLead(event.target.value)}
            >
              <option value="">All leads</option>
              {leadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}{lead.company && lead.company !== lead.name ? ` · ${lead.company}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setStatus(item);
                  if (item === 'Unlinked') chooseLead('');
                }}
                className={cx(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                  status === item ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                )}
              >
                {item}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="p-5">
          {status !== 'Unlinked' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead threads</p>
                <p className="text-xs text-slate-400">{grouped.threads.length} {grouped.threads.length === 1 ? 'lead' : 'leads'}</p>
              </div>
              <div className="space-y-3">
                {grouped.threads.map((thread) => (
                  <button
                    key={thread.linkedId}
                    type="button"
                    onClick={() => setOpenLead(thread.linkedId)}
                    className="group flex w-full items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_1px_0_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md"
                  >
                    <Avatar name={thread.linkedName} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{thread.linkedName}</span>
                        {thread.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
                            <PinGlyph className="h-3 w-3" /> Pinned
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          {thread.count} {thread.count === 1 ? 'note' : 'notes'}
                        </span>
                      </span>
                      <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-slate-600">{thread.preview}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>Updated {ago(thread.latestAt)}</span>
                        {thread.authors.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-300">·</span>
                            {thread.authors.slice(0, 3).join(', ')}
                            {thread.authors.length > 3 ? ` +${thread.authors.length - 3}` : ''}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="mt-1 text-sm font-medium text-blue-700 opacity-80 group-hover:opacity-100">Open</span>
                  </button>
                ))}
              </div>
              {emptyLead && selectedLead && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
                  <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-amber-500 ring-1 ring-slate-100">
                    <NoteGlyph />
                  </span>
                  <p className="font-medium text-slate-800">No notes on {selectedLead.name} yet</p>
                  <p className="mt-1 text-sm text-slate-500">Notes added from the lead page, a call, or here will all show in this thread.</p>
                  <button type="button" className="btn mt-4" onClick={() => openNew(selectedLead)}>Add a note</button>
                </div>
              )}
              {grouped.threads.length === 0 && !emptyLead && (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-600">No lead notes in this view</p>
                  <p className="mt-1 text-sm text-slate-400">Try another filter, or write the first note.</p>
                </div>
              )}
            </div>
          )}

          {(status === 'Unlinked' || grouped.other.length > 0) && status !== 'Pinned' && !leadId && (
            <div className={status === 'Unlinked' ? '' : 'mt-8'}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {status === 'Unlinked' ? 'Unlinked notes' : 'Other notes'}
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {grouped.other.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onPin={() => pin(note)}
                    onEdit={() => setEditor({ ...note, link: note.linkedId ? `${note.linkedType}:${note.linkedId}` : '' })}
                    onDelete={() => remove(note)}
                  />
                ))}
              </div>
              {grouped.other.length === 0 && status === 'Unlinked' && (
                <p className="py-10 text-center text-sm text-slate-400">No unlinked notes.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {activeThread && (
        <Drawer title={activeThread.linkedName} onClose={() => { setOpenLead(null); setDraft(''); }}>
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={activeThread.linkedName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{activeThread.linkedName}</p>
                  <p className="text-xs text-slate-400">{activeThread.count} {activeThread.count === 1 ? 'note' : 'notes'} · newest first</p>
                </div>
                <Link className="text-sm font-medium text-blue-700" to={`/leads/${activeThread.linkedId}`}>Open lead</Link>
              </div>
              <form onSubmit={addToLead}>
                <textarea className="field min-h-24 !rounded-2xl" placeholder={`Write a note on ${activeThread.linkedName}…`} value={draft} onChange={(event) => setDraft(event.target.value)} />
                <div className="mt-2 flex justify-end">
                  <button className="btn" type="submit" disabled={!draft.trim()}>Add to thread</button>
                </div>
              </form>
            </div>
            <div className="space-y-3 overflow-auto px-5 py-4">
              {activeThread.notes.map((note) => (
                <article key={note.id} className={cx('rounded-2xl p-4 ring-1', note.pinned ? 'bg-amber-50/80 ring-amber-100' : 'bg-slate-50 ring-slate-100')}>
                  <div className="flex items-start gap-3">
                    <Avatar name={note.authorName || 'You'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{note.authorName || 'You'}</p>
                          <p className="text-[11px] text-slate-400">{ago(note.createdAt)}</p>
                        </div>
                        <PinButton pinned={note.pinned} onClick={() => pin(note)} />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.body}</p>
                      <div className="mt-3 flex gap-3 text-xs">
                        <button type="button" className="font-medium text-slate-500 hover:text-slate-800" onClick={() => setEditor({ ...note, link: `lead:${activeThread.linkedId}` })}>Edit</button>
                        <button type="button" className="font-medium text-rose-500 hover:text-rose-700" onClick={() => remove(note)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {activeThread.notes.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">No notes on this lead yet. Start the thread above.</p>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {editor && (
        <Modal title={editor.id ? 'Edit note' : 'New note'} subtitle="Link it to a lead so it joins that lead’s note thread." onClose={() => setEditor(null)}>
          <form className="space-y-3" onSubmit={save}>
            <Field label="Note"><textarea className="field min-h-28" required value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} /></Field>
            <Field label="Lead">
              <select className="field" value={editor.link || ''} onChange={(event) => setEditor({ ...editor, link: event.target.value })}>
                <option value="">Unlinked</option>
                <optgroup label="Leads">
                  {leadOptions.map((lead) => <option key={lead.id} value={`lead:${lead.id}`}>{lead.name}</option>)}
                </optgroup>
                <optgroup label="Contacts">
                  {contacts.map((contact) => <option key={contact.id} value={`contact:${contact.id}`}>{contact.name}</option>)}
                </optgroup>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editor.pinned)} onChange={(event) => setEditor({ ...editor, pinned: event.target.checked })} /> Pin this note</label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn" type="submit">Save note</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function NoteCard({ note, onPin, onEdit, onDelete }) {
  return (
    <article className={cx('flex h-full flex-col rounded-2xl border p-4', note.pinned ? 'border-amber-100 bg-amber-50/50' : 'border-slate-100 bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={note.authorName || 'Note'} size="sm" />
          <div>
            <p className="text-sm font-medium text-slate-800">{note.authorName || 'You'}</p>
            <p className="text-[11px] text-slate-400">{ago(note.createdAt)}</p>
          </div>
        </div>
        <PinButton pinned={note.pinned} onClick={onPin} />
      </div>
      <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.body}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="rounded-full bg-slate-100 px-2 py-0.5">{note.linkedName ? note.linkedName : 'Unlinked'}</span>
        <span className="flex gap-3">
          <button type="button" className="font-medium hover:text-slate-700" onClick={onEdit}>Edit</button>
          <button type="button" className="font-medium text-rose-400 hover:text-rose-600" onClick={onDelete}>Delete</button>
        </span>
      </div>
    </article>
  );
}

function PinButton({ pinned, onClick }) {
  return (
    <button
      type="button"
      className={cx('grid h-8 w-8 place-items-center rounded-full transition', pinned ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500')}
      onClick={onClick}
      aria-label={pinned ? 'Unpin note' : 'Pin note'}
    >
      <PinGlyph className="h-4 w-4" />
    </button>
  );
}

function NoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4h8l4 4v12H7z" />
      <path d="M15 4v4h4M9 13h6M9 17h4" />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function PinGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M14.5 3.5 20 9l-1.2 1.2-2.1-.3-3.4 3.4V21l-2.6-3.8-3.2 1.1 1.6-4.6-2.2-2.2-.3-2.1L8.8 8.4 14.5 3.5z" />
    </svg>
  );
}
