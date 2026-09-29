import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Avatar } from '../ui';
import { DealRows } from './AccountDetail';
import { Info, Section, stamp } from './LeadDetail';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/api/contacts/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="card text-center text-sm text-rose-600">{error}</div>;
  if (!data) return <p className="py-20 text-center text-sm text-slate-400">Loading contact…</p>;
  const { contact, account, deals } = data;

  return (
    <div className="-mx-2 space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-xl text-slate-600 hover:bg-slate-100" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <Avatar name={contact.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{contact.name}</h1>
          <p className="text-sm text-slate-500">
            Contact{contact.title ? ` · ${contact.title}` : ''}
            {account && <> · <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(`/accounts/${account.id}`)}>{account.name}</button></>}
          </p>
        </div>
      </div>
      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
        <dl className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
          <Info label="Email">{contact.email ? <a className="text-blue-600 hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : '—'}</Info>
          <Info label="Phone">{contact.phone || '—'}</Info>
          <Info label="Account">
            {account ? <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(`/accounts/${account.id}`)}>{account.name}</button> : contact.company || '—'}
          </Info>
          <Info label="Tags">{(contact.tags || []).join(', ') || '—'}</Info>
          <Info label="Created">{stamp(contact.createdAt)}</Info>
        </dl>
      </section>
      <Section id="deals" title={`Deals as primary contact (${deals.length})`}>
        <DealRows deals={deals} />
      </Section>
    </div>
  );
}
