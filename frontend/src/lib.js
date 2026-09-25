export const STAGES = ['New', 'Qualified', 'Proposal', 'Won', 'Lost'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const SOURCES = ['Cold Outreach', 'Event', 'Social', 'Website', 'Other', 'Referral'];
export const PURPOSES = ['Follow-up', 'Introduction', 'Proposal', 'Check-in', 'Closing'];
export const TONES = ['Formal', 'Friendly', 'Concise', 'Persuasive'];
export const ROLES = ['ADMIN', 'MANAGER', 'REP'];
export const WON_REASONS = ['Price', 'Product fit', 'Relationship', 'Speed', 'Referral', 'Other'];
export const LOST_REASONS = ['Price', 'Competitor', 'Timing', 'No sponsor', 'No budget', 'Other'];
export const WEIGHTS = { New: 15, Qualified: 40, Proposal: 70, Won: 100, Lost: 0 };

export function closeReasons(stage) {
  return stage === 'Lost' ? LOST_REASONS : WON_REASONS;
}

export const stageStyle = {
  New: 'bg-blue-50 text-blue-600',
  Qualified: 'bg-violet-50 text-violet-600',
  Proposal: 'bg-orange-50 text-orange-500',
  Won: 'bg-sky-50 text-sky-600',
  Lost: 'bg-rose-50 text-rose-500',
};

export const stageDot = {
  New: '#2f80ed',
  Qualified: '#7b61ff',
  Proposal: '#f2994a',
  Won: '#2d9cdb',
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

export function money(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
}

export function compact(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const text = millions >= 10 ? millions.toFixed(0) : String(Math.round(millions * 10) / 10);
    return `${sign}$${text}M`;
  }
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
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
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Manager';
  return 'Rep';
}
