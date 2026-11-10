import { ShieldCheck, Share2, ShoppingBag, User } from 'lucide-react';
import { cx, formatINR } from '@/lib/format.js';

const EXAMPLE = { mrp: 1000, tiers: [{ minMembers: 1, price: 900 }, { minMembers: 5, price: 750 }, { minMembers: 10, price: 600 }] };

/** Visual: more people join → price goes down. Plain-language core idea of the app. */
export function PriceDropVisual({ mrp = EXAMPLE.mrp, tiers = EXAMPLE.tiers, dark = false, className }) {
  const sorted = [...tiers].sort((a, b) => a.minMembers - b.minMembers).slice(0, 3);
  const max = mrp;
  return (
    <div className={cx('grid grid-cols-3 items-end gap-3', className)}>
      {sorted.map((t, i) => (
        <div key={t.minMembers} className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-7 flex-wrap items-end justify-center gap-0.5">
            {Array.from({ length: Math.min(i === 0 ? 1 : i === 1 ? 3 : 6, 6) }).map((_, k) => (
              <User key={k} className={cx('h-4 w-4', dark ? 'text-white/80' : 'text-ink-400')} />
            ))}
          </div>
          <div
            className={cx('w-full rounded-t-xl transition-all', i === sorted.length - 1 ? 'bg-emerald-500' : dark ? 'bg-white/25' : 'bg-ink-200')}
            style={{ height: `${Math.round((t.price / max) * 96)}px` }}
          />
          <p className={cx('mt-2 font-display text-lg font-extrabold', dark ? 'text-white' : 'text-ink-900', i === sorted.length - 1 && '!text-emerald-500')}>{formatINR(t.price)}</p>
          <p className={cx('text-xs', dark ? 'text-white/70' : 'text-ink-500')}>{t.minMembers === 1 ? 'Just you' : `${t.minMembers} people`}</p>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  { icon: ShoppingBag, title: 'Pick a deal', text: 'Gyms, classes, home services or products.' },
  { icon: Share2, title: 'Invite friends', text: 'More people join → the price drops for everyone.' },
  { icon: ShieldCheck, title: 'Pay safely', text: "Not enough people? You get a full refund." },
];

export function SimpleSteps({ dark = false, className }) {
  return (
    <ol className={cx('grid gap-3 sm:grid-cols-3', className)}>
      {STEPS.map((s, i) => (
        <li key={s.title} className={cx('flex items-start gap-3 rounded-2xl p-4', dark ? 'bg-white/10 ring-1 ring-white/15' : 'bg-white ring-1 ring-ink-100')}>
          <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold', dark ? 'bg-white text-brand-600' : 'bg-brand-50 text-brand-600')}>
            <s.icon className="h-5 w-5" />
          </span>
          <span>
            <span className={cx('block text-sm font-bold', dark ? 'text-white' : 'text-ink-900')}>
              {i + 1}. {s.title}
            </span>
            <span className={cx('block text-sm', dark ? 'text-white/75' : 'text-ink-500')}>{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
