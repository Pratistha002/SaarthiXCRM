import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { cx } from '../lib';
import { Avatar, Field, Modal } from '../ui';

const EMPTY = { name: '', title: '', company: '', email: '', phone: '', tags: '', favorite: false };

export default function Contacts() {
  const [pack, setPack] = useState(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (tag !== 'All') query.set('tag', tag);
    if (favoritesOnly) query.set('favorite', 'true');
    setPack(await api(`/api/contacts?${query.toString()}`));
  }

  useEffect(() => {
    const timer = setTimeout(() => { load().catch((err) => setError(err.message)); }, 200);
    return () => clearTimeout(timer);
  }, [q, tag, favoritesOnly]);

  async function save(event) {
    event.preventDefault();
    const body = {
      ...editor,
      tags: String(editor.tags || '').split(',').map((item) => item.trim()).filter(Boolean),
    };
    try {
      if (editor.id) await api(`/api/contacts/${editor.id}`, { method: 'PUT', body });
      else await api('/api/contacts', { method: 'POST', body });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function star(contact) {
    await api(`/api/contacts/${contact.id}/favorite`, { method: 'PATCH' });
    await load();
  }

  async function remove(contact) {
    if (!window.confirm(`Remove ${contact.name}?`)) return;
    await api(`/api/contacts/${contact.id}`, { method: 'DELETE' });
    await load();
  }

  const summary = pack?.summary;
  const tags = summary ? Object.entries(summary.tags || {}) : [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-slate-500">Your people and professional relationships.</p>
        </div>
        <button type="button" className="btn" onClick={() => setEditor({ ...EMPTY })}>+ Add contact</button>
      </div>
      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total contacts', summary.total, () => { setFavoritesOnly(false); setTag('All'); }],
            ['Favorites', summary.favorites, () => setFavoritesOnly((value) => !value)],
            ['Companies', summary.companies, null],
            ['Tagged', summary.tagged, null],
          ].map(([label, value, onClick]) => (
            <button key={label} type="button" onClick={onClick || undefined} className={cx('card flex items-center gap-3 !p-4 text-left', label === 'Favorites' && favoritesOnly && 'ring-2 ring-amber-300')}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100">{label === 'Favorites' ? '★' : '●'}</span>
              <span>
                <span className="block text-xs text-slate-400">{label}</span>
                <span className="text-xl font-semibold">{value}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="card">
        <input className="field" placeholder="Search by name, email, or company…" value={q} onChange={(event) => setQ(event.target.value)} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setTag('All')} className={cx('rounded-full px-3 py-1.5 text-sm', tag === 'All' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>All {summary?.total || 0}</button>
          {tags.map(([name, count]) => (
            <button key={name} type="button" onClick={() => setTag(name)} className={cx('rounded-full px-3 py-1.5 text-sm', tag === name ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
              {name} {count}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(pack?.contacts || []).map((contact) => (
            <article key={contact.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start gap-3">
                <Avatar name={contact.name} />
                <div className="min-w-0 flex-1">
                  <Link to={`/contacts/${contact.id}`} className="font-semibold hover:text-blue-600 hover:underline">{contact.name}</Link>
                  <p className="truncate text-xs text-slate-400">{contact.title}{contact.title && contact.company ? ' · ' : ''}{contact.company}</p>
                </div>
                <button type="button" className={cx('text-lg', contact.favorite ? 'text-amber-400' : 'text-slate-300')} onClick={() => star(contact)} aria-label="Favorite">★</button>
                <div className="relative">
                  <button type="button" className="text-slate-400" onClick={() => setMenu(menu === contact.id ? null : contact.id)}>•••</button>
                  {menu === contact.id && (
                    <div className="absolute right-0 z-10 w-32 rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
                      <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setEditor({ ...contact, tags: (contact.tags || []).join(', ') }); setMenu(null); }}>Edit</button>
                      <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={() => { setMenu(null); remove(contact); }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(contact.tags || []).map((item) => <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{item}</span>)}
              </div>
              <p className="mt-3 text-sm text-slate-600">{contact.email}</p>
              <p className="text-sm text-slate-500">{contact.phone}</p>
            </article>
          ))}
        </div>
        {pack && pack.contacts.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No contacts yet.</p>}
        <p className="mt-4 text-right text-xs text-slate-400">{pack?.contacts?.length || 0} of {summary?.total || 0}</p>
      </div>

      {editor && (
        <Modal title={editor.id ? 'Edit contact' : 'New contact'} subtitle="Keep the relationship in one place." onClose={() => setEditor(null)}>
          <form className="grid grid-cols-2 gap-3" onSubmit={save}>
            <div className="col-span-2"><Field label="Name"><input className="field" required value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></Field></div>
            <Field label="Title"><input className="field" value={editor.title || ''} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></Field>
            <Field label="Company"><input className="field" value={editor.company || ''} onChange={(event) => setEditor({ ...editor, company: event.target.value })} /></Field>
            <Field label="Email"><input className="field" value={editor.email || ''} onChange={(event) => setEditor({ ...editor, email: event.target.value })} /></Field>
            <Field label="Phone"><input className="field" value={editor.phone || ''} onChange={(event) => setEditor({ ...editor, phone: event.target.value })} /></Field>
            <div className="col-span-2"><Field label="Tags"><input className="field" placeholder="finance, champion, vip" value={editor.tags || ''} onChange={(event) => setEditor({ ...editor, tags: event.target.value })} /></Field></div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editor.favorite)} onChange={(event) => setEditor({ ...editor, favorite: event.target.checked })} /> Mark as favorite</label>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn" type="submit">Save contact</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
