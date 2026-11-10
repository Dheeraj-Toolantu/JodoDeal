import { FileWarning } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext.jsx';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Tabs, Textarea } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDateTime, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

export function CaseList({ wheres, enabled = true, staff }) {
  const { data: cases } = useQuery('cases', wheres, { sort: ['createdAt', 'desc'] }, enabled);
  const [tab, setTab] = useState('OPEN');
  const [active, setActive] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const list = cases.filter((c) => (tab === 'OPEN' ? ['OPEN', 'IN_REVIEW'].includes(c.status) : c.status === 'RESOLVED'));

  const decide = async (decision) => {
    setBusy(true);
    try {
      await call('resolveCase', { caseId: active.id, decision, refundAmount: amount === '' ? undefined : Number(amount), note });
      toast.success(decision === 'APPROVE' ? 'Approved — refund initiated' : 'Request declined');
      setActive(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'OPEN', label: 'Open', count: cases.filter((c) => c.status !== 'RESOLVED').length }, { value: 'RESOLVED', label: 'Resolved', count: cases.filter((c) => c.status === 'RESOLVED').length }]} />
      {list.length ? (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.type === 'RETURN' ? 'violet' : 'amber'}>{c.typeLabel}</Badge>
                  {c.decision && <Badge tone={c.decision === 'APPROVED' ? 'emerald' : 'rose'}>{c.decision.toLowerCase()}</Badge>}
                  <span className="text-xs text-ink-400">{formatDateTime(c.createdAt)} · {c.reasonCode}</span>
                </div>
                <p className="mt-1 font-semibold">{c.offerTitle}</p>
                <p className="text-sm text-ink-600">"{c.reason}"</p>
                <p className="text-xs text-ink-500">Policy refund: {formatINR(c.proposedRefund, true)} — {c.refundExplanation}</p>
              </div>
              {c.status !== 'RESOLVED' && (
                <Button
                  size="sm"
                  onClick={() => {
                    setActive(c);
                    setAmount(String(c.proposedRefund));
                    setNote('');
                  }}
                >
                  Review
                </Button>
              )}
              {c.status === 'RESOLVED' && <p className="text-sm font-semibold">{c.refundAmount !== undefined ? formatINR(c.refundAmount, true) : '—'}</p>}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileWarning} title={tab === 'OPEN' ? 'No open requests 🎉' : 'No resolved requests'} />
      )}
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={`Review ${active?.typeLabel?.toLowerCase()} request`}
        footer={
          <>
            <Button variant="secondary" loading={busy} disabled={!note.trim()} onClick={() => decide('REJECT')}>Decline</Button>
            <Button variant="success" loading={busy} onClick={() => decide('APPROVE')}>Approve & refund</Button>
          </>
        }
      >
        {active && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">{active.reason}</p>
            <p className="rounded-xl bg-ink-50 p-3 text-sm">Policy calculation: <b>{formatINR(active.proposedRefund, true)}</b> — {active.refundExplanation}</p>
            <Field label="Refund amount (₹)" hint={staff ? 'Admin may override as a remedy.' : 'Defaults to the disclosed policy amount.'}>
              <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <Field label="Note to customer" hint="Required when declining"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Cases() {
  const mid = useAuth().profile?.merchantId;
  return (
    <div>
      <PageHeader title="Customer requests" subtitle="Cancellations and returns on your orders. One customer's request never affects other members." icon={FileWarning} />
      <CaseList wheres={[['merchantId', '==', mid]]} enabled={!!mid} />
    </div>
  );
}
