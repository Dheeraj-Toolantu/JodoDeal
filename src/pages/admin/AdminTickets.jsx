import { LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { TICKET_CATEGORIES } from '@shared/constants.js';
import { Badge, Card, Modal, PageHeader, Select, Tabs } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { relativeTime } from '@/lib/format.js';
import { call } from '@/services/api.js';
import { TicketThread } from '@/components/TicketThread.jsx';
import { TICKET_TONE } from '@/lib/format.js';

export default function AdminTickets() {
  const { data: tickets } = useQuery('tickets', [], { sort: ['updatedAt', 'desc'] });
  const [tab, setTab] = useState('open');
  const [openId, setOpenId] = useState(null);
  const list = tickets.filter((t) => (tab === 'open' ? t.status !== 'RESOLVED' : t.status === 'RESOLVED'));
  const active = tickets.find((t) => t.id === openId);
  return (
    <div>
      <PageHeader title="Support tickets" subtitle="Customer cases with order context. Respond within SLA." icon={LifeBuoy} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open', count: tickets.filter((t) => t.status !== 'RESOLVED').length }, { value: 'resolved', label: 'Resolved', count: tickets.filter((t) => t.status === 'RESOLVED').length }]} />
      <div className="space-y-3">
        {list.map((t) => (
          <button key={t.id} className="w-full text-left" onClick={() => setOpenId(t.id)}>
            <Card className="flex items-center justify-between gap-4 p-4 hover:shadow-lift">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TICKET_TONE[t.status]}>{t.status.replace('_', ' ').toLowerCase()}</Badge>
                  {t.priority === 'HIGH' && <Badge tone="rose">High priority</Badge>}
                  <span className="text-xs text-ink-400">{t.ref} · {TICKET_CATEGORIES[t.category]} · {t.customerName}</span>
                </div>
                <p className="mt-1 truncate font-semibold">{t.subject}</p>
                <p className="truncate text-sm text-ink-500">{t.messages.at(-1)?.text}</p>
              </div>
              <span className="shrink-0 text-xs text-ink-400">{relativeTime(t.updatedAt)}</span>
            </Card>
          </button>
        ))}
        {!list.length && <p className="p-6 text-center text-sm text-ink-500">No tickets.</p>}
      </div>
      <Modal open={!!active} onClose={() => setOpenId(null)} title={active ? `${active.ref} · ${active.subject}` : ''} size="lg">
        {active && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-ink-500">Status</span>
              <Select className="!w-44 !py-1.5" value={active.status} onChange={(e) => call('updateTicket', { ticketId: active.id, status: e.target.value })}>
                {['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
              </Select>
              {active.orderId && <span className="font-semibold text-ink-700">Order #{active.orderId.slice(-8).toUpperCase()}</span>}
            </div>
            <TicketThread ticket={active} staff />
          </>
        )}
      </Modal>
    </div>
  );
}
