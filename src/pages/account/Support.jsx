import { LifeBuoy, Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { TICKET_CATEGORIES } from '@shared/constants.js';
import { TicketThread } from '@/components/TicketThread.jsx';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { relativeTime, TICKET_TONE } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

export default function Support() {
  const { user } = useAuth();
  const { data: tickets } = useQuery('tickets', [['uid', '==', user.uid]], { sort: ['updatedAt', 'desc'] });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ category: 'OTHER', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const active = tickets.find((t) => t.id === openId);

  const create = async () => {
    setBusy(true);
    try {
      const r = await call('createTicket', form);
      toast.success(`Ticket ${r.ref} created`);
      setCreating(false);
      setForm({ category: 'OTHER', subject: '', message: '' });
      setOpenId(r.ticketId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Support" subtitle="We usually reply within a few hours." icon={LifeBuoy} actions={<Button icon={Plus} onClick={() => setCreating(true)}>New ticket</Button>} />
      {tickets.length ? (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="w-full text-left">
              <Card className="flex items-center justify-between gap-4 p-4 transition hover:shadow-lift">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={TICKET_TONE[t.status]}>{t.status.replace('_', ' ').toLowerCase()}</Badge>
                    <span className="text-xs text-ink-400">{t.ref} · {TICKET_CATEGORIES[t.category]}</span>
                  </div>
                  <p className="mt-1 truncate font-semibold">{t.subject}</p>
                  <p className="truncate text-sm text-ink-500">{t.messages.at(-1)?.text}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-400">{relativeTime(t.updatedAt)}</span>
              </Card>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={LifeBuoy} title="No tickets" description="Need help with a payment, order, booking or provider? Raise a ticket." action={<Button onClick={() => setCreating(true)}>Raise a ticket</Button>} />
      )}

      <Modal open={!!active} onClose={() => setOpenId(null)} title={active ? `${active.ref} · ${active.subject}` : ''} size="lg">
        {active && <TicketThread ticket={active} />}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="New support ticket" footer={<Button loading={busy} disabled={!form.subject || !form.message} onClick={create}>Submit</Button>}>
        <div className="space-y-3">
          <Field label="Topic">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Subject" required><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></Field>
          <Field label="Describe the issue" required><Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
