const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatINR = (n, exact = false) => {
  const v = Number(n || 0);
  return exact && !Number.isInteger(v) ? inr2.format(v) : inr.format(v);
};

export const formatNumber = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0));

/** Timestamps are stored in UTC and rendered in the viewer's local time zone (BRD §11.1). */
export const formatDate = (d, opts = {}) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...opts }).format(new Date(d)) : '—';

export const formatDateTime = (d) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d)) : '—';

export function timeLeft(deadline, now = new Date()) {
  const ms = new Date(deadline) - now;
  if (ms <= 0) return { expired: true, label: 'Ended', d: 0, h: 0, m: 0, s: 0, urgent: false };
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  const label = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`;
  return { expired: false, label, d, h, m, s, urgent: ms < 12 * 36e5 };
}

export function relativeTime(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(d);
}

export const cx = (...c) => c.filter(Boolean).join(' ');

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const TICKET_TONE = { OPEN: 'amber', IN_PROGRESS: 'blue', ESCALATED: 'rose', RESOLVED: 'emerald' };
