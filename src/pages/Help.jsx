import { ChevronDown, LifeBuoy, Mail, MessageCircle, Phone, Scale } from 'lucide-react';
import { useState } from 'react';
import { SUPPORT } from '@shared/constants.js';
import { Button, Card } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { cx } from '@/lib/format.js';

const FAQ = [
  ['What happens if my group does not reach the target?', 'The disclosed failure outcome applies automatically. For most deals that is a full refund to your original payment method. If an offer allows an extension, we ask for your consent — if you decline or do not respond within 24 hours, you are refunded.'],
  ['Who can see my details?', 'Other members only see the group count and anonymous initials. Your phone, address and booking details are shared only with the provider fulfilling your order.'],
  ['Will my price change after I pay?', 'Never upwards. Under the "Best tier for everyone" rule, if the group unlocks a lower tier before closing, we refund you the difference automatically.'],
  ['How do gym memberships activate?', 'Each gym deal shows its activation rule before payment — on purchase, on group confirmation, or on your first visit. You receive a unique QR/code to show at the branch.'],
  ['How do online cohorts work?', 'Seats are reserved for 15 minutes while you pay. Once the group confirms you receive access instructions and the calendar for your cohort.'],
  ['How are interior projects priced?', 'Group deals cover a defined consultation or fixed-scope package. Custom work is quoted separately with an itemised quotation that you can accept or decline.'],
  ['How do I cancel or return?', 'Go to My account → Orders, open the order and choose Cancel or Return. Before group confirmation cancellations are refunded instantly; after that the offer\'s cancellation terms apply.'],
  ['How long do refunds take?', 'Refunds are initiated immediately and tracked in My account → Refunds until completed, usually 5–7 working days depending on your bank.'],
];

export default function Help() {
  const [open, setOpen] = useState(0);
  const { user } = useAuth();
  return (
    <div className="container-page max-w-5xl py-10">
      <div className="text-center">
        <LifeBuoy className="mx-auto h-12 w-12 text-brand-500" />
        <h1 className="mt-3 font-display text-4xl font-extrabold">How can we help?</h1>
        <p className="mt-2 text-ink-500">Answers to common questions, or reach our support team.</p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-brand-600" />
          <p className="mt-2 font-bold">Raise a ticket</p>
          <p className="text-sm text-ink-500">Linked to your order for faster help</p>
          <Button size="sm" className="mt-3" to={user ? '/account/support' : '/login?next=/account/support'}>Open support</Button>
        </Card>
        <Card className="p-5 text-center">
          <Phone className="mx-auto h-7 w-7 text-brand-600" />
          <p className="mt-2 font-bold">Call us</p>
          <p className="text-sm text-ink-500">{SUPPORT.phone}</p>
          <p className="text-xs text-ink-400">{SUPPORT.hours}</p>
        </Card>
        <Card className="p-5 text-center">
          <Mail className="mx-auto h-7 w-7 text-brand-600" />
          <p className="mt-2 font-bold">Email</p>
          <p className="text-sm text-ink-500">{SUPPORT.email}</p>
        </Card>
      </div>
      <h2 className="mb-4 mt-12 font-display text-2xl font-bold">Frequently asked questions</h2>
      <div className="space-y-3">
        {FAQ.map(([q, a], i) => (
          <Card key={q} className="overflow-hidden">
            <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold" aria-expanded={open === i}>
              {q}
              <ChevronDown className={cx('h-5 w-5 shrink-0 text-ink-400 transition', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-ink-600">{a}</p>}
          </Card>
        ))}
      </div>
      <Card className="mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <Scale className="h-10 w-10 shrink-0 text-ink-400" />
        <div>
          <p className="font-bold">Grievance redressal</p>
          <p className="text-sm text-ink-600">
            Not satisfied with a resolution? Write to our {SUPPORT.grievanceOfficer} at <a className="font-semibold text-brand-600" href={`mailto:${SUPPORT.grievanceEmail}`}>{SUPPORT.grievanceEmail}</a>. We acknowledge complaints within 48 hours and resolve them within the timelines required under applicable consumer protection rules.
          </p>
        </div>
      </Card>
    </div>
  );
}
