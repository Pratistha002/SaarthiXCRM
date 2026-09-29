import { useState } from 'react';
import { ApiError, api } from '../api';
import {
  COUNTRIES, EXIT_STAGES, FUNNEL_STAGES, LEAD_TYPES, PRIORITIES, RATINGS, SOURCES, STATES, canSeeTeamData, closeReasons, cx, isExitStage,
} from '../lib';
import { Banner, Spinner } from '../ui';

export const EMPTY_LEAD = {
  ownerId: '', leadType: '', company: '', contactPerson: '', firstName: '', lastName: '', email: '', phone: '',
  fax: '', mobile: '', website: '', collegeName: '', course: '', branch: '', source: '', stage: 'New',
  employees: '', annualRevenue: '', rating: '', value: 0, priority: 'Medium', closeReason: '', closeNote: '',
  country: '', building: '', street: '', city: '', state: '', zip: '', latitude: '', longitude: '',
  notes: '',
};

const ADDRESS_KEYS = ['country', 'building', 'street', 'city', 'state', 'zip', 'latitude', 'longitude'];

const FIELD_ORDER = [
  'ownerId', 'leadType', 'company', 'contactPerson', 'firstName', 'lastName', 'email', 'phone', 'fax', 'mobile', 'website',
  'collegeName', 'course', 'branch', 'source', 'stage', 'employees', 'annualRevenue', 'rating', 'value', 'priority',
];

const HIDDEN = {
  Student: ['company', 'contactPerson', 'phone', 'fax', 'website', 'employees', 'annualRevenue', 'rating'],
  Institute: ['firstName', 'lastName', 'fax', 'employees', 'annualRevenue', 'collegeName', 'course', 'branch'],
  Industry: ['firstName', 'lastName', 'collegeName', 'course', 'branch'],
};

const NAME_LABEL = { Institute: 'Institute Name', Industry: 'Company Name' };

function prepare(lead, ownerId) {
  const next = { ...EMPTY_LEAD, ...lead };
  Object.keys(EMPTY_LEAD).forEach((key) => { if (next[key] === null || next[key] === undefined) next[key] = EMPTY_LEAD[key]; });
  if (!next.lastName && lead.name && (!next.leadType || next.leadType === 'Student')) {
    const parts = lead.name.trim().split(/\s+/);
    next.lastName = parts.pop() || '';
    next.firstName = parts.join(' ');
  }
  if (!next.ownerId) next.ownerId = ownerId;
  return next;
}

export default function LeadForm({ lead, members, user, onCancel, onSaved }) {
  const [form, setForm] = useState(() => prepare(lead, user?.id || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const editing = Boolean(form.id);
  const type = form.leadType;
  const canAssign = canSeeTeamData(user);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const states = STATES[form.country];
  const visible = FIELD_ORDER.filter((key) => {
    if (key === 'ownerId') return canAssign;
    if (key === 'leadType') return true;
    return Boolean(type) && !HIDDEN[type].includes(key);
  });

  function missing() {
    if (!type) return 'Choose a lead type.';
    if (type === 'Student' && !form.lastName.trim()) return 'Last Name is required.';
    if (type !== 'Student' && !form.company.trim()) return `${NAME_LABEL[type]} is required.`;
    return '';
  }

  async function save(andNew, force = false) {
    const problem = missing();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    setDuplicates([]);
    try {
      const body = { ...form };
      HIDDEN[type].forEach((key) => { body[key] = EMPTY_LEAD[key]; });
      body.value = Number(form.value) || 0;
      body.employees = body.employees === '' ? null : Number(body.employees);
      body.annualRevenue = body.annualRevenue === '' ? null : Number(body.annualRevenue);
      const suffix = force ? '?force=true' : '';
      if (editing) await api(`/api/leads/${form.id}${suffix}`, { method: 'PUT', body });
      else await api(`/api/leads${suffix}`, { method: 'POST', body });
      if (andNew) setForm(prepare({ leadType: type }, user?.id || ''));
      await onSaved(andNew);
    } catch (err) {
      setError(err.message);
      if (err instanceof ApiError && err.data.code === 'DUPLICATE_LEAD') setDuplicates(err.data.duplicates || []);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    save(false);
  }

  function renderField(key) {
    switch (key) {
      case 'ownerId':
        return (
          <Row key={key} label="Lead Owner">
            <select className={input()} value={form.ownerId} onChange={set('ownerId')}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </Row>
        );
      case 'leadType':
        return (
          <Row key={key} label="Lead Type" required>
            <select className={input(true)} value={form.leadType} onChange={set('leadType')}>
              <option value="">-None-</option>
              {LEAD_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Row>
        );
      case 'company':
        return (
          <Row key={key} label={NAME_LABEL[type]} required>
            <input className={input(true)} value={form.company} onChange={set('company')} />
          </Row>
        );
      case 'contactPerson':
        return <Row key={key} label="Contact Person"><input className={input()} value={form.contactPerson} onChange={set('contactPerson')} /></Row>;
      case 'firstName':
        return <Row key={key} label="First Name"><input className={input()} value={form.firstName} onChange={set('firstName')} /></Row>;
      case 'lastName':
        return <Row key={key} label="Last Name" required><input className={input(true)} value={form.lastName} onChange={set('lastName')} /></Row>;
      case 'email':
        return <Row key={key} label="Email"><input className={input()} type="email" value={form.email} onChange={set('email')} /></Row>;
      case 'phone':
        return <Row key={key} label="Phone"><input className={input()} type="tel" value={form.phone} onChange={set('phone')} /></Row>;
      case 'fax':
        return <Row key={key} label="Fax"><input className={input()} value={form.fax} onChange={set('fax')} /></Row>;
      case 'mobile':
        return <Row key={key} label="Mobile"><input className={input()} type="tel" value={form.mobile} onChange={set('mobile')} /></Row>;
      case 'website':
        return <Row key={key} label="Website"><input className={input()} value={form.website} onChange={set('website')} /></Row>;
      case 'collegeName':
        return <Row key={key} label="College Name"><input className={input()} value={form.collegeName} onChange={set('collegeName')} /></Row>;
      case 'course':
        return <Row key={key} label="Course"><input className={input()} value={form.course} onChange={set('course')} placeholder="e.g. B.Tech" /></Row>;
      case 'branch':
        return <Row key={key} label="Branch"><input className={input()} value={form.branch} onChange={set('branch')} placeholder="e.g. Computer Science" /></Row>;
      case 'source':
        return (
          <Row key={key} label="Lead Source">
            <select className={input()} value={form.source} onChange={set('source')}>
              <option value="">-None-</option>
              {SOURCES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Row>
        );
      case 'stage':
        return (
          <Row key={key} label="Lead Status">
            <select className={input()} value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value, closeReason: '' })}>
              <optgroup label="Pipeline">
                {FUNNEL_STAGES.map((item) => <option key={item}>{item}</option>)}
              </optgroup>
              <optgroup label="Exit states">
                {EXIT_STAGES.map((item) => <option key={item}>{item}</option>)}
              </optgroup>
            </select>
          </Row>
        );
      case 'employees':
        return <Row key={key} label="No. of Employees"><input className={input()} type="number" min="0" value={form.employees} onChange={set('employees')} /></Row>;
      case 'annualRevenue':
        return <Row key={key} label="Annual Revenue"><Rupee value={form.annualRevenue} onChange={set('annualRevenue')} /></Row>;
      case 'rating':
        return (
          <Row key={key} label="Rating">
            <select className={input()} value={form.rating} onChange={set('rating')}>
              <option value="">-None-</option>
              {RATINGS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Row>
        );
      case 'value':
        return <Row key={key} label="Deal Value"><Rupee value={form.value} onChange={set('value')} /></Row>;
      case 'priority':
        return (
          <Row key={key} label="Priority">
            <select className={input()} value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Row>
        );
      default:
        return null;
    }
  }

  return (
    <form onSubmit={submit} className="-mx-2">
      <div className="sticky top-0 z-20 -mx-2 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f3f6fb]/95 px-4 py-3 backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">{editing ? 'Edit Lead' : 'Create Lead'}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost !rounded-lg !py-2" onClick={onCancel}>Cancel</button>
          {!editing && (
            <button type="button" className="btn-ghost !rounded-lg !py-2" disabled={busy} onClick={() => save(true)}>Save and New</button>
          )}
          <button type="submit" className="btn !rounded-lg !py-2" disabled={busy}>{busy ? <Spinner /> : null}Save</button>
        </div>
      </div>

      {error && duplicates.length === 0 && <div className="mb-4"><Banner tone="danger">{error}</Banner></div>}
      {duplicates.length > 0 && (
        <div className="mb-4">
          <Banner tone="warn">
            <p className="font-medium">A similar lead is already in this workspace.</p>
            <ul className="mt-2 space-y-1">
              {duplicates.map((item) => (
                <li key={item.id}>{item.name} · {item.company} · {item.email || 'no email'} · {item.ownerName}</li>
              ))}
            </ul>
            <button type="button" className="mt-3 font-semibold underline" onClick={() => save(false, true)}>Save anyway</button>
          </Banner>
        </div>
      )}

      <div className="card !rounded-xl space-y-10 !px-6 !py-8">
        <section>
          <h2 className="mb-5 font-semibold text-slate-800">Lead Information</h2>
          <div className="grid gap-x-12 gap-y-4 lg:grid-cols-2">
            {visible.map(renderField)}
            {type && closeReasons(form.stage).length > 0 && (
              <>
                <Row label={`${form.stage} Reason`} required={isExitStage(form.stage)}>
                  <select className={input(isExitStage(form.stage))} required={isExitStage(form.stage)} value={form.closeReason} onChange={set('closeReason')}>
                    <option value="">-None-</option>
                    {closeReasons(form.stage).map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Row>
                <Row label="What happened">
                  <input className={input()} value={form.closeNote} onChange={set('closeNote')} />
                </Row>
              </>
            )}
          </div>
          {!type && <p className="mt-6 text-sm text-slate-400">Choose a lead type to fill in the rest of the details.</p>}
        </section>

        {type && (
          <>
            <section>
              <h2 className="mb-5 font-semibold text-slate-800">Address Information</h2>
              <fieldset className="max-w-xl rounded-xl border border-slate-300 px-5 pb-4 pt-2">
                <legend className="px-2 text-sm text-slate-700">Address</legend>
                <div className="space-y-4">
                  <Row label="Country / Region">
                    <select className={input()} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value, state: '' })}>
                      <option value="">-None-</option>
                      {COUNTRIES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Row>
                  <Row label="Flat / House No./ Building / Apartment Name">
                    <input className={input()} value={form.building} onChange={set('building')} />
                  </Row>
                  <Row label="Street Address"><input className={input()} value={form.street} onChange={set('street')} /></Row>
                  <Row label="City"><input className={input()} value={form.city} onChange={set('city')} /></Row>
                  <Row label="State / Province">
                    {states ? (
                      <select className={input()} value={form.state} onChange={set('state')}>
                        <option value="">-None-</option>
                        {states.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    ) : (
                      <input className={input()} value={form.state} onChange={set('state')} />
                    )}
                  </Row>
                  <Row label="Zip / Postal Code"><input className={input()} value={form.zip} onChange={set('zip')} /></Row>
                  <Row label="Coordinates">
                    <div className="grid grid-cols-2 gap-2">
                      <input className={input()} placeholder="Latitude" value={form.latitude} onChange={set('latitude')} />
                      <input className={input()} placeholder="Longitude" value={form.longitude} onChange={set('longitude')} />
                    </div>
                  </Row>
                  <div className="text-right">
                    <button
                      type="button"
                      className="text-sm text-slate-400 underline hover:text-slate-600"
                      onClick={() => setForm({ ...form, ...Object.fromEntries(ADDRESS_KEYS.map((key) => [key, ''])) })}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </fieldset>
            </section>

            <section>
              <h2 className="mb-5 font-semibold text-slate-800">Description Information</h2>
              <div className="max-w-3xl">
                <Row label="Description">
                  <textarea className={cx(input(), 'min-h-12')} value={form.notes} onChange={set('notes')} />
                </Row>
              </div>
            </section>
          </>
        )}
      </div>
    </form>
  );
}

function input(required = false) {
  return cx('field !rounded-md !py-2', required && '!border-l-[3px] !border-l-rose-500');
}

function Rupee({ value, onChange }) {
  return (
    <div className="flex">
      <span className="grid place-items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">Rs.</span>
      <input className="field !rounded-l-none !rounded-r-md !py-2" type="number" min="0" value={value} onChange={onChange} />
    </div>
  );
}

function Row({ label, required, children }) {
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 text-sm sm:grid-cols-[170px_1fr] sm:gap-5">
      <span className={cx('text-slate-600 sm:text-right', required && 'font-medium')}>{label}</span>
      <div>{children}</div>
    </div>
  );
}
