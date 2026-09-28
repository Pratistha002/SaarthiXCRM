import { useMemo, useState } from 'react';
import { api } from '../api';
import {
  CALL_EXIT_REASON, CALL_OUTCOMES, CALL_RESPONSES, EXIT_STAGES, FUNNEL_STAGES, NEXT_ACTIONS, NO_FURTHER_ACTION, REMINDERS,
  closeReasons, cx, isDialable, isExitStage, isoDay, primaryPhone, suggestStage,
} from '../lib';
import { Banner, Field, Modal, Spinner } from '../ui';

const NEXT_FOR_OUTCOME = {
  'No Answer': 'Call',
  Busy: 'Call',
  'Call Back Later': 'Call',
  'Wrong Number': NO_FURTHER_ACTION,
};

const NEXT_FOR_RESPONSE = {
  Interested: 'Follow-up',
  'Not Interested': NO_FURTHER_ACTION,
  'Needs More Information': 'Email',
  'Wants Demo': 'Demo',
  'Wants Proposal': 'Send Proposal',
  'Call Back Later': 'Call',
  Other: 'Follow-up',
};

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return isoDay(date);
}

function Chips({ options, value, onChange, tone = 'blue' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cx(
              'rounded-full border px-3 py-1.5 text-sm',
              active && tone === 'blue' && 'border-blue-600 bg-blue-50 font-medium text-blue-700',
              active && tone === 'red' && 'border-rose-400 bg-rose-50 font-medium text-rose-600',
              !active && 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default function CallModal({ lead, phone: chosen, onClose, onSaved, onEditLead }) {
  const phone = (chosen || primaryPhone(lead)).trim();
  const dialable = isDialable(phone);
  const requestId = useMemo(newRequestId, []);
  const [step, setStep] = useState('dial');
  const [startedAt, setStartedAt] = useState(null);
  const [form, setForm] = useState({
    outcome: '', customerResponse: '', customerResponseOther: '', notes: '',
    nextAction: '', dueDate: tomorrow(), dueTime: '', reminder: 'None',
    stage: lead.stage, closeReason: '',
  });
  const [touched, setTouched] = useState({ nextAction: false, stage: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connected = form.outcome === 'Connected';
  const scheduling = form.nextAction && form.nextAction !== NO_FURTHER_ACTION;
  const suggested = suggestStage(form.outcome, connected ? form.customerResponse : '', lead.stage);
  const statusOptions = [...FUNNEL_STAGES.filter((stage) => stage !== 'Converted' || lead.stage === 'Converted'), ...EXIT_STAGES];

  function applyResult(next) {
    const response = next.outcome === 'Connected' ? next.customerResponse : '';
    const stage = touched.stage ? next.stage : suggestStage(next.outcome, response, lead.stage);
    const nextAction = touched.nextAction ? next.nextAction
      : (next.outcome === 'Connected' ? NEXT_FOR_RESPONSE[response] : NEXT_FOR_OUTCOME[next.outcome]) || '';
    const closeReason = stage === next.stage ? next.closeReason : CALL_EXIT_REASON[stage] || '';
    setForm({ ...next, stage, nextAction, closeReason });
  }

  function setField(key, value) {
    setError('');
    if (key === 'outcome' || key === 'customerResponse') {
      applyResult({ ...form, [key]: value });
      return;
    }
    if (key === 'nextAction' || key === 'stage') setTouched((prev) => ({ ...prev, [key]: true }));
    if (key === 'stage') {
      setForm({ ...form, stage: value, closeReason: CALL_EXIT_REASON[value] || '' });
      return;
    }
    setForm({ ...form, [key]: value });
  }

  function startCall() {
    setStartedAt(new Date().toISOString());
    setStep('outcome');
  }

  function close() {
    if (busy) return;
    if (step === 'outcome' && form.outcome && !window.confirm('Discard this call? Nothing has been saved yet.')) return;
    onClose();
  }

  function validate() {
    if (!form.outcome) return 'Please select a call outcome.';
    if (connected && !form.customerResponse) return "Please select the customer's response.";
    if (connected && form.customerResponse === 'Other' && !form.customerResponseOther.trim()) return "Describe the customer's response.";
    if (!form.nextAction) return 'Please choose what should happen next.';
    if (scheduling) {
      if (!form.dueDate || !form.dueTime) return 'Please select a date and time for the next action.';
      if (new Date(`${form.dueDate}T${form.dueTime}`) < new Date(Date.now() - 5 * 60 * 1000)) {
        return 'The next action is in the past. Pick a future date and time.';
      }
    }
    if (isExitStage(form.stage) && form.stage !== lead.stage && !form.closeReason) {
      return `Pick a reason for marking this lead ${form.stage}.`;
    }
    return '';
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/leads/${lead.id}/activities/call`, {
        method: 'POST',
        body: {
          requestId,
          phone,
          outcome: form.outcome,
          customerResponse: connected ? form.customerResponse : '',
          customerResponseOther: connected && form.customerResponse === 'Other' ? form.customerResponseOther : '',
          notes: form.notes,
          startedAt,
          nextAction: form.nextAction,
          dueDate: scheduling ? form.dueDate : null,
          dueTime: scheduling ? form.dueTime : null,
          dueAt: scheduling ? new Date(`${form.dueDate}T${form.dueTime}`).toISOString() : null,
          reminder: scheduling ? form.reminder : 'None',
          stage: form.stage,
          closeReason: isExitStage(form.stage) ? form.closeReason : '',
        },
      });
      await onSaved(result);
    } catch (err) {
      if (!err.status) setError('Could not reach the server, so the call may not have been saved. Check your connection and press Save again; it will not be logged twice.');
      else if (err.status === 403) setError('You do not have permission to log calls for this lead.');
      else if (err.status === 404) setError('This lead no longer exists or you no longer have access to it.');
      else setError(err.message || 'Saving the call failed. Please try again.');
      setBusy(false);
    }
  }

  if (step === 'dial') {
    return (
      <Modal title="Call Lead" onClose={close}>
        <div className="rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-100">
          <p className="text-lg font-semibold text-slate-900">{lead.name}</p>
          {lead.company && lead.company !== lead.name && <p className="text-sm text-slate-500">{lead.company}</p>}
          <p className="mt-3 text-xl font-medium tracking-wide text-slate-800">📞 {phone || '—'}</p>
        </div>
        {!phone && <div className="mt-4"><Banner tone="warn">No phone number is available for this lead.</Banner></div>}
        {phone && !dialable && <div className="mt-4"><Banner tone="warn">This phone number doesn&apos;t look valid. Edit the lead to fix it before calling.</Banner></div>}
        {dialable ? (
          <>
            <a href={`tel:${phone.replace(/[\s().-]/g, '')}`} onClick={startCall} className="btn mt-5 w-full justify-center !rounded-xl !py-3 text-base">
              Start Call
            </a>
            <p className="mt-3 text-center text-xs text-slate-500">
              This opens your phone or computer dialer. The CRM doesn&apos;t connect or record the call. Come back here to log what happened.
            </p>
            <button type="button" className="mt-2 w-full text-center text-sm text-blue-600 hover:underline" onClick={() => setStep('outcome')}>
              Already called? Log the outcome
            </button>
          </>
        ) : (
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn" onClick={onEditLead}>Edit lead</button>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal title="Call Outcome" subtitle={`${lead.name} · ${phone}`} onClose={close} wide>
      <form onSubmit={save} className="space-y-5">
        <Field label="Call Result *">
          <Chips options={CALL_OUTCOMES} value={form.outcome} onChange={(value) => setField('outcome', value)} />
        </Field>

        {connected && (
          <Field label="Customer Response *">
            <Chips options={CALL_RESPONSES} value={form.customerResponse} onChange={(value) => setField('customerResponse', value)} />
            {form.customerResponse === 'Other' && (
              <input autoFocus className="field mt-2" placeholder="What did the customer say?" value={form.customerResponseOther} onChange={(event) => setField('customerResponseOther', event.target.value)} />
            )}
          </Field>
        )}

        <Field label="Call Notes" hint="Optional, but it helps whoever picks this lead up next.">
          <textarea className="field min-h-24" placeholder="Customer is interested in TalentX for approximately 500 students and wants a product demo next week." value={form.notes} onChange={(event) => setField('notes', event.target.value)} />
        </Field>

        <div className="rounded-2xl border border-slate-200 p-4">
          <Field label="What should happen next? *">
            <Chips options={NEXT_ACTIONS} value={form.nextAction} onChange={(value) => setField('nextAction', value)} />
          </Field>
          {scheduling && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Date *"><input className="field" type="date" min={isoDay(new Date())} value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} /></Field>
              <Field label="Time *"><input className="field" type="time" value={form.dueTime} onChange={(event) => setField('dueTime', event.target.value)} /></Field>
              <Field label="Reminder">
                <select className="field" value={form.reminder} onChange={(event) => setField('reminder', event.target.value)}>
                  {REMINDERS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Lead Status"
            hint={form.outcome && suggested !== lead.stage ? `Suggested from the call result: ${suggested}` : `Currently ${lead.stage}`}
          >
            <select className={cx('field', isExitStage(form.stage) && '!border-rose-300 !text-rose-600')} value={form.stage} onChange={(event) => setField('stage', event.target.value)}>
              <optgroup label="Pipeline">{statusOptions.filter((item) => !isExitStage(item)).map((item) => <option key={item}>{item}</option>)}</optgroup>
              <optgroup label="Exit states">{EXIT_STAGES.map((item) => <option key={item}>{item}</option>)}</optgroup>
            </select>
          </Field>
          {isExitStage(form.stage) && form.stage !== lead.stage && (
            <Field label={`${form.stage} reason *`}>
              <select className="field" value={form.closeReason} onChange={(event) => setField('closeReason', event.target.value)}>
                <option value="">Choose a reason</option>
                {closeReasons(form.stage).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          )}
        </div>

        {error && <Banner tone="danger">{error}</Banner>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? <><Spinner /> Saving…</> : 'Save Call Activity'}</button>
        </div>
      </form>
    </Modal>
  );
}
