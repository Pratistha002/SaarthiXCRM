import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { compact, cx, money } from '../lib';
import { Avatar } from '../ui';
import { Empty, Info, Section, stamp } from './LeadDetail';

export function DealRows({ deals }) {
  const navigate = useNavigate();
  if (deals.length === 0) return <Empty>No deals yet.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {deals.map((deal) => (
        <li key={deal.id}>
          <button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:bg-slate-50" onClick={() => navigate(`/deals/${deal.id}`)}>
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-800">{deal.name}</span>
              <span className="text-xs text-slate-500">{deal.ownerName} · {deal.primaryContactName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="font-semibold">{money(deal.value)}</span>
              <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium',
                deal.status === 'Won' ? 'bg-emerald-50 text-emerald-700' : deal.status === 'Lost' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700')}
              >
                {deal.stage}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/api/accounts/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="card text-center text-sm text-rose-600">{error}</div>;
  if (!data) return <p className="py-20 text-center text-sm text-slate-400">Loading account…</p>;
  const { account, contacts, deals, summary } = data;
  const location = [account.city, account.state, account.country].filter(Boolean).join(', ');

  return (
    <div className="-mx-2 space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-xl text-slate-600 hover:bg-slate-100" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-slate-200 text-lg font-semibold text-slate-600">🏢</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{account.name}</h1>
          <p className="text-sm text-slate-500">Account{account.type ? ` · ${account.type}` : ''}</p>
        </div>
        <div className="flex gap-6 text-sm">
          <span><span className="block text-xs text-slate-400">Open pipeline</span><b>{compact(summary.openValue)}</b></span>
          <span><span className="block text-xs text-slate-400">Won</span><b className="text-emerald-700">{compact(summary.wonValue)}</b></span>
        </div>
      </div>
      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
        <dl className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
          <Info label="Type">{account.type || '—'}</Info>
          <Info label="Industry">{account.industry || '—'}</Info>
          <Info label="Website">{account.website || '—'}</Info>
          <Info label="Phone">{account.phone || '—'}</Info>
          <Info label="Location">{location || '—'}</Info>
          <Info label="Created">{stamp(account.createdAt)}</Info>
        </dl>
      </section>
      <Section id="deals" title={`Deals (${deals.length})`}>
        <DealRows deals={deals} />
      </Section>
      <Section id="contacts" title={`Contacts (${contacts.length})`}>
        <ul className="divide-y divide-slate-100">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <button type="button" className="flex w-full items-center gap-3 py-3 text-left text-sm hover:bg-slate-50" onClick={() => navigate(`/contacts/${contact.id}`)}>
                <Avatar name={contact.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800">{contact.name}</span>
                  <span className="text-xs text-slate-500">{[contact.title, contact.email, contact.phone].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {contacts.length === 0 && <Empty>No contacts linked to this account.</Empty>}
      </Section>
    </div>
  );
}
