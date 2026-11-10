import { AlertTriangle, Clock, Gauge, IndianRupee, Package, Repeat, RotateCcw, Share2, ShieldAlert, Target, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { GROUP_STATE_META } from '@shared/constants.js';
import { groupProgress } from '@shared/pricing.js';
import { Countdown } from '@/components/deal.jsx';
import { Card, PageHeader, ProgressBar, StatCard } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatINR } from '@/lib/format.js';

const PIE = ['#fe4a16', '#8279c1', '#10b981', '#f59e0b', '#0ea5e9', '#e11d74', '#64748b', '#4d438e', '#a3e635'];

export default function AdminDashboard() {
  const { data: offers } = useQuery('offers', []);
  const { data: groups } = useQuery('groups', []);
  const { data: orders } = useQuery('orders', []);
  const { data: refunds } = useQuery('refunds', []);
  const { data: tickets } = useQuery('tickets', []);
  const { data: bookings } = useQuery('bookings', []);
  const { data: payments } = useQuery('payments', []);
  const { data: referrals } = useQuery('referrals', []);
  const { data: vouchers } = useQuery('vouchers', []);

  const now = new Date();
  const views = offers.reduce((s, o) => s + (o.stats?.views || 0), 0);
  const shares = offers.reduce((s, o) => s + (o.stats?.shares || 0), 0);
  const paidOrders = orders.length;
  const live = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status));
  const gmv = live.reduce((s, o) => s + o.amountPaid, 0);
  const ended = groups.filter((g) => ['CONFIRMED', 'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'EXPIRED_FAILED'].includes(g.state));
  const succeeded = ended.filter((g) => g.state !== 'EXPIRED_FAILED');
  const customers = live.reduce((m, o) => ({ ...m, [o.uid]: (m[o.uid] || 0) + 1 }), {});
  const repeat = Object.values(customers).filter((n) => n > 1).length;
  const confirmedLike = orders.filter((o) => !['AWAITING_GROUP', 'CANCELLED', 'REFUNDED'].includes(o.status));
  const fulfilled = confirmedLike.filter((o) => ['DELIVERED', 'COMPLETED', 'ACTIVE', 'SHIPPED'].includes(o.status) || (o.kind !== 'PRODUCT' && o.status === 'CONFIRMED'));
  const doneRefunds = refunds.filter((r) => r.status === 'COMPLETED' && r.resolutionHours !== undefined);
  const avgRefundH = doneRefunds.length ? (doneRefunds.reduce((s, r) => s + r.resolutionHours, 0) / doneRefunds.length).toFixed(1) : '—';
  const eligibleBookings = bookings.filter((b) => ['MEMBERSHIP', 'APPOINTMENT', 'VOUCHER', 'ENROLMENT'].includes(b.kind) && !['CANCELLED', 'PROVIDER_CANCELLED'].includes(b.status));
  const attended = eligibleBookings.filter((b) => b.firstVisitAt || b.sessionsUsed > 0 || b.attendance?.length);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

  const atRisk = groups
    .filter((g) => g.state === 'OPEN' && new Date(g.deadline) > now)
    .map((g) => ({ g, hours: (new Date(g.deadline) - now) / 36e5, p: groupProgress(g) }))
    .filter((x) => x.hours < 48 && x.p.pct < 75)
    .sort((a, b) => a.hours - b.hours);
  const lowCapacity = offers.filter((o) => o.status === 'APPROVED' && o.capacity - (o.used || 0) - (o.held || 0) <= Math.max(3, o.capacity * 0.1));
  const unfulfilled = orders.filter((o) => o.kind === 'PRODUCT' && ['CONFIRMED', 'PROCESSING'].includes(o.status) && (now - new Date(o.confirmedAt || o.createdAt)) / 864e5 > 2);
  const overdueBookings = bookings.filter((b) => b.slots?.some((s) => s.status === 'REQUESTED' && new Date(s.at) < now));
  const openComplaints = tickets.filter((t) => t.status !== 'RESOLVED');
  const flagged = payments.filter((p) => p.rejected || p.flagged);
  const cancelCount = orders.reduce((m, o) => (['CANCELLED', 'REFUNDED'].includes(o.status) && o.cancelReason ? { ...m, [o.uid]: (m[o.uid] || 0) + 1 } : m), {});
  const serialCancellers = Object.entries(cancelCount).filter(([, n]) => n >= 3);

  const stateData = Object.entries(groups.reduce((m, g) => ({ ...m, [g.state]: (m[g.state] || 0) + 1 }), {})).map(([k, v]) => ({ name: GROUP_STATE_META[k]?.label || k, value: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Operations overview" subtitle="Pilot KPIs and exceptions that need attention." icon={Gauge} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} tone="emerald" label="GMV (live orders)" value={formatINR(gmv)} hint={`${live.length} orders/bookings`} />
        <StatCard icon={TrendingUp} label="Deal conversion" value={views ? `${((paidOrders / views) * 100).toFixed(1)}%` : '—'} hint="Paid joins ÷ deal views" />
        <StatCard icon={Target} tone="violet" label="Group completion" value={pct(succeeded.length, ended.length)} hint={`${succeeded.length}/${ended.length} closed groups`} />
        <StatCard icon={Share2} tone="sky" label="Share-to-join" value={pct(referrals.length, shares)} hint={`${referrals.length} attributed joins / ${shares} shares`} />
        <StatCard icon={Repeat} tone="amber" label="Repeat purchase" value={pct(repeat, Object.keys(customers).length)} hint={`${repeat} repeat customers`} />
        <StatCard icon={Package} tone="emerald" label="Merchant fulfilment" value={pct(fulfilled.length, confirmedLike.length)} hint="Fulfilled / on track ÷ confirmed" />
        <StatCard icon={RotateCcw} tone="rose" label="Refund resolution" value={avgRefundH === '—' ? '—' : `${avgRefundH} h`} hint={`${refunds.filter((r) => r.status !== 'COMPLETED').length} refunds pending`} />
        <StatCard icon={UserCheck} tone="sky" label="Service attendance" value={pct(attended.length, eligibleBookings.length)} hint="Redeemed / attended ÷ eligible" />
        <StatCard icon={Users} tone="violet" label="Complaint rate" value={paidOrders ? `${((tickets.length / paidOrders) * 100).toFixed(1)}` : '—'} hint="Tickets per 100 orders" />
        <StatCard icon={Clock} tone="amber" label="Codes issued" value={vouchers.length} hint={`${vouchers.filter((v) => v.redemptions?.length).length} redeemed`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-display font-bold"><AlertTriangle className="h-5 w-5 text-amber-500" /> Groups at risk of expiry ({atRisk.length})</p>
          <div className="space-y-2">
            {atRisk.slice(0, 6).map(({ g, p }) => (
              <Link key={g.id} to={`/g/${g.id}`} className="block rounded-xl p-3 ring-1 ring-ink-100 hover:bg-ink-50">
                <div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold">{g.offerTitle}</span><Countdown deadline={g.deadline} compact /></div>
                <div className="mt-1.5 flex items-center gap-2 text-xs"><ProgressBar value={p.pct} size="sm" /><span className="shrink-0 font-semibold">{g.paidCount}/{g.minGroupSize}</span></div>
              </Link>
            ))}
            {!atRisk.length && <p className="text-sm text-ink-500">No groups at risk in the next 48 hours.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-3 font-display font-bold">Groups by state</p>
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stateData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {stateData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {stateData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {d.name} <b>{d.value}</b></li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Low capacity offers', lowCapacity.map((o) => `${o.title} (${o.capacity - (o.used || 0)} left)`), '/admin/offers'],
          ['Unfulfilled orders > 2 days', unfulfilled.map((o) => `${o.offerTitle} · ${o.customerName}`), '/admin/groups'],
          ['Overdue booking requests', overdueBookings.map((b) => `${b.offerTitle} · ${b.customerName}`), '/admin/groups'],
          ['Unresolved complaints', openComplaints.map((t) => `${t.ref} · ${t.subject}`), '/admin/tickets'],
        ].map(([title, items, to]) => (
          <Card key={title} className="p-5">
            <p className="text-sm font-semibold text-ink-500">{title}</p>
            <p className="font-display text-3xl font-bold">{items.length}</p>
            <ul className="mt-2 space-y-1 text-xs text-ink-600">
              {items.slice(0, 3).map((x) => <li key={x} className="truncate">• {x}</li>)}
            </ul>
            <Link to={to} className="mt-2 inline-block text-xs font-semibold text-brand-600 hover:underline">Review →</Link>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-display font-bold"><ShieldAlert className="h-5 w-5 text-rose-500" /> Fraud & anomaly monitor</p>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-ink-50 p-4"><p className="text-ink-500">Rejected / flagged payments</p><p className="font-display text-2xl font-bold">{flagged.length}</p><p className="text-xs text-ink-500">Duplicates, closed groups, amount mismatches — all auto-refunded</p></div>
          <div className="rounded-xl bg-ink-50 p-4"><p className="text-ink-500">Serial cancellers (≥3)</p><p className="font-display text-2xl font-bold">{serialCancellers.length}</p><p className="text-xs text-ink-500">Review on Users page</p></div>
          <div className="rounded-xl bg-ink-50 p-4"><p className="text-ink-500">Self-referral attempts blocked</p><p className="font-display text-2xl font-bold">{payments.filter((p) => p.referralCode && referrals.every((r) => r.id !== p.id) && p.status === 'SUCCEEDED').length}</p><p className="text-xs text-ink-500">Referral codes not attributed</p></div>
        </div>
      </Card>
    </div>
  );
}
