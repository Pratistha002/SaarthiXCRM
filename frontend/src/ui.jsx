import { useEffect } from 'react';
import { colorFor, cx, initials, priorityStyle, roleLabel, ROLES, stageStyle } from './lib';

export function Logo({ light = false, compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cx(
        'grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl',
        light && 'bg-white/95 ring-1 ring-white/40',
      )}>
        <img src="/saarthix-logo.png" alt="SaarthiX" className="h-10 w-10 object-contain" />
      </span>
      {!compact && (
        <span className={cx('text-[15px] font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900 dark:text-slate-100')}>
          SaarthiX CRM
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-xs';
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', dim)}
      style={{ background: colorFor(name) }}
    >
      {initials(name)}
    </span>
  );
}

export function StagePill({ value }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', stageStyle[value])}>{value}</span>;
}

export function PriorityPill({ value }) {
  return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', priorityStyle[value])}>{value}</span>;
}

export function Modal({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4" onMouseDown={onClose}>
      <div
        className={cx('max-h-[92vh] w-full overflow-auto rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900 dark:text-slate-100', wide ? 'max-w-2xl' : 'max-w-[460px]')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onMouseDown={onClose}>
      <aside className="flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Banner({ tone = 'info', children }) {
  const styles = {
    info: 'bg-sky-50 text-sky-800 ring-sky-100',
    good: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    warn: 'bg-amber-50 text-amber-800 ring-amber-100',
    danger: 'bg-rose-50 text-rose-700 ring-rose-100',
  };
  return <div className={cx('rounded-2xl px-4 py-3 text-sm ring-1', styles[tone] || styles.info)}>{children}</div>;
}

export function RolePill({ value }) {
  const lead = value === 'HEAD_OF_SALES' || value === 'ADMIN' || value === 'MANAGER';
  const tone = lead ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600';
  return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', tone)}>{roleLabel(value)}</span>;
}

export function RolePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLES.map((role) => {
        const selected = value === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={cx(
              'rounded-2xl border px-3 py-3 text-left transition',
              selected ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500',
            )}
          >
            <p className="text-sm font-semibold">{roleLabel(role)}</p>
            <p className={cx('mt-1 text-xs', selected ? 'text-white/75' : 'text-slate-400')}>
              {role === 'HEAD_OF_SALES' ? 'Add and remove teammates' : 'Work the shared pipeline'}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}
