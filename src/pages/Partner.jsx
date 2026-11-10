import { BarChart3, BadgeCheck, CalendarCheck, QrCode, Rocket, Settings2, Store, Users, Wallet } from 'lucide-react';
import { CATEGORIES } from '@shared/categories.js';
import Icon from '@/components/Icon.jsx';
import { Button, Card, SectionHeading } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export default function Partner() {
  const { isMerchant, user } = useAuth();
  const benefits = [
    { icon: Users, title: 'Many customers, one campaign', text: 'Customers recruit their own friends. You only fulfil confirmed demand.' },
    { icon: Settings2, title: 'You control the rules', text: 'Set tiers, minimum size, capacity, dates, service areas and cancellation terms.' },
    { icon: CalendarCheck, title: 'Built for services', text: 'Branches, cohorts, appointment slots, site visits, quotations and milestones.' },
    { icon: QrCode, title: 'QR redemption', text: 'Scan or enter membership & voucher codes. Duplicate use is blocked automatically.' },
    { icon: BarChart3, title: 'Real analytics', text: 'Views, shares, conversion, group completion, cancellations and repeat customers.' },
    { icon: Wallet, title: 'Transparent settlement', text: 'Category-specific commission on completed orders only. Settlement reports included.' },
  ];
  return (
    <div>
      <section className="hero-mesh py-16 text-white sm:py-24">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20">
              <Store className="h-3.5 w-3.5" /> JodoDeal for Business
            </p>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight sm:text-5xl">Fill your batches, memberships and project calendar — together.</h1>
            <p className="mt-4 max-w-xl text-lg text-ink-200">Gyms, studios, educators, interior designers and brands use JodoDeal to acquire groups of customers with lower acquisition effort.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isMerchant ? (
                <Button to="/merchant" size="lg" icon={Rocket}>Open merchant portal</Button>
              ) : (
                <Button to={user ? '/merchant/register' : '/login?next=/merchant/register'} size="lg" icon={Rocket}>
                  Register your business
                </Button>
              )}
              <Button to="/how-it-works" size="lg" variant="secondary">How it works</Button>
            </div>
          </div>
          <Card className="p-6 text-ink-900">
            <p className="font-display text-lg font-bold">Onboarding in 3 steps</p>
            <ol className="mt-4 space-y-4">
              {[
                ['Register & verify', 'Business details, GST/PAN, bank details and licences.'],
                ['Create your offer', 'Price tiers, capacity, schedule, inclusions & terms.'],
                ['Get approved & go live', 'Our team reviews every offer for clarity and fairness.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-ink-500">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <BadgeCheck className="h-5 w-5" /> Verified badge shown on all your deals
            </p>
          </Card>
        </div>
      </section>
      <section className="container-page mt-16">
        <SectionHeading eyebrow="Why JodoDeal" title="Everything you need to run group campaigns" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <Card key={b.title} className="p-6">
              <b.icon className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 font-display text-lg font-bold">{b.title}</h3>
              <p className="mt-1 text-sm text-ink-600">{b.text}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="container-page mt-16">
        <SectionHeading eyebrow="Categories" title="Commission tested per category" subtitle="Different verticals have different margins and fulfilment costs — so we don't apply one flat rate." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.gradient} text-white`}>
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{c.name}</p>
                <p className="text-xs text-ink-500">{c.commissionPct}% on completed orders</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
