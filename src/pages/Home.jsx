import { ArrowRight, BadgeCheck, CheckCircle2, Lock, MapPin, RefreshCcw, Search, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@shared/categories.js';
import { PILOT_CITIES } from '@shared/constants.js';
import { groupProgress } from '@shared/pricing.js';
import { CategoryArt, Countdown, DealCard } from '@/components/deal.jsx';
import { PriceDropVisual, SimpleSteps } from '@/components/explain.jsx';
import Icon from '@/components/Icon.jsx';
import { Button, ProgressBar, Skeleton } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useLiveDeals } from '@/hooks/useDeals.js';
import { cx, formatINR } from '@/lib/format.js';

const POPULAR = ['gym-fitness', 'yoga-wellness', 'online-classes', 'interior-home', 'electronics', 'home-kitchen', 'beauty', 'travel'];

function Hero() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-slate-50">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-200/40 blur-3xl" />
      <div className="container-page relative grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:py-20">
        <div className="animate-fade-up">
          <p className="text-sm font-bold text-brand-600">Saath Kharido, Sabse Sasta Paao!</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
            Buy together.
            <br />
            <span className="text-gradient">Pay less.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-600">
            Join a group with friends or neighbours. The more people join, the lower the price — for everyone.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/deals?q=${encodeURIComponent(q)}`);
            }}
            className="mt-7 flex max-w-lg gap-2 rounded-2xl bg-white p-2 shadow-soft ring-1 ring-ink-100"
            role="search"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “gym”, “yoga”, “earbuds”" aria-label="Search deals" className="h-12 w-full rounded-xl border-0 pl-10 text-ink-900 placeholder:text-ink-300 focus:ring-0" />
            </div>
            <Button type="submit" className="!h-12">Search</Button>
          </form>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
            {['Full refund if a group doesn’t fill', 'Verified sellers', 'Your price never goes up'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="animate-fade-up rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink-100 sm:p-8">
          <p className="font-display text-lg font-bold">How the price drops</p>
          <p className="mb-6 text-sm text-ink-500">Example: a ₹1,000 deal</p>
          <PriceDropVisual />
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">10 people joined → everyone saves 40%</p>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section className="container-page mt-12">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-xl font-bold">Browse by category</h2>
        <Link to="/deals" className="text-sm font-semibold text-brand-600 hover:underline">All categories</Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-8">
        {POPULAR.map((id) => {
          const c = CATEGORIES.find((x) => x.id === id);
          return (
            <Link key={id} to={`/deals?category=${id}`} className="group flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center ring-1 ring-ink-100 transition hover:-translate-y-0.5 hover:shadow-soft sm:w-auto">
              <span className={cx('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white', c.gradient)}>
                <Icon name={c.icon} className="h-6 w-6" />
              </span>
              <span className="text-xs font-semibold leading-tight text-ink-700">{c.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AlmostUnlocked({ deals }) {
  const items = deals
    .filter((d) => d.group?.state === 'OPEN')
    .sort((a, b) => groupProgress(b.group).pct - groupProgress(a.group).pct)
    .slice(0, 3);
  if (!items.length) return null;
  return (
    <section className="container-page mt-14">
      <h2 className="font-display text-xl font-bold">Almost unlocked 🔓</h2>
      <p className="mb-4 text-sm text-ink-500">These groups need just a few more people. Join and help unlock the price.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map(({ offer, group }) => {
          const p = groupProgress(group);
          return (
            <Link key={group.id} to={`/g/${group.id}`} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-100 transition hover:shadow-soft">
              <CategoryArt categoryId={offer.categoryId} image={offer.images?.[0]} className="h-20 w-20 shrink-0 rounded-xl" iconClass="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold leading-snug">{offer.title}</p>
                <p className="mt-1 text-sm"><b>{formatINR(group.nextJoinPrice)}</b> <span className="text-ink-400 line-through">{formatINR(offer.mrp)}</span></p>
                <ProgressBar value={p.pct} size="sm" className="mt-2" />
                <div className="mt-1 flex justify-between text-xs">
                  <span className="font-semibold text-brand-600">{p.remaining} more needed</span>
                  <Countdown deadline={group.deadline} compact />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const { deals, loading } = useLiveDeals();
  const { profile } = useAuth();
  const [city, setCity] = useState(profile?.city || 'Pune');
  const interests = profile?.interests || [];
  const sorted = [...deals].sort((a, b) => {
    const ia = interests.includes(a.offer.categoryId) ? 1 : 0;
    const ib = interests.includes(b.offer.categoryId) ? 1 : 0;
    return ib - ia || (b.offer.stats?.joins || 0) - (a.offer.stats?.joins || 0);
  });
  const shown = sorted.filter((d) => d.offer.city === city || d.offer.city === 'Online (All India)' || d.offer.fulfilment === 'PRODUCT').slice(0, 8);

  return (
    <div>
      <Hero />
      <section className="container-page">
        <SimpleSteps />
      </section>
      <Categories />

      <section className="container-page mt-14">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{interests.length ? 'Picked for you' : 'Popular deals'}</h2>
            <p className="flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-4 w-4" /> Showing deals for {city} and online</p>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {PILOT_CITIES.filter((c) => !c.startsWith('Online')).map((c) => (
              <button key={c} onClick={() => setCity(c)} className={cx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition', c === city ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300')}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[340px]" />) : shown.map(({ offer, group }) => <DealCard key={offer.id} offer={offer} group={group} />)}
        </div>
        {!loading && shown.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-ink-100">
            <p className="font-display text-lg font-bold">New deals are coming soon 🚀</p>
            <p className="mt-1 text-sm text-ink-500">We're onboarding verified gyms, teachers and sellers in {city}. Check back shortly!</p>
          </div>
        )}
        <div className="mt-6 text-center">
          <Button variant="secondary" to="/deals" icon={ArrowRight}>See all deals</Button>
        </div>
      </section>

      <AlmostUnlocked deals={deals} />

      <section className="container-page mt-14">
        <div className="grid gap-4 rounded-3xl bg-white p-6 ring-1 ring-ink-100 sm:grid-cols-3 sm:p-8">
          {[
            [RefreshCcw, 'Full refund guarantee', 'If a group doesn’t reach its target in time, you get all your money back.'],
            [BadgeCheck, 'Only verified sellers', 'Every gym, teacher, designer and brand is checked before listing.'],
            [Lock, 'Private & secure', 'Other members never see your phone number or address.'],
          ].map(([I, t, d]) => (
            <div key={t} className="flex gap-3">
              <I className="h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold">{t}</p>
                <p className="text-sm text-ink-500">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-500">
          <Store className="h-4 w-4" /> Run a gym, studio or business? <Link to="/partner" className="font-semibold text-brand-600 hover:underline">Sell on JodoDeal</Link>
        </p>
      </section>
    </div>
  );
}
