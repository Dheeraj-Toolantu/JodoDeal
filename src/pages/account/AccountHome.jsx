import { ArrowRight, Copy, Gift, LifeBuoy, Package, PiggyBank, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, EmptyState, StatCard } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatINR } from '@/lib/format.js';
import OrderRow from './OrderRow.jsx';

export default function AccountHome() {
  const { user, profile } = useAuth();
  const { data: orders } = useQuery('orders', [['uid', '==', user.uid]], { sort: ['createdAt', 'desc'] });
  const { data: vouchers } = useQuery('vouchers', [['uid', '==', user.uid]]);
  const { data: tickets } = useQuery('tickets', [['uid', '==', user.uid]]);
  const live = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status));
  const saved = live.reduce((s, o) => s + (o.breakdown?.savings || 0) + (o.priceDropRefund || 0), 0);
  const name = (profile?.displayName || '').split(' ')[0] || 'there';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-ink-gradient p-6 text-white sm:p-8">
        <p className="text-ink-200">Namaste,</p>
        <h1 className="font-display text-3xl font-extrabold">{name} 👋</h1>
        <p className="mt-2 text-ink-200">You've saved <b className="text-white">{formatINR(saved)}</b> by buying together. Keep it going!</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Active orders & bookings" value={live.length} />
        <StatCard icon={PiggyBank} tone="emerald" label="Total savings" value={formatINR(saved)} />
        <StatCard icon={Ticket} tone="violet" label="Vouchers & passes" value={vouchers.filter((v) => v.status !== 'VOID').length} />
        <StatCard icon={LifeBuoy} tone="sky" label="Open tickets" value={tickets.filter((t) => t.status !== 'RESOLVED').length} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Recent orders & bookings</h2>
            <Button variant="ghost" size="sm" to="/account/orders">View all <ArrowRight className="h-4 w-4" /></Button>
          </div>
          {orders.length ? (
            <div className="space-y-3">
              {orders.slice(0, 5).map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Package} title="No orders yet" description="Join your first group deal to start saving." action={<Button to="/deals">Explore deals</Button>} />
          )}
        </div>
        <Card className="h-fit p-5">
          <Gift className="h-8 w-8 text-brand-500" />
          <p className="mt-3 font-display font-bold">Your referral code</p>
          <p className="text-sm text-ink-500">Your code is added to group links you share, so we can credit the invites you bring. Self-referrals don't count.</p>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-50 p-3">
            <code className="font-display text-lg font-bold tracking-widest">{profile?.referralCode}</code>
            <button
              className="rounded-lg p-2 hover:bg-white"
              aria-label="Copy referral code"
              onClick={() => navigator.clipboard?.writeText(profile?.referralCode || '').then(() => toast.success('Copied!'))}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
