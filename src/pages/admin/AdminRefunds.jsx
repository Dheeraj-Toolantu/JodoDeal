import { ReceiptIndianRupee } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, PageHeader, StatCard, Tabs } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDateTime, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

const TONE = { INITIATED: 'amber', PROCESSING: 'blue', COMPLETED: 'emerald', FAILED: 'rose' };

export default function AdminRefunds() {
  const { data: refunds } = useQuery('refunds', [], { sort: ['createdAt', 'desc'] });
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);
  const list = refunds.filter((r) => (tab === 'pending' ? r.status !== 'COMPLETED' : r.status === 'COMPLETED'));
  const act = async (refundId, action) => {
    setBusy(refundId + action);
    try {
      await call('processRefund', { refundId, action });
      toast.success(`Refund ${action.toLowerCase()}d`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const pending = refunds.filter((r) => r.status !== 'COMPLETED');
  return (
    <div className="space-y-5">
      <PageHeader title="Refunds" subtitle="Track every refund to completion. Refunds go to the original payment method." icon={ReceiptIndianRupee} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending refunds" value={pending.length} hint={formatINR(pending.reduce((s, r) => s + r.amount, 0))} tone="amber" />
        <StatCard label="Completed" value={refunds.length - pending.length} tone="emerald" />
        <StatCard label="Total refunded" value={formatINR(refunds.filter((r) => r.status === 'COMPLETED').reduce((s, r) => s + r.amount, 0))} tone="sky" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Pending', count: pending.length }, { value: 'done', label: 'Completed', count: refunds.length - pending.length }]} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>{['Refund', 'Reason', 'Amount', 'Status', 'Created', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {list.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs">{r.id.slice(-14)}</td>
                <td className="px-4 py-3">{r.reasonLabel}{r.note && <p className="text-xs text-ink-400">{r.note}</p>}</td>
                <td className="px-4 py-3 font-semibold">{formatINR(r.amount, true)}</td>
                <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{r.status.toLowerCase()}</Badge></td>
                <td className="px-4 py-3 text-xs text-ink-500">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {r.status === 'INITIATED' && <Button size="sm" variant="secondary" loading={busy === r.id + 'PROCESS'} onClick={() => act(r.id, 'PROCESS')}>Process</Button>}
                    {['INITIATED', 'PROCESSING'].includes(r.status) && <Button size="sm" variant="success" loading={busy === r.id + 'COMPLETE'} onClick={() => act(r.id, 'COMPLETE')}>Complete</Button>}
                    {r.status === 'FAILED' && <Button size="sm" variant="secondary" onClick={() => act(r.id, 'RETRY')}>Retry</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="p-6 text-center text-sm text-ink-500">No refunds here.</p>}
      </Card>
    </div>
  );
}
