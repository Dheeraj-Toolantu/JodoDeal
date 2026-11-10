import { Download, Info, Wallet } from 'lucide-react';
import { categoryById } from '@shared/categories.js';
import { round2 } from '@shared/pricing.js';
import { Card, EmptyState, PageHeader, StatCard, Button } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatINR } from '@/lib/format.js';
import { useMerchantData } from './useMerchant.js';

const SETTLEABLE = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'ACTIVE', 'COMPLETED', 'CANCELLATION_REQUESTED', 'RETURN_REQUESTED', 'REFUNDED', 'CANCELLED'];

function computeSettlement(orders, refunds) {
  const rows = {};
  for (const o of orders.filter((x) => SETTLEABLE.includes(x.status))) {
    const cat = categoryById(o.categoryId);
    const r = (rows[o.offerId] = rows[o.offerId] || { offer: o.offerTitle, orders: 0, gross: 0, fees: 0, commission: 0, commissionGst: 0, refunds: 0 });
    const b = o.breakdown;
    r.orders += 1;
    r.gross += b.subtotal + b.gst;
    r.fees += (b.deliveryFee || 0) + (b.visitFee || 0);
    const c = (b.subtotal * (cat?.commissionPct || 10)) / 100;
    r.commission += c;
    r.commissionGst += c * 0.18;
  }
  for (const rf of refunds.filter((x) => x.status !== 'FAILED')) {
    if (rows[rf.offerId] && rf.reason !== 'GROUP_FAILED') rows[rf.offerId].refunds += rf.amount;
  }
  const list = Object.values(rows).map((r) => ({ ...r, net: round2(r.gross + r.fees - r.commission - r.commissionGst - r.refunds) }));
  const total = list.reduce((t, r) => ({ gross: t.gross + r.gross, commission: t.commission + r.commission + r.commissionGst, refunds: t.refunds + r.refunds, net: t.net + r.net }), { gross: 0, commission: 0, refunds: 0, net: 0 });
  return { list, total };
}

export default function Settlements() {
  const { mid, orders } = useMerchantData();
  const { data: refunds } = useQuery('refunds', [['merchantId', '==', mid]], {}, !!mid);
  const { list, total } = computeSettlement(orders, refunds);

  const csv = () => {
    const head = 'Offer,Orders,Gross (incl GST),Delivery/visit fees,Commission,GST on commission,Refunds,Net payable\n';
    const body = list.map((r) => [`"${r.offer}"`, r.orders, r.gross, r.fees, r.commission, r.commissionGst, r.refunds, r.net].map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join(',')).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jododeal-settlement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settlements" subtitle="Commission applies only to confirmed orders. Payouts are processed through the payment provider's settlement workflow." icon={Wallet} actions={list.length > 0 && <Button variant="secondary" icon={Download} onClick={csv}>Download CSV</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross sales (incl. GST)" value={formatINR(total.gross)} tone="sky" />
        <StatCard label="Commission + GST" value={formatINR(total.commission)} tone="violet" />
        <StatCard label="Refunds deducted" value={formatINR(total.refunds)} tone="rose" />
        <StatCard label="Net payable" value={formatINR(total.net)} tone="emerald" />
      </div>
      {list.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr>
                {['Offer', 'Orders', 'Gross', 'Fees', 'Commission', 'GST on comm.', 'Refunds', 'Net'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {list.map((r) => (
                <tr key={r.offer}>
                  <td className="px-4 py-3 font-semibold">{r.offer}</td>
                  <td className="px-4 py-3">{r.orders}</td>
                  <td className="px-4 py-3">{formatINR(r.gross)}</td>
                  <td className="px-4 py-3">{formatINR(r.fees)}</td>
                  <td className="px-4 py-3">-{formatINR(r.commission)}</td>
                  <td className="px-4 py-3">-{formatINR(r.commissionGst)}</td>
                  <td className="px-4 py-3">-{formatINR(r.refunds)}</td>
                  <td className="px-4 py-3 font-display font-bold text-emerald-700">{formatINR(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState icon={Wallet} title="No settlements yet" description="Settlement lines appear once your groups are confirmed." />
      )}
      <p className="flex items-start gap-2 text-xs text-ink-500"><Info className="h-4 w-4 shrink-0" /> Platform fees are charged to customers and retained by JodoDeal. Customer funds are held and split only through a compliant payment-provider structure.</p>
    </div>
  );
}
