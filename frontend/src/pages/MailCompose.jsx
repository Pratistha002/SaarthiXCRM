import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { fillTemplate, MAIL_TEMPLATES, openOutlook } from '../mailTemplates';
import { Banner, Field, Modal, Spinner } from '../ui';

export default function MailCompose({ to, toName, company, leadId, dealId, onClose, onSent }) {
  const { user } = useAuth();
  const [step, setStep] = useState('templates');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);

  const vars = {
    name: toName || 'there',
    company: company || toName || 'your institution',
    sender: user?.name || 'the SaarthiX team',
  };

  function applyTemplate(template, openClient = true) {
    const nextSubject = fillTemplate(template.subject, vars);
    const nextBody = fillTemplate(template.body, vars);
    setPicked(template.id);
    setSubject(nextSubject);
    setBody(nextBody);
    setStep('compose');
    setError('');
    if (openClient) {
      if (!to) {
        setError('Add an email address before opening Outlook.');
        return;
      }
      openOutlook({ to, subject: nextSubject, body: nextBody });
      setOpened(true);
    }
  }

  function openAgain() {
    if (!to) {
      setError('Add an email address before opening Outlook.');
      return;
    }
    openOutlook({ to, subject, body });
    setOpened(true);
  }

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/mail/send', {
        method: 'POST',
        body: { leadId, dealId, subject, body },
      });
      await onSent?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={step === 'templates' ? 'Choose a mail template' : 'Send email'}
      subtitle={`To ${toName || 'recipient'}${to ? ` <${to}>` : ''}`}
      onClose={onClose}
      wide
    >
      {!to && (
        <div className="mb-3">
          <Banner tone="warn">This record has no email address. Add one first, or still pick a template and copy it into Outlook.</Banner>
        </div>
      )}

      {step === 'templates' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {MAIL_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
              onClick={() => applyTemplate(template)}
            >
              <p className="text-sm font-semibold text-slate-800">{template.name}</p>
              <p className="mt-1 text-xs text-slate-500">{template.hint}</p>
              {template.subject && (
                <p className="mt-2 line-clamp-1 text-[11px] text-slate-400">{fillTemplate(template.subject, vars)}</p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => { setStep('templates'); setOpened(false); }}>
            ← Choose another template
          </button>
          {picked && picked !== 'blank' && (
            <p className="text-xs text-slate-400">Template: {MAIL_TEMPLATES.find((item) => item.id === picked)?.name}</p>
          )}
          <Field label="Subject"><input className="field" required value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
          <Field label="Message"><textarea className="field min-h-48" required value={body} onChange={(event) => setBody(event.target.value)} /></Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {opened && <Banner tone="good">Outlook should now be open with this template. You can still send a copy from CRM below.</Banner>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn-ghost" onClick={openAgain} disabled={!to}>Open in Outlook</button>
            <button type="submit" className="btn" disabled={busy || !to}>{busy ? <Spinner /> : null}Send from CRM</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
