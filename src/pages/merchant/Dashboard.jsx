import { AlertTriangle, BadgeCheck, Clock, Eye, IndianRupee, Megaphone, Percent, Plus, Repeat, Share2, ShieldAlert, Target, Users, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { groupProgress } from '@shared/pricing.js';
import { Countdown, GroupStateBadge } from '@/components/deal.jsx';
import { Button, Card, PageHeader, PageLoader, ProgressBar, StatCard } from '@/components/ui.jsx';
import { formatINR, formatNumber } from '@/lib/format.js';
import { useMerchantData } from './useMerchant.js';

export default function Dashboard() {
  const { merchant, offers, groups, orders, loading } = useMerchantData();
  if (loading || !merchant) return <PageLoader />;

  const views = offers.reduce((s, o) => s + (o.stats?.views || 0), 0);
  const shares = offers.reduce((s, o) => s + (o.stats?.shares || 0), 0);
  const paid = orders.filter((o) => !['CANCELLED'].includes(o.status));
  const live = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status));
  const revenue = live.reduce((s, o) => s + o.amountPaid, 0);
  const ended = groups.filter((g) => ['CONFIRMED', 'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'EXPIRED_FAILED'].includes(g.state));
  const completed = ended.filter((g) => g.state !== 'EXPIRED_FAILED');
  const completion = ended.length ? Math.round((completed.length / ended.length) * 100) : 0;
  const conversion = views ? ((paid.length / views) * 100).toFixed(1) : '0.0';
  const cancellations = orders.filter((o) => ['CANCELLED', 'REFUNDED'].includes(o.status)).length;
  const byCustomer = live.reduce((m, o) => ({ ...m, [o.uid]: (m[o.uid] || 0) + 1 }), {});
  const repeat = Object.values(byCustomer).filter((n) => n > 1).length;
  const atRisk = groups.filter((g) => g.state === 'OPEN' && new Date(g.deadline) > new Date()).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const chart = offers
    .filter((o) => o.status === 'APPROVED')
    .map((o) => ({ name: o.title.split(/[—-]/)[0].trim().slice(0, 18), joins: o.stats?.joins || 0, shares: o.stats?.shares || 0 }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={merchant.name}
        subtitle={merchant.tagline}
        actions={<Button icon={Plus} to="/merchant/offers/new">New offer</Button>}
      />
      {merchant.status !== 'VERIFIED' && (
        <Card className="flex items-start gap-3 bg-amber-50 p-5 ring-amber-200">
          {merchant.status === 'PENDING_VERIFICATION' ? <Clock className="h-6 w-6 text-amber-600" /> : <ShieldAlert className="h-6 w-6 text-rose-600" />}
          <div>
            <p className="font-bold text-amber-900">{merchant.status === 'PENDING_VERIFICATION' ? 'Verification in progress' : `Account ${merchant.status.toLowerCase()}`}</p>
            <p className="text-sm text-amber-900/80">{merchant.status === 'PENDING_VERIFICATION' ? 'You can draft offers now. You can submit them for approval once JodoDeal verifies your business.' : merchant.moderationNote}</p>
          </div>
        </Card>
      )}
      {merchant.status === 'VERIFIED' && (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><BadgeCheck className="h-5 w-5" /> Verified provider — your deals show the verified badge.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Gross bookings value" value={formatINR(revenue)} hint={`${live.length} active orders/bookings`} tone="emerald" />
        <StatCard icon={Eye} label="Deal views" value={formatNumber(views)} hint={`${conversion}% view → paid conversion`} tone="sky" />
        <StatCard icon={Share2} label="Shares" value={formatNumber(shares)} hint="WhatsApp, link & native shares" tone="violet" />
        <StatCard icon={Target} label="Group completion" value={`${completion}%`} hint={`${completed.length} of ${ended.length} closed groups succeeded`} />
        <StatCard icon={Users} label="Customers" value={Object.keys(byCustomer).length} hint={`${repeat} repeat customers`} tone="sky" />
        <StatCard icon={Repeat} label="Live offers" value={offers.filter((o) => o.status === 'APPROVED').length} hint={`${offers.filter((o) => o.status === 'PENDING_APPROVAL').length} pending approval`} tone="amber" />
        <StatCard icon={XCircle} label="Cancellations / refunds" value={cancellations} hint={paid.length ? `${Math.round((cancellations / paid.length) * 100)}% of orders` : '—'} tone="rose" />
        <StatCard icon={Percent} label="Avg. discount given" value={`${live.length ? Math.round((live.reduce((s, o) => s + (o.breakdown?.savings || 0), 0) / Math.max(1, live.reduce((s, o) => s + (o.breakdown?.mrpSubtotal || 0), 0))) * 100) : 0}%`} hint="vs your standard price" tone="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <p className="mb-4 font-display font-bold">Joins & shares by offer</p>
          {chart.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ebeaf6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f5f5fb' }} contentStyle={{ borderRadius: 12, border: '1px solid #ebeaf6' }} />
                  <Bar dataKey="joins" name="Paid joins" fill="#fe4a16" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="shares" name="Shares" fill="#8279c1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-500">Publish an offer to see analytics.</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-4 flex items-center gap-2 font-display font-bold"><AlertTriangle className="h-5 w-5 text-amber-500" /> Open groups to watch</p>
          <div className="space-y-3">
            {atRisk.slice(0, 6).map((g) => {
              const p = groupProgress(g);
              return (
                <Link key={g.id} to={`/g/${g.id}`} className="block rounded-xl p-3 ring-1 ring-ink-100 hover:bg-ink-50">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{g.offerTitle}</span>
                    <Countdown deadline={g.deadline} compact />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <ProgressBar value={p.pct} size="sm" />
                    <span className="shrink-0 font-semibold">{g.paidCount}/{g.minGroupSize}</span>
                    <GroupStateBadge state={g.state} />
                  </div>
                </Link>
              );
            })}
            {!atRisk.length && <p className="text-sm text-ink-500">No open groups right now.</p>}
          </div>
          <Button variant="ghost" size="sm" to="/merchant/offers" icon={Megaphone} className="mt-3">Manage campaigns</Button>
        </Card>
      </div>
    </div>
  );
}
