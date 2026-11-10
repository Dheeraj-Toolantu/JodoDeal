import { CheckCircle2, Circle, ReceiptIndianRupee } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { cx, formatDateTime, formatINR } from '@/lib/format.js';

const STEPS = ['INITIATED', 'PROCESSING', 'COMPLETED'];
const TONE = { INITIATED: 'amber', PROCESSING: 'blue', COMPLETED: 'emerald', FAILED: 'rose' };

export default function Refunds() {
  const { user } = useAuth();
  const { data: refunds } = useQuery('refunds', [['uid', '==', user.uid]], { sort: ['createdAt', 'desc'] });
  const total = refunds.reduce((s, r) => s + r.amount, 0);
  return (
    <div>
      <PageHeader title="Refunds" subtitle={`Refunds always go back to your original payment method. ${refunds.length ? `Total: ${formatINR(total, true)}` : ''}`} icon={ReceiptIndianRupee} />
      {refunds.length ? (
        <div className="space-y-3">
          {refunds.map((r) => {
            const idx = STEPS.indexOf(r.status);
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone={TONE[r.status]}>{r.status.toLowerCase()}</Badge>
                    <p className="mt-1.5 font-semibold">{r.reasonLabel}</p>
                    {r.note && <p className="text-sm text-ink-500">{r.note}</p>}
                    <p className="text-xs text-ink-400">Ref {r.id.slice(-10).toUpperCase()} · {formatDateTime(r.createdAt)}</p>
                  </div>
                  <p className="font-display text-2xl font-extrabold">{formatINR(r.amount, true)}</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center gap-2">
                      {i <= idx ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-ink-200" />}
                      <span className={cx('text-xs font-semibold', i <= idx ? 'text-ink-800' : 'text-ink-400')}>{s.toLowerCase()}</span>
                      {i < STEPS.length - 1 && <span className={cx('h-0.5 flex-1 rounded', i < idx ? 'bg-emerald-400' : 'bg-ink-100')} />}
                    </div>
                  ))}
                </div>
                {r.gatewayRefundRef && <p className="mt-3 text-xs text-ink-500">Bank reference: {r.gatewayRefundRef}</p>}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={ReceiptIndianRupee} title="No refunds" description="If a group misses its target or you cancel, your refund is tracked here until it's complete." />
      )}
    </div>
  );
}
