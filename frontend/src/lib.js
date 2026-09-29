export const FUNNEL_STAGES = ['New', 'Attempted Contact', 'Contacted', 'Interested', 'Qualified', 'Converted'];
export const EXIT_STAGES = ['Junk', 'Not Interested', 'Lost'];
export const STAGES = [...FUNNEL_STAGES, ...EXIT_STAGES];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const SOURCES = ['Cold Outreach', 'Event', 'Social', 'Website', 'Other', 'Referral'];
export const ROLES = ['HEAD_OF_SALES', 'SALES_EXECUTIVE'];
export const WON_REASONS = ['Price', 'Product fit', 'Relationship', 'Speed', 'Referral', 'Other'];
export const LOST_REASONS = ['Price', 'Competitor', 'Timing', 'No response', 'No budget', 'Other'];
export const JUNK_REASONS = ['Invalid contact details', 'Duplicate', 'Spam / fake', 'Test entry', 'Other'];
export const NOT_INTERESTED_REASONS = ['No requirement', 'Too expensive', 'Chose another option', 'Bad timing', 'Other'];
export const WEIGHTS = {
  New: 5, 'Attempted Contact': 10, Contacted: 20, Interested: 40, Qualified: 60, Converted: 100, Junk: 0, 'Not Interested': 0, Lost: 0,
};
export const LEAD_TYPES = ['Student', 'Institute', 'Industry'];
export const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
export const INDUSTRIES = [
  'ASP (Application Service Provider)', 'Data/Telecom OEM', 'ERP (Enterprise Resource Planning)', 'Government/Military',
  'Large Enterprise', 'ManagementISV', 'MSP (Management Service Provider)', 'Network Equipment Enterprise',
  'Non-management ISV', 'Optical Networking', 'Service Provider', 'Small/Medium Enterprise', 'Storage Equipment',
  'Storage Service Provider', 'Systems Integrator', 'Wireless Industry',
];
export const RATINGS = ['Acquired', 'Active', 'Market Failed', 'Project Cancelled', 'Shut Down'];
export const COUNTRIES = [
  'India', 'Australia', 'Bangladesh', 'Canada', 'China', 'France', 'Germany', 'Indonesia', 'Italy', 'Japan',
  'Malaysia', 'Nepal', 'Netherlands', 'New Zealand', 'Pakistan', 'Philippines', 'Saudi Arabia', 'Singapore',
  'South Africa', 'Spain', 'Sri Lanka', 'Switzerland', 'Thailand', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Vietnam',
];
export const STATES = {
  India: [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  ],
};

export function closeReasons(stage) {
  if (stage === 'Junk') return JUNK_REASONS;
  if (stage === 'Not Interested') return NOT_INTERESTED_REASONS;
  if (stage === 'Lost') return LOST_REASONS;
  if (stage === 'Converted') return WON_REASONS;
  return [];
}

export function isExitStage(stage) {
  return EXIT_STAGES.includes(stage);
}

export const CALL_OUTCOMES = ['Connected', 'No Answer', 'Busy', 'Wrong Number', 'Call Back Later'];
export const CALL_RESPONSES = ['Interested', 'Not Interested', 'Needs More Information', 'Wants Demo', 'Wants Proposal', 'Call Back Later', 'Other'];
export const NO_FURTHER_ACTION = 'No Further Action';
export const NEXT_ACTIONS = [NO_FURTHER_ACTION, 'Call', 'Follow-up', 'Meeting', 'Demo', 'Send Proposal', 'Email', 'WhatsApp'];
export const REMINDERS = ['None', '15 minutes before', '1 hour before', '1 day before'];

export function primaryPhone(lead) {
  return (lead?.phone || lead?.mobile || '').trim();
}

export function isDialable(phone) {
  return /^\+?\d{7,15}$/.test((phone || '').replace(/[\s().-]/g, ''));
}

const CALL_STAGE = {
  'No Answer': 'Attempted Contact',
  Busy: 'Attempted Contact',
  'Wrong Number': 'Junk',
  'Call Back Later': 'Contacted',
};

const RESPONSE_STAGE = {
  Interested: 'Interested',
  'Not Interested': 'Not Interested',
  'Needs More Information': 'Contacted',
  'Wants Demo': 'Interested',
  'Wants Proposal': 'Qualified',
  'Call Back Later': 'Contacted',
  Other: 'Contacted',
};

export const CALL_EXIT_REASON = { Junk: 'Invalid contact details', 'Not Interested': 'No requirement' };

/** Suggests a status from the call result without ever moving a lead backwards in the funnel. */
export function suggestStage(outcome, response, current) {
  const target = outcome === 'Connected' ? RESPONSE_STAGE[response] : CALL_STAGE[outcome];
  if (!target || current === 'Converted') return current;
  if (isExitStage(current) && outcome !== 'Connected') return current;
  if (isExitStage(target) || isExitStage(current)) return target;
  return FUNNEL_STAGES.indexOf(current) >= FUNNEL_STAGES.indexOf(target) ? current : target;
}

export const stageStyle = {
  New: 'bg-blue-50 text-blue-600',
  'Attempted Contact': 'bg-cyan-50 text-cyan-700',
  Contacted: 'bg-indigo-50 text-indigo-600',
  Interested: 'bg-amber-50 text-amber-600',
  Qualified: 'bg-violet-50 text-violet-600',
  Converted: 'bg-emerald-50 text-emerald-600',
  Junk: 'bg-slate-100 text-slate-500',
  'Not Interested': 'bg-orange-50 text-orange-600',
  Lost: 'bg-rose-50 text-rose-500',
};

export const stageDot = {
  New: '#2f80ed',
  'Attempted Contact': '#06b6d4',
  Contacted: '#6366f1',
  Interested: '#f2994a',
  Qualified: '#7b61ff',
  Converted: '#10b981',
  Junk: '#94a3b8',
  'Not Interested': '#f97316',
  Lost: '#eb5757',
};

export const priorityStyle = {
  High: 'bg-rose-50 text-rose-500',
  Medium: 'bg-amber-50 text-amber-600',
  Low: 'bg-emerald-50 text-emerald-600',
};

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#d97706', '#db2777', '#4f46e5', '#059669', '#ea580c'];

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'SX';
}

export function colorFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 3)) % COLORS.length;
  return COLORS[hash];
}

export const CLOSE_RANGES = ['Any time', 'Today', 'This Week', 'This Month', 'Next Month', 'Custom'];
export const CLOSED_PERIODS = ['This Month', 'Last Month', 'This Quarter', 'This Year', 'All time'];

/** Local-calendar date range (yyyy-MM-dd) for the pipeline's date filters. */
export function dateRange(key) {
  const now = new Date();
  const day = (d) => isoDay(d);
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'Today': return { from: day(now), to: day(now) };
    case 'This Week': {
      const start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: day(start), to: day(end) };
    }
    case 'This Month': return { from: day(new Date(y, m, 1)), to: day(new Date(y, m + 1, 0)) };
    case 'Next Month': return { from: day(new Date(y, m + 1, 1)), to: day(new Date(y, m + 2, 0)) };
    case 'Last Month': return { from: day(new Date(y, m - 1, 1)), to: day(new Date(y, m, 0)) };
    case 'This Quarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: day(new Date(y, q, 1)), to: day(new Date(y, q + 3, 0)) };
    }
    case 'This Year': return { from: day(new Date(y, 0, 1)), to: day(new Date(y, 11, 31)) };
    default: return { from: '', to: '' };
  }
}

const ACTION_ICONS = { Call: '📞', 'Follow-up': '📞', Meeting: '📅', Demo: '📅', 'Send Proposal': '📧', Email: '📧', WhatsApp: '💬' };

export function nextActionLabel(action) {
  if (!action) return null;
  const when = action.dueAt
    ? `${new Date(action.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${prettyTime(action.dueAt)}`
    : new Date(`${action.dueDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return { icon: ACTION_ICONS[action.type] || '☑', type: action.type, when };
}

export function money(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

export function compact(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const short = (n) => (n >= 10 ? n.toFixed(0) : String(Math.round(n * 10) / 10));
  if (abs >= 10_000_000) return `${sign}₹${short(abs / 10_000_000)}Cr`;
  if (abs >= 100_000) return `${sign}₹${short(abs / 100_000)}L`;
  if (abs >= 10_000) return `${sign}₹${Math.round(abs / 1000)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function ago(iso) {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr ago`;
  const days = Math.round(seconds / 86400);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? 'about 1 month ago' : `${months} months ago`;
  return 'about 1 year ago';
}

export function prettyDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function prettyTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function dueLabel(day) {
  if (!day) return '';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function isOverdue(task) {
  if (!task || task.status === 'Completed' || !task.dueDate) return false;
  if (task.dueAt) return new Date(task.dueAt) < new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function isoDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const weekday = next.getDay();
  next.setDate(next.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return next;
}

export function weekDays(anchor = new Date()) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function roleLabel(role) {
  if (role === 'HEAD_OF_SALES' || role === 'ADMIN' || role === 'MANAGER') return 'Head of Sales';
  return 'Sales Executive';
}

export function isHeadOfSales(role) {
  return role === 'HEAD_OF_SALES' || role === 'ADMIN' || role === 'MANAGER';
}

export function isPlatformAdmin(user) {
  if (!user) return false;
  if (user.platformAdmin) return true;
  const key = String(user.email || user.name || '').trim().toUpperCase();
  return key === 'ADMIN';
}
