import { Compass, Filter, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, categoryById } from '@shared/categories.js';
import { DEAL_FORMATS, FULFILMENT_META, PILOT_CITIES } from '@shared/constants.js';
import { discountPct, sortTiers } from '@shared/pricing.js';
import { DealCard } from '@/components/deal.jsx';
import Icon from '@/components/Icon.jsx';
import { Button, EmptyState, Input, Select, Skeleton } from '@/components/ui.jsx';
import { useLiveDeals } from '@/hooks/useDeals.js';
import { cx } from '@/lib/format.js';

const SORTS = {
  trending: 'Trending',
  ending: 'Ending soon',
  discount: 'Biggest discount',
  priceLow: 'Price: low to high',
  priceHigh: 'Price: high to low',
  newest: 'Newest',
  progress: 'Closest to unlock',
};

export default function Deals() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const { deals, loading } = useLiveDeals();
  const f = Object.fromEntries(params.entries());
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === '' || v === undefined || v === null) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const providers = useMemo(() => [...new Map(deals.map((d) => [d.offer.merchantId, d.offer.merchantName])).entries()], [deals]);

  const results = useMemo(() => {
    const q = (f.q || '').toLowerCase().trim();
    let list = deals.filter(({ offer }) => {
      if (q && !`${offer.title} ${offer.summary} ${offer.merchantName} ${categoryById(offer.categoryId)?.name} ${offer.city}`.toLowerCase().includes(q)) return false;
      if (f.category && offer.categoryId !== f.category) return false;
      if (f.city && offer.city !== f.city && !(offer.fulfilment === 'PRODUCT' || offer.city === 'Online (All India)')) return false;
      if (f.pin) {
        const pin = f.pin.trim();
        const areas = [...(offer.serviceAreas || []), ...(offer.pincodes || [])];
        const national = offer.fulfilment === 'PRODUCT' || offer.fulfilment === 'COURSE';
        if (!national && areas.length && !areas.some((a) => pin.startsWith(a) || a.startsWith(pin))) return false;
      }
      if (f.provider && offer.merchantId !== f.provider) return false;
      if (f.type && offer.fulfilment !== f.type) return false;
      if (f.format && offer.format !== f.format) return false;
      const best = sortTiers(offer.tiers).at(-1)?.price || offer.mrp;
      if (f.min && best < Number(f.min)) return false;
      if (f.max && best > Number(f.max)) return false;
      return true;
    });
    const best = (o) => sortTiers(o.tiers).at(-1)?.price || o.mrp;
    const sorters = {
      trending: (a, b) => (b.offer.stats?.joins || 0) - (a.offer.stats?.joins || 0),
      ending: (a, b) => new Date(a.group?.deadline || 8e15) - new Date(b.group?.deadline || 8e15),
      discount: (a, b) => discountPct(b.offer.mrp, best(b.offer)) - discountPct(a.offer.mrp, best(a.offer)),
      priceLow: (a, b) => best(a.offer) - best(b.offer),
      priceHigh: (a, b) => best(b.offer) - best(a.offer),
      newest: (a, b) => new Date(b.offer.approvedAt || 0) - new Date(a.offer.approvedAt || 0),
      progress: (a, b) => (b.group ? b.group.paidCount / b.group.minGroupSize : 0) - (a.group ? a.group.paidCount / a.group.minGroupSize : 0),
    };
    list = [...list].sort(sorters[f.sort] || sorters.trending);
    return list;
  }, [deals, f.q, f.category, f.city, f.pin, f.provider, f.type, f.format, f.min, f.max, f.sort]);

  const activeCat = categoryById(f.category);
  const activeFilters = ['q', 'category', 'city', 'pin', 'provider', 'type', 'format', 'min', 'max'].filter((k) => f[k]);

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Keyword</p>
        <Input icon={Search} value={f.q || ''} onChange={(e) => set('q', e.target.value)} placeholder="Search deals" />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">City</p>
        <Select value={f.city || ''} onChange={(e) => set('city', e.target.value)}>
          <option value="">All cities</option>
          {PILOT_CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">PIN code</p>
        <Input icon={MapPin} inputMode="numeric" maxLength={6} value={f.pin || ''} onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 411045" />
        <p className="mt-1 text-xs text-ink-400">Shows local services that cover your area.</p>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Deal type</p>
        <Select value={f.type || ''} onChange={(e) => set('type', e.target.value)}>
          <option value="">Any type</option>
          {Object.entries(FULFILMENT_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Deal format</p>
        <Select value={f.format || ''} onChange={(e) => set('format', e.target.value)}>
          <option value="">Any format</option>
          {Object.entries(DEAL_FORMATS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Provider</p>
        <Select value={f.provider || ''} onChange={(e) => set('provider', e.target.value)}>
          <option value="">All providers</option>
          {providers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </Select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Best group price (₹)</p>
        <div className="flex items-center gap-2">
          <Input inputMode="numeric" placeholder="Min" value={f.min || ''} onChange={(e) => set('min', e.target.value.replace(/\D/g, ''))} />
          <span className="text-ink-300">–</span>
          <Input inputMode="numeric" placeholder="Max" value={f.max || ''} onChange={(e) => set('max', e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      {activeFilters.length > 0 && (
        <Button variant="ghost" className="w-full" icon={X} onClick={() => setParams({}, { replace: true })}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-page py-8">
      <div className="mb-6 overflow-hidden rounded-3xl bg-ink-gradient px-6 py-8 text-white sm:px-10">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-300">
          <Compass className="h-4 w-4" /> Explore
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">{activeCat ? activeCat.name : 'All group deals'}</h1>
        <p className="mt-1 max-w-2xl text-ink-200">{activeCat ? `${activeCat.examples}. ${activeCat.fulfilmentModel}.` : 'Join a group to unlock merchant-approved prices. Every member gets their own order or booking.'}</p>
      </div>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <button onClick={() => set('category', '')} className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition', !f.category ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-600 ring-ink-200')}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => set('category', c.id)} className={cx('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition', f.category === c.id ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300')}>
            <Icon name={c.icon} className="h-4 w-4" /> {c.name}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-100">
            <p className="mb-4 flex items-center gap-2 font-display font-bold">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </p>
            {filterPanel}
          </div>
        </aside>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              <b className="text-ink-900">{results.length}</b> deals{f.city ? ` in ${f.city}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={Filter} className="lg:hidden" onClick={() => setShowFilters(true)}>
                Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
              </Button>
              <Select value={f.sort || 'trending'} onChange={(e) => set('sort', e.target.value)} className="!w-auto !py-2" aria-label="Sort by">
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          </div>
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[360px]" />
              ))}
            </div>
          ) : results.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map(({ offer, group }) => (
                <DealCard key={offer.id} offer={offer} group={group} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Search} title="No deals match your filters" description="Try a different city, category or price range — or clear filters to see everything." action={<Button onClick={() => setParams({})}>Clear filters</Button>} />
          )}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setShowFilters(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 animate-fade-up">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold">Filters</p>
              <button onClick={() => setShowFilters(false)} aria-label="Close" className="rounded-lg p-1.5 hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {filterPanel}
            <Button className="mt-5 w-full" onClick={() => setShowFilters(false)}>
              Show {results.length} deals
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
