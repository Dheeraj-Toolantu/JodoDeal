import { BadgeIndianRupee, CircleCheckBig, Clock, Package, RefreshCcw, Search, Share2, ShieldCheck, Users, XCircle } from 'lucide-react';
import { FAILURE_POLICIES, GROUP_STATE_META, PRICING_RULES } from '@shared/constants.js';
import { Button, Card, SectionHeading } from '@/components/ui.jsx';

export default function HowItWorks() {
  const steps = [
    { icon: Search, title: 'Pick a verified deal', text: 'Every offer shows the provider, price tiers, minimum group size, deadline, inclusions, exclusions and cancellation terms — before you pay.' },
    { icon: Users, title: 'Join or start a group', text: 'Join an open group or create your own. You pay (or pay the disclosed deposit) to secure your spot. Only paid, confirmed members count.' },
    { icon: Share2, title: 'Share with your people', text: 'Send your group link on WhatsApp to friends, family, your apartment society or office. As members join, better tiers unlock.' },
    { icon: CircleCheckBig, title: 'Group confirmed', text: 'When the minimum is reached before the deadline, the group is confirmed and fulfilment begins.' },
    { icon: Package, title: 'Your own order or booking', text: 'You get your own parcel, membership QR, class seat, appointment or project record — independent of other members.' },
    { icon: RefreshCcw, title: 'Not enough members?', text: 'If the target is missed, the disclosed outcome applies automatically — usually a full refund to your original payment method.' },
  ];
  return (
    <div>
      <section className="hero-mesh py-16 text-white">
        <div className="container-page max-w-4xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-300">How JodoDeal works</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold sm:text-5xl">Team up. Unlock. Save.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-200">Merchants set group prices that unlock as more people join. You bring the people — everyone gets the better deal, and their own separate order or booking.</p>
        </div>
      </section>

      <section className="container-page -mt-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-extrabold text-ink-100">{i + 1}</span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-page mt-16 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <BadgeIndianRupee className="h-6 w-6 text-brand-600" /> Pricing rules
          </h2>
          <p className="mt-1 text-sm text-ink-500">Each campaign uses one clearly stated rule, shown before payment. We never silently change your price after checkout.</p>
          <div className="mt-4 space-y-3">
            {Object.entries(PRICING_RULES).map(([k, r]) => (
              <div key={k} className="rounded-2xl bg-ink-50 p-4">
                <p className="font-bold">{r.label}</p>
                <p className="text-sm text-ink-600">{r.description}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <XCircle className="h-6 w-6 text-rose-500" /> If a group fails
          </h2>
          <p className="mt-1 text-sm text-ink-500">We never assume you accepted an extension.</p>
          <div className="mt-4 space-y-3">
            {Object.entries(FAILURE_POLICIES).map(([k, r]) => (
              <div key={k} className="rounded-2xl bg-ink-50 p-4">
                <p className="font-bold">{r.label}</p>
                <p className="text-sm text-ink-600">{r.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="container-page mt-16">
        <SectionHeading eyebrow="Transparency" title="Group status, explained" subtitle="Every group page shows its current state and a full timeline." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(GROUP_STATE_META)
            .filter(([k]) => !['DRAFT', 'PENDING_APPROVAL'].includes(k))
            .map(([k, m]) => (
              <div key={k} className="flex gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <div>
                  <p className="font-bold">{m.label}</p>
                  <p className="text-sm text-ink-500">{m.meaning}</p>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="container-page mt-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 font-display text-2xl font-bold">Ready to save together?</h2>
        <Button to="/deals" size="lg" className="mt-5">
          Explore live deals
        </Button>
      </section>
    </div>
  );
}
