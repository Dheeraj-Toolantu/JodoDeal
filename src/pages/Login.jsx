import { ArrowRight, KeyRound, Mail, Phone, ShieldCheck, Sparkles, Store, User, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Layout.jsx';
import { Button, Field, Input, Tabs } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { isDemoMode } from '@/lib/firebase.js';
import { auth, errorMessage } from '@/services/api.js';
import { DEMO_OTP } from '@/services/demoBackend.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@shared/seedData.js';

const DEMO_ICONS = { customer: User, merchant: Store, admin: UserCog, support: ShieldCheck };

export default function Login({ mode: initialMode = 'login' }) {
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [method, setMethod] = useState('email');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', otp: '' });
  const [confirmer, setConfirmer] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'signup') {
        if (!form.name.trim()) throw new Error('Please enter your name.');
        await auth.signUp(form.email.trim(), form.password, form.name.trim());
        toast.success('Welcome to JodoDeal! 🎉');
      } else {
        await auth.signIn(form.email.trim(), form.password);
      }
    });
  };

  const sendOtp = (e) => {
    e.preventDefault();
    run(async () => {
      const digits = form.phone.replace(/\D/g, '').slice(-10);
      const c = await auth.sendOtp(`+91${digits}`);
      setConfirmer(c);
      toast.success(isDemoMode ? `OTP sent (demo OTP: ${DEMO_OTP})` : 'OTP sent via SMS');
    });
  };

  const verifyOtp = (e) => {
    e.preventDefault();
    run(() => confirmer.confirm(form.otp.trim()));
  };

  const demoLogin = (acc) => run(() => auth.signIn(acc.email, DEMO_PASSWORD));

  const forgot = () =>
    run(async () => {
      if (!form.email) throw new Error('Enter your email first.');
      await auth.resetPassword(form.email.trim());
      toast.success('Password reset link sent if the account exists.');
    });

  return (
    <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-2">
      <div className="hero-mesh relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo light />
        <div>
          <Sparkles className="h-10 w-10 text-amber-300" />
          <h2 className="mt-6 font-display text-4xl font-extrabold leading-tight">
            Saath Kharido,
            <br /> Sabse Sasta Paao!
          </h2>
          <p className="mt-4 max-w-md text-lg text-ink-200">Join groups, invite friends on WhatsApp and unlock better prices on the things you love.</p>
          <ul className="mt-8 space-y-3 text-ink-100">
            {['Verified providers and transparent terms', 'Full refund if a group misses its target', 'Your details stay private from other members'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-ink-300">Trusted by communities across India.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-extrabold">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1 text-ink-500">{mode === 'signup' ? 'Join groups and unlock better prices.' : 'Sign in to join groups and manage your bookings.'}</p>

          <Tabs
            className="mt-6"
            value={method}
            onChange={(v) => {
              setMethod(v);
              setConfirmer(null);
            }}
            tabs={[
              { value: 'email', label: 'Email', icon: Mail },
              { value: 'phone', label: 'Mobile OTP', icon: Phone },
            ]}
          />

          {method === 'email' ? (
            <form onSubmit={submitEmail} className="mt-5 space-y-4">
              {mode === 'signup' && (
                <Field label="Full name" required>
                  <Input icon={User} value={form.name} onChange={set('name')} autoComplete="name" />
                </Field>
              )}
              <Field label="Email" required>
                <Input icon={Mail} type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
              </Field>
              <Field label="Password" required hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
                <Input icon={KeyRound} type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
              </Field>
              {mode === 'login' && (
                <button type="button" onClick={forgot} className="text-sm font-semibold text-brand-600 hover:underline">
                  Forgot password?
                </button>
              )}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                {mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={confirmer ? verifyOtp : sendOtp} className="mt-5 space-y-4">
              <Field label="Mobile number" required>
                <div className="flex gap-2">
                  <span className="flex items-center rounded-xl bg-ink-100 px-3 text-sm font-semibold">+91</span>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" disabled={!!confirmer} />
                </div>
              </Field>
              {confirmer && (
                <Field label="Enter OTP" required hint={isDemoMode ? `Demo OTP: ${DEMO_OTP}` : 'Sent via SMS'}>
                  <Input value={form.otp} onChange={set('otp')} inputMode="numeric" maxLength={6} autoComplete="one-time-code" className="text-center text-lg tracking-[0.5em]" autoFocus />
                </Field>
              )}
              <div id="recaptcha-container" />
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={form.phone.length !== 10}>
                {confirmer ? 'Verify & continue' : 'Send OTP'}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-500">
            {mode === 'signup' ? (
              <>Already have an account? <button className="font-semibold text-brand-600 hover:underline" onClick={() => setMode('login')}>Sign in</button></>
            ) : (
              <>New to JodoDeal? <button className="font-semibold text-brand-600 hover:underline" onClick={() => setMode('signup')}>Create an account</button></>
            )}
          </p>

          {isDemoMode && (
            <div className="mt-8 rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-100">
              <p className="text-sm font-bold">One-click demo accounts</p>
              <p className="mb-3 text-xs text-ink-500">Password for all: <code className="rounded bg-white px-1">{DEMO_PASSWORD}</code></p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => {
                  const I = DEMO_ICONS[a.role] || User;
                  return (
                    <button key={a.uid} onClick={() => demoLogin(a)} disabled={busy} className="flex items-center gap-2 rounded-xl bg-white p-2.5 text-left ring-1 ring-ink-100 transition hover:ring-brand-300">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><I className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{a.displayName}</span>
                        <span className="block text-[11px] capitalize text-ink-400">{a.role}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p className="mt-6 text-center text-xs text-ink-400">
            By continuing you agree to our <Link to="/policies/terms" className="underline">Terms</Link> and <Link to="/policies/privacy" className="underline">Privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
