import { Ban, UsersRound } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { groupProgress } from '@shared/pricing.js';
import { Countdown, GroupStateBadge } from '@/components/deal.jsx';
import { Button, Card, Modal, PageHeader, ProgressBar, Tabs, Textarea } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDateTime, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

const TABS = { live: ['OPEN', 'TARGET_REACHED', 'CONFIRMED'], fulfil: ['FULFILMENT_IN_PROGRESS'], closed: ['COMPLETED', 'EXPIRED_FAILED', 'CANCELLED'] };

export default function AdminGroups() {
  const { data: groups } = useQuery('groups', [], { sort: ['createdAt', 'desc'] });
  const [tab, setTab] = useState('live');
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const list = groups.filter((g) => TABS[tab].includes(g.state));
  return (
    <div>
      <PageHeader title="Groups" subtitle="Monitor group completion, deadlines and fulfilment." icon={UsersRound} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'live', label: 'Live', count: groups.filter((g) => TABS.live.includes(g.state)).length }, { value: 'fulfil', label: 'In fulfilment', count: groups.filter((g) => TABS.fulfil.includes(g.state)).length }, { value: 'closed', label: 'Closed', count: groups.filter((g) => TABS.closed.includes(g.state)).length }]} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>{['Group', 'State', 'Progress', 'Price now', 'Deadline', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {list.map((g) => {
              const p = groupProgress(g);
              return (
                <tr key={g.id}>
                  <td className="px-4 py-3"><Link to={`/g/${g.id}`} className="font-semibold hover:text-brand-600">{g.offerTitle}</Link><p className="text-xs text-ink-400">{g.merchantName} · host {g.hostName}</p></td>
                  <td className="px-4 py-3"><GroupStateBadge state={g.state} /></td>
                  <td className="w-48 px-4 py-3"><div className="flex items-center gap-2"><ProgressBar value={p.pct} size="sm" /><span className="shrink-0 text-xs font-semibold">{g.paidCount}/{g.minGroupSize}</span></div></td>
                  <td className="px-4 py-3">{formatINR(g.achievedPrice)}</td>
                  <td className="px-4 py-3">{TABS.live.includes(g.state) ? <Countdown deadline={g.deadline} compact /> : <span className="text-xs text-ink-500">{formatDateTime(g.deadline)}</span>}</td>
                  <td className="px-4 py-3 text-right">{!TABS.closed.includes(g.state) && <Button size="sm" variant="ghost" icon={Ban} className="!text-rose-600" onClick={() => { setCancel(g); setReason(''); }}>Cancel</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="p-6 text-center text-sm text-ink-500">No groups.</p>}
      </Card>
      <Modal
        open={!!cancel}
        onClose={() => setCancel(null)}
        title="Cancel group & refund all members"
        footer={
          <Button
            variant="danger"
            loading={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await call('cancelGroup', { groupId: cancel.id, reason });
                toast.success(`Group cancelled — ${r.refunds} refunds initiated`);
                setCancel(null);
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancel group
          </Button>
        }
      >
        <p className="mb-3 text-sm text-ink-600">Use when the provider cannot fulfil or a policy breach is found. Every paid member is refunded in full and notified.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to members)" aria-label="Reason" />
      </Modal>
    </div>
  );
}
