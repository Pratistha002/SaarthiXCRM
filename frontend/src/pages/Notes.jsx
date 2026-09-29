import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ago, cx } from '../lib';
import { Drawer, Field, Modal } from '../ui';

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-slate-500">Every note on a lead lives in one place, newest first — no matter where it was written.</p>
        </div>
        <button type="button" className="btn" onClick={() => openNew()}>+ New note</button>
      </div>
      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total notes', summary.total],
            ['Pinned', summary.pinned],
            ['Linked', summary.linked],
            ['Unlinked', summary.unlinked],
          ].map(([label, value]) => (
            <div key={label} className="card !p-4">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input className="field flex-1" placeholder="Search notes…" value={q} onChange={(event) => setQ(event.target.value)} />
          <select
            className="field lg:max-w-sm"
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
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setStatus(item);
                if (item === 'Unlinked') chooseLead('');
              }}
              className={cx('rounded-full px-3 py-1.5 text-sm', status === item ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
            >
              {item}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        {status !== 'Unlinked' && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Leads</p>
            {grouped.threads.map((thread) => (
              <button
                key={thread.linkedId}
                type="button"
                onClick={() => setOpenLead(thread.linkedId)}
                className="flex w-full items-start gap-4 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                  {thread.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{thread.linkedName}</span>
                    {thread.pinned && <span className="text-sky-500">⌖</span>}
                    <span className="text-xs text-slate-400">{thread.count} {thread.count === 1 ? 'note' : 'notes'}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{thread.preview}</span>
                  <span className="mt-2 block text-xs text-slate-400">
                    Latest {ago(thread.latestAt)}
                    {thread.authors.length ? ` · ${thread.authors.join(', ')}` : ''}
                  </span>
                </span>
                <span className="text-sm font-medium text-blue-700">View all</span>
              </button>
            ))}
            {emptyLead && selectedLead && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                <p className="font-medium text-slate-800">No notes on {selectedLead.name} yet</p>
                <p className="mt-1 text-sm text-slate-500">Notes added from the lead page, a call, or here will all show in this thread.</p>
                <button type="button" className="btn mt-4" onClick={() => openNew(selectedLead)}>Add a note</button>
              </div>
            )}
            {grouped.threads.length === 0 && !emptyLead && (
              <p className="py-8 text-center text-sm text-slate-400">No lead notes in this view.</p>
            )}
          </div>
        )}

        {(status === 'Unlinked' || grouped.other.length > 0) && status !== 'Pinned' && !leadId && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {status === 'Unlinked' ? 'Unlinked notes' : 'Other notes'}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {grouped.other.map((note) => (
                <article key={note.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.body}</p>
                    <button type="button" className={cx('text-lg', note.pinned ? 'text-sky-500' : 'text-slate-300')} onClick={() => pin(note)} aria-label="Pin">⌖</button>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>{note.linkedName ? `↔ ${note.linkedName}` : 'Unlinked'}</span>
                    <span>{ago(note.createdAt)}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditor({ ...note, link: note.linkedId ? `${note.linkedType}:${note.linkedId}` : '' })}>Edit</button>
                      <button type="button" className="text-rose-400" onClick={() => remove(note)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {grouped.other.length === 0 && status === 'Unlinked' && (
              <p className="py-8 text-center text-sm text-slate-400">No unlinked notes.</p>
            )}
          </div>
        )}
      </div>

      {activeThread && (
        <Drawer title={activeThread.linkedName} onClose={() => { setOpenLead(null); setDraft(''); }}>
          <div className="px-5 py-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{activeThread.count} {activeThread.count === 1 ? 'note' : 'notes'} · newest first</p>
              <Link className="text-sm font-medium text-blue-700" to={`/leads/${activeThread.linkedId}`}>Open lead</Link>
            </div>
            <form onSubmit={addToLead} className="mb-5">
              <textarea className="field min-h-24" placeholder={`Add a note on ${activeThread.linkedName}…`} value={draft} onChange={(event) => setDraft(event.target.value)} />
              <div className="mt-2 flex justify-end">
                <button className="btn" type="submit" disabled={!draft.trim()}>Add note</button>
              </div>
            </form>
            <div className="space-y-3">
              {activeThread.notes.map((note) => (
                <article key={note.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
                    <button type="button" className={cx('text-lg', note.pinned ? 'text-sky-500' : 'text-slate-300')} onClick={() => pin(note)} aria-label="Pin">⌖</button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>{note.authorName || 'You'} · {ago(note.createdAt)}</span>
                    <span className="flex gap-3">
                      <button type="button" onClick={() => setEditor({ ...note, link: `lead:${activeThread.linkedId}` })}>Edit</button>
                      <button type="button" className="text-rose-500" onClick={() => remove(note)}>Delete</button>
                    </span>
                  </div>
                </article>
              ))}
              {activeThread.notes.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No notes on this lead yet.</p>
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
