import { useState } from 'react';
import { api } from '../api';
import { isoDay, money } from '../lib';
import { Banner, Field, Modal, Spinner } from '../ui';

function useSubmit(onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(dealId, body) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const deal = await api(`/api/deals/${dealId}/stage`, { method: 'PATCH', body });
      await onDone(deal);
    } catch (err) {
      setError(err.status ? err.message : 'Could not reach the server. Nothing was changed; try again.');
      setBusy(false);
    }
  }
  return { busy, error, setError, submit };
}

export function WonModal({ deal, onClose, onDone }) {
  const [wonDate, setWonDate] = useState(isoDay(new Date()));
  const [finalValue, setFinalValue] = useState('');
  const { busy, error, setError, submit } = useSubmit(onDone);

  function save(event) {
    event.preventDefault();
    if (!wonDate) {
      setError('Confirm the date this deal was won.');
      return;
    }
    const value = finalValue === '' ? null : Number(String(finalValue).replace(/[^\d]/g, ''));
    submit(deal.id, { stage: 'Won', wonDate, finalValue: value });
  }

  return (
    <Modal title="Mark deal as Won" subtitle={`${deal.name} · ${money(deal.value)}`} onClose={() => !busy && onClose()}>
      <form className="space-y-4" onSubmit={save}>
        <Field label="Won date *">
          <input className="field" type="date" max={isoDay(new Date())} value={wonDate} onChange={(event) => setWonDate(event.target.value)} />
        </Field>
        <Field label="Final deal value (optional)" hint={`Leave empty to keep ${money(deal.value)}.`}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
            <input className="field !pl-7" inputMode="numeric" placeholder={String(deal.value)} value={finalValue} onChange={(event) => setFinalValue(event.target.value.replace(/[^\d]/g, ''))} />
          </div>
        </Field>
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn !bg-emerald-600 hover:!bg-emerald-700" disabled={busy}>{busy && <Spinner />} Mark Won</button>
        </div>
      </form>
    </Modal>
  );
}

export function LostModal({ deal, reasons, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const { busy, error, setError, submit } = useSubmit(onDone);

  function save(event) {
    event.preventDefault();
    if (!reason) {
      setError('Pick a reason for losing this deal.');
      return;
    }
    if (reason === 'Other' && !other.trim()) {
      setError('Describe why this deal was lost.');
      return;
    }
    submit(deal.id, { stage: 'Lost', lostReason: reason, lostReasonOther: reason === 'Other' ? other : null, closedDate: isoDay(new Date()) });
  }

  return (
    <Modal title="Mark deal as Lost" subtitle={`${deal.name} stays in the CRM for reporting.`} onClose={() => !busy && onClose()}>
      <form className="space-y-4" onSubmit={save}>
        <Field label="Lost reason *">
          <select className="field" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }}>
            <option value="">Choose a reason</option>
            {reasons.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        {reason === 'Other' && (
          <Field label="What happened? *">
            <input autoFocus className="field" value={other} onChange={(event) => setOther(event.target.value)} />
          </Field>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn !bg-rose-600 hover:!bg-rose-700" disabled={busy}>{busy && <Spinner />} Mark Lost</button>
        </div>
      </form>
    </Modal>
  );
}
