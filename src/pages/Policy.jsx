import { FileText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { SUPPORT, TERMS_VERSION } from '@shared/constants.js';
import { Card, EmptyState } from '@/components/ui.jsx';

const POLICIES = {
  terms: {
    title: 'Terms of use',
    sections: [
      ['Who we are', 'JodoDeal Technologies Pvt. Ltd. operates JodoDeal as a marketplace / technology intermediary. Merchants and service providers sell and deliver the products and services listed and are responsible for fulfilment, subject to our verification and service standards.'],
      ['Group deals', 'Each offer discloses the minimum group size, price tiers, pricing rule, deadline, capacity, inclusions, exclusions and cancellation terms before payment. Only valid, paid and confirmed transactions count toward group progress.'],
      ['Price', 'The price, taxes and fees shown at checkout are final. Your accepted checkout price is preserved; it will never be increased after payment.'],
      ['Accepted terms', `We record the exact terms and policy version you accepted at purchase (current version ${TERMS_VERSION}).`],
      ['Prohibited use', 'Fake accounts, self-referrals, abusive sharing and fraudulent transactions are not allowed and may lead to suspension.'],
    ],
  },
  refunds: {
    title: 'Refunds, returns & cancellations',
    sections: [
      ['Group failure', 'If a group fails to reach its minimum target by the deadline, the offer\'s disclosed outcome applies: a full refund, or an extension only with your explicit consent.'],
      ['Before confirmation', 'You may cancel any time before your group is confirmed for a full refund.'],
      ['Services', 'Service cancellation and rescheduling terms are shown before payment and distinguish customer cancellation, provider cancellation, no-show and force majeure. Gym, class and interior offers explain activation, attendance, commencement of work and consumed sessions in plain language.'],
      ['Products', 'Returns are handled per item and per the category policy. For defective, damaged, wrong or materially not-as-described goods we provide the legally appropriate remedy.'],
      ['Refund method', 'Refunds go to the original payment method where required — we do not force wallet credit in place of a monetary refund.'],
      ['Independence', 'One customer\'s return or cancellation never changes another customer\'s confirmed price, order or booking.'],
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: [
      ['Data minimisation', 'We collect only the personal data needed to provide the service — e.g. contact details, delivery or service address, and booking preferences.'],
      ['Who sees your data', 'Other group members never see your phone, address or booking details. Providers see only what they need to fulfil your order.'],
      ['Communications', 'We send transactional updates over in-site notifications and email. WhatsApp and SMS messages are sent only with your consent, which you can change any time in your notification preferences.'],
      ['Your rights', 'You can access and correct your profile, and request deletion subject to legal retention requirements, in line with the Digital Personal Data Protection framework in force.'],
      ['Security', 'Data is encrypted in transit, access is role-based and least-privilege, and critical actions are audit-logged.'],
    ],
  },
  grievance: {
    title: 'Grievance redressal',
    sections: [
      ['Grievance Officer', `${SUPPORT.grievanceOfficer} — ${SUPPORT.grievanceEmail}`],
      ['Timelines', 'Complaints are acknowledged within 48 hours and resolved within the period required under the Consumer Protection (E-Commerce) Rules.'],
      ['Escalation', 'Raise a support ticket first from My account → Support. If unresolved, write to the Grievance Officer with your ticket reference.'],
    ],
  },
  sellers: {
    title: 'Seller information',
    sections: [
      ['Seller details', 'Every offer page lists the actual provider, their location or online delivery method, and support contact.'],
      ['Verification', 'Providers complete business verification (GST/PAN, bank details, licences and other documents as applicable) before publishing deals.'],
      ['Sponsored placement', 'Merchant-funded promotions are clearly labelled as sponsored.'],
    ],
  },
};

export default function Policy() {
  const { slug } = useParams();
  const p = POLICIES[slug];
  if (!p) return <div className="container-page py-16"><EmptyState icon={FileText} title="Policy not found" /></div>;
  return (
    <div className="container-page max-w-3xl py-12">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-600">Policies</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">{p.title}</h1>
      <p className="mt-2 text-sm text-ink-400">Version {TERMS_VERSION}. This page summarises our policies and is reviewed with legal counsel before launch.</p>
      <Card className="mt-8 divide-y divide-ink-100">
        {p.sections.map(([h, t]) => (
          <div key={h} className="p-6">
            <h2 className="font-display text-lg font-bold">{h}</h2>
            <p className="mt-1.5 leading-relaxed text-ink-600">{t}</p>
          </div>
        ))}
      </Card>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        {Object.entries(POLICIES).map(([k, v]) => (
          <Link key={k} to={`/policies/${k}`} className="font-semibold text-brand-600 hover:underline">{v.title}</Link>
        ))}
      </div>
    </div>
  );
}
