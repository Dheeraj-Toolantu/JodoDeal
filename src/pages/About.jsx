import { Handshake, Heart, MapPin, Target } from 'lucide-react';
import { TAGLINE } from '@shared/constants.js';
import { Button, Card } from '@/components/ui.jsx';

export default function About() {
  return (
    <div className="container-page max-w-4xl py-12">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-600">About us</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">{TAGLINE}</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-600">
        JodoDeal makes group purchasing a simple, trusted and shareable way for Indian consumers to access better prices on everyday products and useful services. We are a marketplace and technology intermediary — we don't hold inventory. Verified merchants and service providers deliver every product and service, backed by our standards and support.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          [Target, 'Our mission', 'Better prices through community, without compromising on trust or transparency.'],
          [Handshake, 'For merchants', 'Many customers in one campaign, with lower acquisition effort and confirmed demand.'],
          [MapPin, 'Starting local', 'Piloting in Pune for gyms, yoga and home services — with online courses available across India.'],
        ].map(([I, t, d]) => (
          <Card key={t} className="p-6">
            <I className="h-8 w-8 text-brand-600" />
            <p className="mt-3 font-display font-bold">{t}</p>
            <p className="mt-1 text-sm text-ink-600">{d}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-10 flex flex-col items-center gap-4 p-8 text-center">
        <Heart className="h-10 w-10 text-rose-500" />
        <p className="max-w-xl text-ink-600">One common group-pricing engine with separate, reliable fulfilment for every customer — that's what makes JodoDeal different.</p>
        <Button to="/deals">Explore deals</Button>
      </Card>
    </div>
  );
}
