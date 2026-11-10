import {
  ArrowRight,
  BadgeCheck,
  BadgeIndianRupee,
  CheckCircle2,
  Dumbbell,
  Flame,
  GraduationCap,
  HandCoins,
  Lock,
  MapPin,
  Package,
  RefreshCcw,
  Search,
  Share2,
  ShieldCheck,
  Sofa,
  Sparkles,
  Store,
  TimerReset,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@shared/categories.js';
import { PILOT_CITIES } from '@shared/constants.js';
import { discountPct, groupProgress, sortTiers } from '@shared/pricing.js';
import { AvatarStack, CategoryArt, Countdown, DealCard } from '@/components/deal.jsx';
import Icon from '@/components/Icon.jsx';
import { Button, ProgressBar, SectionHeading, Skeleton } from '@/components/ui.jsx';
import { useLiveDeals } from '@/hooks/useDeals.js';
import { cx, formatINR, formatNumber } from '@/lib/format.js';

function Hero({ deals, groups }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('Pune');
  const spotlight = useMemo(() => {
    const open = deals.filter((d) => d.group && d.group.state === 'OPEN');
    return open.sort((a, b) => b.group.paidCount / b.group.minGroupSize - a.group.paidCount / a.group.minGroupSize)[0] || deals[0];
  }, [deals]);
  const providers = new Set(deals.map((d) => d.offer.merchantId)).size;

  return (
    <section className="hero-mesh relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <div className="container-page relative grid items-center gap-12 py-14 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> India's social group-buying marketplace
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Saath Kharido,
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-brand-400 to-pink-400 bg-clip-text text-transparent">Sabse Sasta Paao!</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-200">
            Team up with friends, neighbours and colleagues to unlock merchant-approved group prices on gym memberships, online classes, home interiors and everyday products.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/deals?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`);
            }}
            className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-lift sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to buy together?" aria-label="Search" className="h-12 w-full rounded-xl border-0 pl-10 text-ink-900 placeholder:text-ink-400 focus:ring-0" />
            </div>
            <div className="relative sm:w-40">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
              <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className="h-12 w-full rounded-xl border-0 bg-ink-50 pl-9 text-sm font-semibold text-ink-800 focus:ring-2 focus:ring-brand-500">
                {PILOT_CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="lg" className="sm:!h-12">
              Find deals
            </Button>
          </form>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {[
              [deals.length, 'live deals'],
              [groups.length, 'active groups'],
              [providers, 'verified providers'],
            ].map(([n, l]) => (
              <div key={l}>
                <span className="font-display text-2xl font-bold text-white">{formatNumber(n)}</span> <span className="text-ink-300">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {spotlight?.group && (
          <div className="relative mx-auto w-full max-w-md animate-fade-up lg:mx-0">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-500/40 to-pink-500/30 blur-3xl" />
            <Link to={`/g/${spotlight.group.id}`} className="relative block overflow-hidden rounded-3xl bg-white text-ink-900 shadow-lift ring-1 ring-white/20 transition hover:-translate-y-1">
              <CategoryArt categoryId={spotlight.offer.categoryId} className="h-44">
                <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-600 shadow">
                  <Flame className="h-3.5 w-3.5" /> Group forming now
                </span>
              </CategoryArt>
              <div className="p-5">
                <p className="text-xs font-semibold text-ink-400">{spotlight.offer.merchantName}</p>
                <h3 className="mt-0.5 font-display text-lg font-bold leading-snug">{spotlight.offer.title}</h3>
                <div className="mt-3 flex items-end gap-2">
                  <span className="font-display text-2xl font-extrabold">{formatINR(spotlight.group.nextJoinPrice)}</span>
                  <span className="pb-1 text-sm text-ink-400 line-through">{formatINR(spotlight.offer.mrp)}</span>
                  <span className="pb-1 text-sm font-bold text-emerald-600">{discountPct(spotlight.offer.mrp, spotlight.group.nextJoinPrice)}% off</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <AvatarStack avatars={spotlight.group.avatars} count={spotlight.group.paidCount} size="sm" />
                  <span className="font-semibold text-brand-600">{groupProgress(spotlight.group).remaining} spots to unlock</span>
                </div>
                <ProgressBar value={groupProgress(spotlight.group).pct} className="mt-2.5" />
                <div className="mt-4 flex items-center justify-between">
                  <Countdown deadline={spotlight.group.deadline} compact />
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-600">
                    Join group <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
            <div className="absolute -left-6 bottom-10 hidden animate-float rounded-2xl bg-white px-4 py-3 text-ink-900 shadow-lift sm:block">
              <p className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Price unlocked!
              </p>
              <p className="text-xs text-ink-500">Every member gets their own booking</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryStrip() {
  return (
    <section className="container-page -mt-8 relative z-10">
      <div className="no-scrollbar flex gap-3 overflow-x-auto rounded-3xl bg-white p-4 shadow-lift ring-1 ring-ink-100 sm:grid sm:grid-cols-7 sm:overflow-visible">
        {CATEGORIES.slice(0, 14).map((c) => (
          <Link key={c.id} to={`/deals?category=${c.id}`} className="group flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl p-2 text-center transition hover:bg-ink-50 sm:w-auto">
            <span className={cx('flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-soft transition group-hover:scale-110 group-hover:shadow-lift', c.gradient)}>
              <Icon name={c.icon} className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold leading-tight text-ink-700">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HowItWorksStrip() {
  const steps = [
    { icon: Search, title: 'Find a deal', text: 'Browse verified offers with clear tiers, inclusions, exclusions and terms.' },
    { icon: Users, title: 'Join or start a group', text: 'Pay securely to join. Only paid members count toward progress.' },
    { icon: Share2, title: 'Invite on WhatsApp', text: 'Share your group link. Every new member brings the price down.' },
    { icon: BadgeIndianRupee, title: 'Unlock & enjoy', text: 'Target reached? You get your own order, membership or booking. Missed? Full refund.' },
  ];
  return (
    <section className="container-page mt-20">
      <SectionHeading eyebrow="How it works" title="Better prices, together — in 4 simple steps" subtitle="A group is just a pricing campaign. Each member always gets their own separate order, membership, class seat or project." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="relative rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-100">
            <span className="absolute right-5 top-5 font-display text-5xl font-extrabold text-ink-100">{i + 1}</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              <s.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-5 font-display text-lg font-bold">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingSoon({ deals }) {
  const items = deals
    .filter((d) => d.group?.state === 'OPEN')
    .sort((a, b) => new Date(a.group.deadline) - new Date(b.group.deadline))
    .slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="container-page mt-20">
      <SectionHeading eyebrow="Active groups" title="Groups closing soon" subtitle="Help these groups reach their target before the timer runs out." action={<Button variant="secondary" to="/deals?sort=ending">See all</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(({ offer, group }) => {
          const p = groupProgress(group);
          return (
            <Link key={group.id} to={`/g/${group.id}`} className="group flex gap-4 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100 transition hover:shadow-lift">
              <CategoryArt categoryId={offer.categoryId} image={offer.images?.[0]} className="h-28 w-28 shrink-0 rounded-2xl" iconClass="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-ink-400">{offer.merchantName} · {offer.city}</p>
                  <Countdown deadline={group.deadline} compact />
                </div>
                <h3 className="mt-1 line-clamp-1 font-display font-bold group-hover:text-brand-700">{offer.title}</h3>
                <p className="mt-1 text-sm">
                  <span className="font-display text-lg font-extrabold">{formatINR(group.nextJoinPrice)}</span> <span className="text-ink-400 line-through">{formatINR(offer.mrp)}</span>
                </p>
                <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                  <span>{group.paidCount}/{group.minGroupSize} joined</span>
                  <span className="text-brand-600">{p.remaining} more needed</span>
                </div>
                <ProgressBar value={p.pct} size="sm" className="mt-1.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PilotVerticals() {
  const items = [
    { icon: Dumbbell, title: 'Gym & yoga memberships', text: 'Branch-specific plans, clear activation rules and QR check-in.', to: '/deals?category=gym-fitness', grad: 'from-orange-500 to-rose-500' },
    { icon: GraduationCap, title: 'Online class cohorts', text: 'Seat-capped cohorts with start dates, syllabus and instructor profiles.', to: '/deals?category=online-classes', grad: 'from-violet-500 to-indigo-600' },
    { icon: Sofa, title: 'Interiors & home services', text: 'Fixed-scope packages, site visits, itemised quotes and milestones.', to: '/deals?category=interior-home', grad: 'from-amber-500 to-orange-600' },
    { icon: Package, title: 'Everyday products', text: 'Each buyer gets their own parcel, tracking and easy returns.', to: '/deals?type=PRODUCT', grad: 'from-slate-700 to-ink-900' },
  ];
  return (
    <section className="container-page mt-20">
      <SectionHeading eyebrow="More than shopping" title="Products and services, one group engine" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Link key={it.title} to={it.to} className={cx('group relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift', it.grad)}>
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
            <it.icon className="h-9 w-9" strokeWidth={1.7} />
            <h3 className="mt-8 font-display text-lg font-bold">{it.title}</h3>
            <p className="mt-1.5 text-sm text-white/80">{it.text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold">
              Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Trust() {
  const items = [
    { icon: BadgeCheck, title: 'Verified providers', text: 'Every merchant passes KYC & business verification before publishing.' },
    { icon: Lock, title: 'Transparent pricing', text: 'Total price, taxes, fees, inclusions & exclusions — all shown before you pay.' },
    { icon: RefreshCcw, title: 'Refund guarantee', text: "Group didn't fill? Automatic full refund to your original payment method." },
    { icon: ShieldCheck, title: 'Your data stays private', text: 'Other members never see your phone, address or booking details.' },
    { icon: TimerReset, title: 'No fake urgency', text: 'Real participant counts and real deadlines. Never fabricated.' },
    { icon: HandCoins, title: 'Price never goes up', text: 'Your checkout price is locked. Lower tiers can only refund you the difference.' },
  ];
  return (
    <section className="container-page mt-20">
      <div className="overflow-hidden rounded-[2rem] bg-ink-950 p-8 text-white sm:p-12">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-400">Built on trust</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-tight">Group buying that's honest by design</h2>
            <p className="mt-4 text-ink-300">We built JodoDeal around clear rules: what you see before checkout is exactly what you get — and if a group doesn't make it, you don't pay.</p>
            <Button to="/how-it-works" variant="secondary" className="mt-6">
              Read our rules
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.title} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <it.icon className="h-6 w-6 text-brand-400" />
                <h3 className="mt-3 font-bold">{it.title}</h3>
                <p className="mt-1 text-sm text-ink-300">{it.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MerchantCta() {
  return (
    <section className="container-page mt-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-brand-gradient p-8 text-white shadow-glow sm:p-12">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-40 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Store className="h-10 w-10" />
            <h2 className="mt-4 font-display text-3xl font-bold">Gym, studio, educator or brand? Get many customers in one campaign.</h2>
            <p className="mt-2 text-white/85">Set your own group tiers and capacity. Customers bring their friends. You fulfil confirmed demand — no wasted discounts.</p>
          </div>
          <div className="flex gap-3">
            <Button to="/partner" variant="dark" size="lg">
              Become a partner
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { deals, groups, loading } = useLiveDeals();
  const [city, setCity] = useState('Pune');
  const trending = [...deals].sort((a, b) => (b.offer.stats?.joins || 0) - (a.offer.stats?.joins || 0)).slice(0, 8);
  const nearby = deals.filter((d) => d.offer.city === city).slice(0, 4);
  const bestSaving = deals.reduce((m, d) => Math.max(m, discountPct(d.offer.mrp, sortTiers(d.offer.tiers).at(-1)?.price)), 0);

  return (
    <div>
      <Hero deals={deals} groups={groups} />
      <CategoryStrip />

      <section className="container-page mt-16">
        <SectionHeading
          eyebrow={<><Flame className="mr-1 inline h-3.5 w-3.5" />Trending</>}
          title="Trending group deals"
          subtitle={bestSaving ? `Save up to ${bestSaving}% when your group fills up.` : undefined}
          action={<Button variant="secondary" to="/deals" icon={ArrowRight}>View all deals</Button>}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[360px]" />)
            : trending.map(({ offer, group }) => <DealCard key={offer.id} offer={offer} group={group} />)}
        </div>
      </section>

      <ClosingSoon deals={deals} />
      <HowItWorksStrip />

      <section className="container-page mt-20">
        <SectionHeading
          eyebrow={<><MapPin className="mr-1 inline h-3.5 w-3.5" />Nearby</>}
          title={`Popular in ${city}`}
          action={
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {PILOT_CITIES.map((c) => (
                <button key={c} onClick={() => setCity(c)} className={cx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition', c === city ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300')}>
                  {c}
                </button>
              ))}
            </div>
          }
        />
        {nearby.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {nearby.map(({ offer, group }) => (
              <DealCard key={offer.id} offer={offer} group={group} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-ink-100">
            <p className="font-display text-lg font-bold">We're launching in {city} soon 🚀</p>
            <p className="mt-1 text-sm text-ink-500">Meanwhile, online cohorts and national product deals are available everywhere in India.</p>
            <Button to="/deals?city=Online (All India)" className="mt-5" variant="secondary">See online deals</Button>
          </div>
        )}
      </section>

      <PilotVerticals />
      <Trust />
      <MerchantCta />
    </div>
  );
}
