import { BadgeCheck, CheckCircle2, Clock, Copy, Crown, Lock, MapPin, Share2, Star, Timer, TrendingDown, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { categoryById } from '@shared/categories.js';
import { GROUP_STATE_META, ORDER_STATUS_META, BOOKING_STATUS_META } from '@shared/constants.js';
import { discountPct, groupProgress, nextTierInfo, sortTiers, tierIndexForCount } from '@shared/pricing.js';
import { useNow } from '@/hooks/useData.js';
import { cx, formatINR, timeLeft } from '@/lib/format.js';
import { call } from '@/services/api.js';
import Icon from './Icon.jsx';
import { Badge, ProgressBar } from './ui.jsx';

/** Decorative gradient art used when an offer has no uploaded photo. */
export function CategoryArt({ categoryId, image, className, iconClass = 'h-14 w-14', children }) {
  const cat = categoryById(categoryId) || {};
  if (image) {
    return (
      <div className={cx('relative overflow-hidden', className)}>
        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        {children}
      </div>
    );
  }
  return (
    <div className={cx('relative overflow-hidden bg-gradient-to-br', cat.gradient || 'from-brand-400 to-rose-500', className)}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden>
        <defs>
          <pattern id={`p-${categoryId}`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx="4" cy="4" r="2" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#p-${categoryId})`} />
      </svg>
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-black/10 blur-2xl" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-3xl bg-white/15 p-5 ring-1 ring-white/30 backdrop-blur-sm">
          <Icon name={cat.icon} className={cx('text-white drop-shadow', iconClass)} strokeWidth={1.6} />
        </div>
      </div>
      {children}
    </div>
  );
}

export function Countdown({ deadline, className, compact }) {
  const now = useNow(1000);
  const t = timeLeft(deadline, now);
  if (compact) {
    return (
      <span className={cx('inline-flex items-center gap-1 text-xs font-semibold', t.urgent ? 'text-rose-600' : 'text-ink-500', className)}>
        <Timer className="h-3.5 w-3.5" /> {t.label}
      </span>
    );
  }
  if (t.expired) return <span className={cx('text-sm font-semibold text-ink-400', className)}>Deadline passed</span>;
  const box = (v, l) => (
    <div className="flex min-w-[52px] flex-col items-center rounded-xl bg-ink-900 px-2 py-1.5 text-white">
      <span className="font-display text-lg font-bold tabular-nums">{String(v).padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-wider text-ink-300">{l}</span>
    </div>
  );
  return (
    <div className={cx('flex gap-1.5', className)} aria-label={t.label}>
      {box(t.d, 'days')}
      {box(t.h, 'hrs')}
      {box(t.m, 'min')}
      {box(t.s, 'sec')}
    </div>
  );
}

export function AvatarStack({ avatars = [], count = 0, max = 6, size = 'md' }) {
  const shown = avatars.slice(-max);
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((a, i) => (
          <span key={i} className={cx('flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white', dim)} style={{ background: `hsl(${a.hue} 70% 52%)` }} aria-hidden>
            {a.initial}
          </span>
        ))}
        {count > shown.length && (
          <span className={cx('flex items-center justify-center rounded-full bg-ink-100 font-bold text-ink-600 ring-2 ring-white', dim)}>+{count - shown.length}</span>
        )}
      </div>
    </div>
  );
}

export function GroupStateBadge({ state }) {
  const m = GROUP_STATE_META[state] || { label: state, tone: 'slate' };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function OrderStatusBadge({ status }) {
  const m = ORDER_STATUS_META[status] || { label: status, tone: 'slate' };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function BookingStatusBadge({ status }) {
  const m = BOOKING_STATUS_META[status] || { label: status, tone: 'slate' };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function VerifiedBadge({ className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-semibold text-emerald-600', className)} title="Verified by JodoDeal">
      <BadgeCheck className="h-4 w-4" /> Verified
    </span>
  );
}

export function Rating({ value, count, className }) {
  if (!count) return <span className={cx('text-xs text-ink-400', className)}>New</span>;
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-semibold text-ink-700', className)}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(value).toFixed(1)} <span className="font-normal text-ink-400">({count})</span>
    </span>
  );
}

export function Stars({ value, onChange, size = 'h-7 w-7' }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange?.(n)} className="transition hover:scale-110">
          <Star className={cx(size, n <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
        </button>
      ))}
    </div>
  );
}

/** Group progress widget: truthful paid-member count, next tier, deadline (BRD §7.2). */
export function GroupProgressCard({ group, offer, compact }) {
  const { pct, remaining } = groupProgress(group);
  const next = nextTierInfo({ mrp: group.mrp, tiers: group.tiers }, group.paidCount || 0);
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold text-ink-900">
            {group.paidCount || 0}
            <span className="text-base font-semibold text-ink-400"> / {group.minGroupSize} joined</span>
          </p>
          <p className="text-xs text-ink-500">Only paid, confirmed members are counted</p>
        </div>
        <AvatarStack avatars={group.avatars} count={group.paidCount} />
      </div>
      <ProgressBar value={pct} size="lg" tone={remaining === 0 ? 'emerald' : 'brand'} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {remaining > 0 ? (
          <span className="font-semibold text-brand-700">
            <Users className="mr-1 inline h-4 w-4" />
            {remaining} more to unlock the deal
          </span>
        ) : (
          <span className="font-semibold text-emerald-700">
            <CheckCircle2 className="mr-1 inline h-4 w-4" />
            Group confirmed — join instantly!
          </span>
        )}
        {!compact && next && (
          <span className="text-ink-500">
            <TrendingDown className="mr-1 inline h-4 w-4 text-emerald-600" />
            {next.membersNeeded} more → {formatINR(next.tier.price)}
          </span>
        )}
      </div>
      {!compact && offer && <Countdown deadline={group.deadline} />}
    </div>
  );
}

/** Price tier ladder: shows exactly which tier is unlocked (BRD §5.2, AC-01). */
export function TierLadder({ mrp, tiers, count = 0, minGroupSize }) {
  const sorted = sortTiers(tiers);
  const active = tierIndexForCount(sorted, count);
  return (
    <ol className="space-y-2">
      <li className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-ink-400">
        <span>Standard price</span>
        <span className="line-through">{formatINR(mrp)}</span>
      </li>
      {sorted.map((t, i) => {
        const unlocked = i <= active;
        const current = i === active;
        return (
          <li
            key={t.minMembers}
            className={cx(
              'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ring-1 transition',
              current ? 'bg-emerald-50 ring-emerald-300' : unlocked ? 'bg-white ring-ink-100' : 'bg-white ring-ink-100',
            )}
          >
            <span className="flex items-center gap-2">
              {unlocked ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-ink-300" />}
              <span className={cx('font-semibold', unlocked ? 'text-ink-900' : 'text-ink-500')}>
                {t.minMembers === 1 ? 'Join now' : `${t.minMembers}+ members`}
              </span>
              {t.minMembers === minGroupSize && <Badge tone="brand" icon={Crown}>Target</Badge>}
            </span>
            <span className="flex items-center gap-2">
              <span className={cx('font-display font-bold', current ? 'text-emerald-700' : 'text-ink-900')}>{formatINR(t.price)}</span>
              <span className="w-12 text-right text-xs font-semibold text-emerald-600">-{discountPct(mrp, t.price)}%</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DealCard({ offer, group }) {
  const best = sortTiers(offer.tiers).at(-1);
  const cat = categoryById(offer.categoryId);
  const g = group;
  const progress = g ? groupProgress(g) : null;
  return (
    <Link to={`/deal/${offer.id}`} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-100/70 transition hover:-translate-y-1 hover:shadow-lift focus-visible:ring-4 focus-visible:ring-brand-200">
      <CategoryArt categoryId={offer.categoryId} image={offer.images?.[0]} className="aspect-[16/10]">
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink-900 shadow-sm">{cat?.name}</span>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-extrabold text-white shadow">
          Up to {discountPct(offer.mrp, best?.price)}% off
        </div>
        {g && (
          <div className="absolute bottom-3 left-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Clock className="mr-1 inline h-3 w-3" />
            <Countdown deadline={g.deadline} compact className="!text-white" />
          </div>
        )}
      </CategoryArt>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-ink-500">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {offer.city}
          </span>
          <Rating value={offer.rating} count={offer.ratingCount} />
        </div>
        <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink-900 group-hover:text-brand-700">{offer.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
          {offer.merchantName} {offer.merchantVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
        </p>
        <div className="mt-3 flex items-end gap-2">
          <span className="font-display text-xl font-extrabold text-ink-900">{formatINR(best?.price)}</span>
          <span className="pb-0.5 text-sm text-ink-400 line-through">{formatINR(offer.mrp)}</span>
          <span className="pb-0.5 text-xs font-medium text-ink-500">at {best?.minMembers}+ members</span>
        </div>
        <div className="mt-auto pt-3">
          {g ? (
            <>
              <div className="mb-1.5 flex justify-between text-xs font-semibold">
                <span className="text-ink-700">
                  <Users className="mr-1 inline h-3.5 w-3.5" />
                  {g.paidCount}/{g.minGroupSize} joined
                </span>
                <span className={progress.remaining ? 'text-brand-600' : 'text-emerald-600'}>{progress.remaining ? `${progress.remaining} to go` : 'Unlocked ✓'}</span>
              </div>
              <ProgressBar value={progress.pct} size="sm" tone={progress.remaining ? 'brand' : 'emerald'} />
            </>
          ) : (
            <p className="text-xs font-semibold text-brand-600">Start a group and invite friends →</p>
          )}
        </div>
      </div>
    </Link>
  );
}

/** WhatsApp-first sharing with tracked share counts (BRD §7.2, §16.2). */
export function ShareBar({ offer, group, referralCode, className }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/g/${group.id}${referralCode ? `?ref=${referralCode}` : ''}`;
  const remaining = Math.max(0, (group.minGroupSize || 0) - (group.paidCount || 0));
  const text = `🔥 Join my JodoDeal group for "${offer.title}"! ${remaining > 0 ? `Only ${remaining} more needed to unlock ${formatINR(group.nextJoinPrice)}.` : `Group unlocked at ${formatINR(group.nextJoinPrice)}!`} Saath Kharido, Sabse Sasta Paao 👉 ${url}`;
  const track = (channel) => call('trackShare', { offerId: offer.id, groupId: group.id, channel }).catch(() => {});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied!');
      track('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };
  const native = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: offer.title, text, url });
        track('native');
      } catch {
        /* cancelled */
      }
    } else copy();
  };
  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => track('whatsapp')}
        className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(37,211,102,.7)] transition hover:brightness-105"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.48-8.41z" />
        </svg>
        Share on WhatsApp
      </a>
      <button onClick={copy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50">
        <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}
      </button>
      <button onClick={native} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50" aria-label="More share options">
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
