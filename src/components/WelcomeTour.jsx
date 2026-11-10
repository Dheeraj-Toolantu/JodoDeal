import { ArrowLeft, ArrowRight, Check, PartyPopper, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@shared/categories.js';
import { PILOT_CITIES } from '@shared/constants.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { cx } from '@/lib/format.js';
import { call } from '@/services/api.js';
import { PriceDropVisual } from './explain.jsx';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';

const POPULAR = ['gym-fitness', 'yoga-wellness', 'online-classes', 'interior-home', 'electronics', 'home-kitchen', 'beauty', 'travel'];

/** Shown once on a customer's first sign-in so the purpose of the app is clear. */
export default function WelcomeTour() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState(profile?.city || 'Pune');
  const [interests, setInterests] = useState([]);
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (closed || !profile || profile.role !== 'customer' || profile.onboardedAt) return null;
  const name = (profile.displayName || '').split(' ')[0];

  const finish = async (go = true) => {
    setSaving(true);
    try {
      await call('updateProfile', { onboarded: true, city, interests });
    } catch {
      /* non-blocking */
    }
    setSaving(false);
    setClosed(true);
    if (go) {
      const cat = interests.length === 1 ? `&category=${interests[0]}` : '';
      navigate(`/deals?city=${encodeURIComponent(city)}${cat}`);
    }
  };

  const slides = [
    {
      title: `Welcome${name ? `, ${name}` : ''}! 👋`,
      body: (
        <>
          <p className="text-ink-600">
            <b className="text-ink-900">JodoDeal helps you pay less by buying together.</b> When more people join the same deal, everyone gets a lower price.
          </p>
          <div className="mt-6 rounded-2xl bg-ink-50 p-5">
            <PriceDropVisual />
            <p className="mt-4 text-center text-sm text-ink-500">Example: a ₹1,000 gym pass gets cheaper as more people join.</p>
          </div>
        </>
      ),
    },
    {
      title: 'How it works',
      body: (
        <ol className="space-y-3">
          {[
            [Users, 'Join a group for a deal you like', 'Pay to hold your spot. You can see how many people have joined.'],
            [ArrowRight, 'Share the link with friends', 'Every new member brings the price down for everyone in the group.'],
            [PartyPopper, 'Enough people joined? Deal unlocked!', 'You get your own order, membership or booking.'],
          ].map(([I, t, d], i) => (
            <li key={t} className="flex gap-4 rounded-2xl bg-ink-50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-bold text-white">{i + 1}</span>
              <div>
                <p className="flex items-center gap-2 font-bold"><I className="h-4 w-4 text-brand-500" /> {t}</p>
                <p className="text-sm text-ink-500">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      ),
    },
    {
      title: 'Your money is safe',
      body: (
        <div className="space-y-3">
          {[
            [RefreshCcw, 'Full refund if the group doesn\'t fill', 'Not enough people by the deadline? Your money goes back automatically.'],
            [ShieldCheck, 'Your price never goes up', 'What you see at checkout is the most you pay. It can only go down.'],
            [Check, 'Verified sellers & private details', 'Every seller is checked. Other members never see your phone or address.'],
          ].map(([I, t, d]) => (
            <div key={t} className="flex gap-4 rounded-2xl bg-emerald-50 p-4">
              <I className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold text-emerald-900">{t}</p>
                <p className="text-sm text-emerald-800/80">{d}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'What are you looking for?',
      body: (
        <>
          <p className="mb-2 text-sm font-semibold text-ink-700">Your city</p>
          <div className="mb-5 flex flex-wrap gap-2">
            {PILOT_CITIES.map((c) => (
              <button key={c} type="button" onClick={() => setCity(c)} className={cx('rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition', city === c ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-600 ring-ink-200')}>
                {c}
              </button>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold text-ink-700">Interests <span className="font-normal text-ink-400">(optional)</span></p>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR.map((id) => {
              const c = CATEGORIES.find((x) => x.id === id);
              const on = interests.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInterests((l) => (on ? l.filter((x) => x !== id) : [...l, id]))}
                  className={cx('flex items-center gap-2 rounded-xl p-2.5 text-left text-sm font-semibold ring-2 transition', on ? 'bg-brand-50 ring-brand-500' : 'ring-ink-100 hover:ring-ink-200')}
                >
                  <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white', c.gradient)}>
                    <Icon name={c.icon} className="h-4 w-4" />
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </>
      ),
    },
  ];
  const last = step === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Welcome to JodoDeal">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
      <div className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift animate-pop sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${slides.length}`}>
            {slides.map((_, i) => (
              <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-8 bg-brand-500' : i < step ? 'w-4 bg-brand-200' : 'w-4 bg-ink-100')} />
            ))}
          </div>
          <button onClick={() => finish(false)} className="text-sm font-semibold text-ink-400 hover:text-ink-700">Skip</button>
        </div>
        <div className="overflow-y-auto px-6 pb-4 pt-5">
          <h2 className="mb-4 font-display text-2xl font-extrabold">{slides[step].title}</h2>
          <div key={step} className="animate-fade-up">{slides[step].body}</div>
        </div>
        <div className="flex gap-2 border-t border-ink-100 px-6 py-4">
          {step > 0 && <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} aria-label="Back" />}
          <Button className="flex-1" size="lg" loading={saving} onClick={() => (last ? finish(true) : setStep((s) => s + 1))}>
            {last ? 'Show me deals' : step === 0 ? 'How does it work?' : 'Next'} {!last && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
