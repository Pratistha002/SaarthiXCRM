import { useEffect, useState } from 'react';
import { api } from '../api';
import { PRIORITIES, isoDay } from '../lib';
import { Banner, Field, Modal, Spinner } from '../ui';

function inDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** One card per person named on the lead; the lead's own email and phone go to the first (primary) person. */
function initialPeople(lead) {
  const email = lead.email || '';
  const phone = lead.phone || lead.mobile || '';
  if (lead.leadType === 'Student') return [{ name: lead.name || '', title: 'Student', email, phone }];
  const names = (lead.contactPerson || '').split(/[,;\n/&|]|\s+and\s+/i).map((name) => name.trim()).filter(Boolean);
  if (!names.length) return [{ name: '', title: '', email, phone }];
  return names.map((name, index) => ({ name, title: '', email: index === 0 ? email : '', phone: index === 0 ? phone : '' }));
}

/** Lead → Account + Contacts (+ Deal). A lead converted before deals existed only gets its deal here. */
export default function ConvertLeadModal({ lead, contact, contacts = [], members, onClose, onConverted }) {
  const dealOnly = Boolean(lead.convertedContactId);
  const defaultAccount = lead.company || lead.name;
  const existing = contacts.length ? contacts : [contact].filter(Boolean);
  const [products, setProducts] = useState(['TalentX']);
  const [people, setPeople] = useState(() => initialPeople(lead));
  const [form, setForm] = useState({
    accountName: defaultAccount,
    createDeal: true,
    product: 'TalentX',
    dealName: '',
    value: String(lead.value || ''),
    expectedCloseDate: inDays(30),
    priority: PRIORITIES.includes(lead.priority) ? lead.priority : 'Medium',
    ownerId: lead.ownerId || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/deals/meta').then((meta) => setProducts(meta.products?.length ? meta.products : ['TalentX'])).catch(() => {});
  }, []);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const setPerson = (index, key) => (event) => setPeople(people.map((p, i) => (i === index ? { ...p, [key]: event.target.value } : p)));
  const suggestedName = `${form.accountName.trim() || defaultAccount} - ${form.product.trim() || 'TalentX'}`;

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!form.accountName.trim()) { setError('Account name is required.'); return; }
    if (!dealOnly) {
      const unnamed = people.findIndex((p) => !p.name.trim());
      if (unnamed >= 0) { setError(`Enter a name for contact ${unnamed + 1}, or remove it.`); return; }
      const badEmail = people.find((p) => p.email.trim() && !EMAIL.test(p.email.trim()));
      if (badEmail) { setError(`Enter a valid email for ${badEmail.name.trim()}.`); return; }
    }
    if (form.createDeal) {
      if (form.value === '' || Number(form.value) < 0) { setError('Enter the deal value in rupees.'); return; }
      if (!form.expectedCloseDate) { setError('Choose the expected close date.'); return; }
    }
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        body: {
          accountName: form.accountName,
          contacts: dealOnly ? [] : people.map((p) => ({ name: p.name.trim(), title: p.title.trim(), email: p.email.trim(), phone: p.phone.trim() })),
          createDeal: form.createDeal,
          deal: form.createDeal ? {
            name: form.dealName.trim() || suggestedName,
            product: form.product,
            value: Number(form.value),
            expectedCloseDate: form.expectedCloseDate,
            priority: form.priority,
            ownerId: form.ownerId,
          } : null,
        },
      });
      await onConverted(result);
    } catch (err) {
      setError(err.status ? err.message : 'Could not reach the server. Nothing was converted; try again.');
      setBusy(false);
    }
  }

  return (
    <Modal title={dealOnly ? 'Create Deal' : 'Convert Lead'} subtitle={lead.name} onClose={() => !busy && onClose()} wide>
      {lead.stage !== 'Qualified' && lead.stage !== 'Converted' && (
        <div className="mb-4"><Banner tone="warn">This lead is still {lead.stage}. Leads are usually converted once they are Qualified.</Banner></div>
      )}
      <form onSubmit={save} className="space-y-5">
        <Field label="Account *" hint="Linked to an existing account with the same name, if there is one.">
          <input className="field" value={form.accountName} onChange={set('accountName')} />
        </Field>

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Points of Contact</h3>
              <p className="text-xs text-slate-500">
                {dealOnly ? 'Already created when this lead was converted.' : 'Each person becomes a contact under the account. An existing contact with the same email is reused.'}
              </p>
            </div>
            {!dealOnly && (
              <button type="button" className="btn-ghost !rounded-lg !py-1.5" onClick={() => setPeople([...people, { name: '', title: '', email: '', phone: '' }])}>
                + Add Contact
              </button>
            )}
          </div>
          {dealOnly ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {existing.map((c) => <li key={c.id}>{c.name}{c.title ? <span className="text-slate-500"> · {c.title}</span> : null}</li>)}
            </ul>
          ) : (
            <div className="space-y-3">
              {existing.length > 0 && (
                <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Already added to this lead, and linked to the account too: {existing.map((c) => c.name).join(', ')}
                </p>
              )}
              {people.map((person, index) => (
                <div key={index} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">{index === 0 ? 'Primary contact' : `Contact ${index + 1}`}</span>
                    {people.length > 1 && (
                      <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => setPeople(people.filter((_, i) => i !== index))}>Remove</button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name *"><input className="field" placeholder="Full name" value={person.name} onChange={setPerson(index, 'name')} /></Field>
                    <Field label="Designation"><input className="field" placeholder="e.g. Placement Officer" value={person.title} onChange={setPerson(index, 'title')} /></Field>
                    <Field label="Email"><input className="field" type="email" value={person.email} onChange={setPerson(index, 'email')} /></Field>
                    <Field label="Phone"><input className="field" value={person.phone} onChange={setPerson(index, 'phone')} /></Field>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          {!dealOnly && (
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.createDeal} onChange={(event) => setForm({ ...form, createDeal: event.target.checked })} />
              Create a deal: there is a real sales opportunity
            </label>
          )}
          {form.createDeal ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Deal name"><input className="field" placeholder={suggestedName} value={form.dealName} onChange={set('dealName')} /></Field>
              </div>
              <Field label="Product">
                <input className="field" list="convert-products" value={form.product} onChange={set('product')} />
                <datalist id="convert-products">{products.map((item) => <option key={item} value={item} />)}</datalist>
              </Field>
              <Field label="Deal value (₹) *">
                <input className="field" inputMode="numeric" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Expected close *"><input className="field" type="date" min={isoDay(new Date())} value={form.expectedCloseDate} onChange={set('expectedCloseDate')} /></Field>
              <Field label="Priority">
                <select className="field" value={form.priority} onChange={set('priority')}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select>
              </Field>
              <Field label="Deal owner">
                <select className="field" value={form.ownerId} onChange={set('ownerId')}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </Field>
              <Field label="Deal stage"><input className="field" value="Qualified" disabled /></Field>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Only the account and contact will be created. You can create the deal later from this lead.</p>
          )}
        </div>

        {error && <Banner tone="danger">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy && <Spinner />}{dealOnly ? 'Create Deal' : 'Convert'}</button>
        </div>
      </form>
    </Modal>
  );
}
