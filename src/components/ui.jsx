import { Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format.js';

const BTN = {
  primary: 'bg-brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95',
  dark: 'bg-ink-900 text-white hover:bg-ink-800',
  secondary: 'bg-white text-ink-900 ring-1 ring-ink-200 hover:ring-ink-300 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  whatsapp: 'bg-[#25D366] text-white hover:brightness-105 shadow-[0_10px_30px_-10px_rgba(37,211,102,.7)]',
};
const SIZE = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-5 text-sm gap-2', lg: 'h-14 px-7 text-base gap-2' };

export function Button({ as, to, href, variant = 'primary', size = 'md', loading, icon: IconCmp, className, children, disabled, ...rest }) {
  const cls = cx(
    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
    BTN[variant],
    SIZE[size],
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : IconCmp ? <IconCmp className="h-4 w-4" aria-hidden /> : null}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>;
  const Cmp = as || 'button';
  return (
    <Cmp className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </Cmp>
  );
}

export function Card({ className, children, ...rest }) {
  return (
    <div className={cx('rounded-2xl bg-white shadow-soft ring-1 ring-ink-100/70', className)} {...rest}>
      {children}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  dark: 'bg-ink-900 text-white ring-ink-900',
};

export function Badge({ tone = 'slate', icon: IconCmp, className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONES[tone] || TONES.slate, className)}>
      {IconCmp && <IconCmp className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children, required, className }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-semibold text-ink-800">
          {label} {required && <span className="text-brand-600">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-rose-600">
          {error}
        </span>
      )}
    </label>
  );
}

const INPUT = 'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 placeholder:text-ink-300 focus:ring-2 focus:ring-inset focus:ring-brand-500 transition';

export function Input({ className, icon: IconCmp, ...rest }) {
  if (IconCmp) {
    return (
      <div className="relative">
        <IconCmp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" aria-hidden />
        <input className={cx(INPUT, 'pl-9', className)} {...rest} />
      </div>
    );
  }
  return <input className={cx(INPUT, className)} {...rest} />;
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx(INPUT, 'min-h-[96px]', className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cx(INPUT, 'pr-9', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-2.5 text-sm text-ink-700', className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl p-3 text-left hover:bg-ink-50">
      <span>
        <span className="block text-sm font-semibold text-ink-800">{label}</span>
        {description && <span className="block text-xs text-ink-400">{description}</span>}
      </span>
      <span className={cx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-500' : 'bg-ink-200')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx('h-6 w-6 animate-spin text-brand-500', className)} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function Skeleton({ className }) {
  return (
    <div className={cx('relative overflow-hidden rounded-xl bg-ink-100/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function EmptyState({ icon: IconCmp, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-100 bg-white/60 px-6 py-14 text-center', className)}>
      {IconCmp && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <IconCmp className="h-7 w-7" />
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-lift animate-pop sm:rounded-3xl', width)}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-100 bg-white px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-ink-100/70 p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
            value === t.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-xs', value === t.value ? 'bg-brand-100 text-brand-700' : 'bg-ink-200 text-ink-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, className, tone = 'brand', size = 'md' }) {
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3.5' : 'h-2.5';
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-ink-100', h, className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cx('h-full rounded-full transition-all duration-700', tone === 'brand' ? 'bg-brand-gradient' : 'bg-emerald-500')}
        style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function StatCard({ icon: IconCmp, label, value, hint, tone = 'brand' }) {
  const toneCls = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        {IconCmp && (
          <div className={cx('flex h-11 w-11 items-center justify-center rounded-xl', toneCls)}>
            <IconCmp className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, action, className }) {
  return (
    <div className={cx('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-600">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-2xl text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon: IconCmp, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {IconCmp && (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <IconCmp className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      {children}
    </div>
  );
}

export function KeyValue({ label, value, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 py-2 text-sm', className)}>
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-semibold text-ink-900">{value}</span>
    </div>
  );
}
