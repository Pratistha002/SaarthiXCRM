import { useEffect, useState } from 'react';
import { api } from '../api';
import { ago, cx } from '../lib';
import { Field, Modal } from '../ui';

const FILTERS = ['All', 'Pinned', 'Linked', 'Unlinked'];

export default function Notes() {
  const [pack, setPack] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [editor, setEditor] = useState(null);
  const [leads, setLeads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (filter !== 'All') query.set('filter', filter);
    setPack(await api(`/api/notes?${query.toString()}`));
  }

  useEffect(() => {
    const timer = setTimeout(() => { load().catch((err) => setError(err.message)); }, 200);
    return () => clearTimeout(timer);
  }, [q, filter]);

  useEffect(() => {
    api('/api/leads').then((data) => setLeads(data.leads)).catch(() => {});
    api('/api/contacts').then((data) => setContacts(data.contacts)).catch(() => {});
  }, []);

  function openNew() {
    setEditor({ body: '', pinned: false, link: '' });
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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-slate-500">Capture context across your deals and contacts.</p>
        </div>
        <button type="button" className="btn" onClick={openNew}>+ New note</button>
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
        <input className="field" placeholder="Search notes…" value={q} onChange={(event) => setQ(event.target.value)} />
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={cx('rounded-full px-3 py-1.5 text-sm', filter === item ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
              {item} {summary ? summary[item.toLowerCase()] ?? (item === 'All' ? summary.total : '') : ''}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(pack?.notes || []).map((note) => (
            <article key={note.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-relaxed text-slate-700">{note.body}</p>
                <button type="button" className={cx('text-lg', note.pinned ? 'text-sky-500' : 'text-slate-300')} onClick={() => pin(note)} aria-label="Pin">⌖</button>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>{note.linkedName ? `↔ ${note.linkedName}` : 'Unlinked'}</span>
                <span>{ago(note.createdAt)}</span>
                <div className="relative">
                  <button type="button" onClick={() => setMenu(menu === note.id ? null : note.id)}>•••</button>
                  {menu === note.id && (
                    <div className="absolute right-0 z-10 w-28 rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
                      <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setEditor({ ...note, link: note.linkedId ? `${note.linkedType}:${note.linkedId}` : '' }); setMenu(null); }}>Edit</button>
                      <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50" onClick={() => { setMenu(null); remove(note); }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {pack && pack.notes.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No notes in this view.</p>}
      </div>

      {editor && (
        <Modal title={editor.id ? 'Edit note' : 'New note'} subtitle="Link it to a lead or contact when it belongs to a deal." onClose={() => setEditor(null)}>
          <form className="space-y-3" onSubmit={save}>
            <Field label="Note"><textarea className="field min-h-28" required value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} /></Field>
            <Field label="Link">
              <select className="field" value={editor.link || ''} onChange={(event) => setEditor({ ...editor, link: event.target.value })}>
                <option value="">Unlinked</option>
                <optgroup label="Leads">
                  {leads.map((lead) => <option key={lead.id} value={`lead:${lead.id}`}>{lead.name}</option>)}
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
