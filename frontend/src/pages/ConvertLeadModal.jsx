import { useEffect, useState } from 'react';
import { api } from '../api';
import { PRIORITIES, isoDay } from '../lib';
import { Banner, Field, Modal, Spinner } from '../ui';

function inDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** Lead → Account + Contact (+ Deal). A lead converted before deals existed only gets its deal here. */
export default function ConvertLeadModal({ lead, contact, members, onClose, onConverted }) {
  const dealOnly = Boolean(lead.convertedContactId);
  const defaultAccount = lead.company || lead.name;
  const defaultContact = contact?.name || (lead.leadType !== 'Student' && lead.contactPerson) || lead.name;
  const [products, setProducts] = useState(['TalentX']);
  const [form, setForm] = useState({
    accountName: defaultAccount,
    contactName: defaultContact,
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
  const suggestedName = `${form.accountName.trim() || defaultAccount} - ${form.product.trim() || 'TalentX'}`;

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!form.accountName.trim()) { setError('Account name is required.'); return; }
    if (!form.contactName.trim()) { setError('Contact name is required.'); return; }
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
          contactName: form.contactName,
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account *" hint="Linked to an existing account with the same name, if there is one.">
            <input className="field" value={form.accountName} onChange={set('accountName')} />
          </Field>
          <Field label="Contact *" hint={dealOnly ? 'Already created when this lead was converted.' : 'Reuses an existing contact with the same email.'}>
            <input className="field" value={form.contactName} onChange={set('contactName')} disabled={dealOnly} />
          </Field>
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
