import { useEffect } from 'react';
import { colorFor, cx, initials, priorityStyle, stageStyle } from './lib';

export function Logo({ light = false, compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cx(
        'grid h-9 w-9 place-items-center rounded-xl shadow-sm',
        light ? 'bg-white/15 ring-1 ring-white/30' : 'bg-gradient-to-br from-blue-500 to-blue-700',
      )}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8L12 3z" fill="currentColor" stroke="none" />
          <path d="M7 16.5c1.8 2 4.2 3 5 3s3.2-1 5-3" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className={cx('text-[15px] font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
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
        className={cx('max-h-[92vh] w-full overflow-auto rounded-[28px] bg-white p-6 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-[460px]')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Close">
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
      <aside className="h-full w-full max-w-[420px] overflow-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
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
  const label = value === 'ADMIN' ? 'Admin' : value === 'MANAGER' ? 'Manager' : 'Rep';
  const tone = value === 'ADMIN' ? 'bg-slate-900 text-white' : value === 'MANAGER' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600';
  return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', tone)}>{label}</span>;
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}
