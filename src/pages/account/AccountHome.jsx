import { AlertCircle, ArrowRight, Copy, Hourglass, PackageCheck, PiggyBank, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { SimpleSteps } from '@/components/explain.jsx';
import { Button, Card, StatCard } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatINR } from '@/lib/format.js';
import OrderRow from './OrderRow.jsx';

function nextStep(o) {
  if (o.extensionConsent === 'PENDING') return { tone: 'amber', text: 'Your group needs more time — choose to stay or get a refund' };
  if (o.status === 'AWAITING_GROUP') return { tone: 'brand', text: 'Waiting for more people — share the link to unlock faster' };
  return null;
}

export default function AccountHome() {
  const { user, profile } = useAuth();
  const { data: orders } = useQuery('orders', [['uid', '==', user.uid]], { sort: ['createdAt', 'desc'] });
  const live = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status));
  const waiting = live.filter((o) => o.status === 'AWAITING_GROUP');
  const ready = live.filter((o) => o.status !== 'AWAITING_GROUP');
  const saved = live.reduce((s, o) => s + (o.breakdown?.savings || 0) + (o.priceDropRefund || 0), 0);
  const attention = orders.filter((o) => nextStep(o));
  const name = (profile?.displayName || '').split(' ')[0] || 'there';

  if (!orders.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Hi {name} 👋</h1>
          <p className="mt-1 text-ink-500">You haven't joined any deals yet. Here's how it works:</p>
        </div>
        <SimpleSteps />
        <Button size="lg" icon={Search} to="/deals">Find your first deal</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Hi {name} 👋</h1>
        <p className="mt-1 text-ink-500">
          You've saved <b className="text-emerald-600">{formatINR(saved)}</b> by buying together.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={PackageCheck} tone="emerald" label="Confirmed" value={ready.length} hint="Orders & bookings ready" />
        <StatCard icon={Hourglass} label="Waiting for group" value={waiting.length} hint="Need more people to join" />
        <StatCard icon={PiggyBank} tone="sky" label="Total saved" value={formatINR(saved)} />
      </div>

      {attention.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-display font-bold"><AlertCircle className="h-5 w-5 text-brand-500" /> Next steps</p>
          <div className="space-y-2">
            {attention.map((o) => {
              const s = nextStep(o);
              return (
                <Link key={o.id} to={`/account/orders/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 p-3 hover:bg-ink-100">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{o.offerTitle}</span>
                    <span className={s.tone === 'amber' ? 'text-xs font-semibold text-amber-700' : 'text-xs text-brand-700'}>{s.text}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Your deals</h2>
          <Button variant="ghost" size="sm" to="/account/orders">See all <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-3">
          {orders.slice(0, 5).map((o) => <OrderRow key={o.id} order={o} />)}
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Invite friends with your code</p>
          <p className="text-sm text-ink-500">It's added automatically to group links you share.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-ink-50 px-4 py-2.5 font-display font-bold tracking-widest hover:bg-ink-100" onClick={() => navigator.clipboard?.writeText(profile?.referralCode || '').then(() => toast.success('Copied!'))}>
          {profile?.referralCode} <Copy className="h-4 w-4" />
        </button>
      </Card>
    </div>
  );
}
