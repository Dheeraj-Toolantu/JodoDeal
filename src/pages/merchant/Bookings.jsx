import { CalendarCheck, CheckCircle2, ClipboardList, FileText, Plus, Trash2, UserCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BookingStatusBadge } from '@/components/deal.jsx';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDate, formatDateTime, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';
import { useMerchantData } from './useMerchant.js';

const KIND_LABEL = { MEMBERSHIP: 'Membership', ENROLMENT: 'Course enrolment', PROJECT: 'Project', APPOINTMENT: 'Appointment', VOUCHER: 'Voucher' };

export default function Bookings() {
  const { mid } = useMerchantData();
  const { data: bookings } = useQuery('bookings', [['merchantId', '==', mid]], { sort: ['createdAt', 'desc'] }, !!mid);
  const [kind, setKind] = useState('all');
  const [modal, setModal] = useState(null);
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState([{ description: '', type: 'INCLUDED', amount: '' }]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const kinds = [...new Set(bookings.map((b) => b.kind))];
  const list = bookings.filter((b) => kind === 'all' || b.kind === kind);

  const run = async (name, payload, msg) => {
    setBusy(true);
    try {
      await call(name, payload);
      toast.success(msg);
      setModal(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Bookings & projects" subtitle="Each customer's membership, enrolment, appointment or project is tracked separately." icon={ClipboardList} />
      <Tabs className="mb-4" value={kind} onChange={setKind} tabs={[{ value: 'all', label: 'All', count: bookings.length }, ...kinds.map((k) => ({ value: k, label: KIND_LABEL[k], count: bookings.filter((b) => b.kind === k).length }))]} />
      {list.length ? (
        <div className="space-y-3">
          {list.map((b) => {
            const requested = b.slots?.find((s) => s.status === 'REQUESTED');
            const scheduled = b.slots?.find((s) => s.status === 'SCHEDULED');
            const closed = ['COMPLETED', 'CANCELLED', 'PROVIDER_CANCELLED'].includes(b.status);
            return (
              <Card key={b.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookingStatusBadge status={b.status} />
                      <Badge>{KIND_LABEL[b.kind]}</Badge>
                      <span className="text-xs text-ink-400">{formatDate(b.createdAt)}</span>
                    </div>
                    <p className="mt-1 font-semibold">{b.customerName} · {b.offerTitle}</p>
                    <p className="text-sm text-ink-500">{b.optionLabel}</p>
                    <div className="mt-1 text-xs text-ink-500">
                      {b.kind === 'MEMBERSHIP' && <>Code {b.membershipCode} · {b.validFrom ? `valid ${formatDate(b.validFrom)} – ${formatDate(b.validTo)}` : 'activates on first visit'}</>}
                      {b.kind === 'ENROLMENT' && <>Starts {formatDate(b.startDate)} · attendance {b.attendance?.length || 0}</>}
                      {['APPOINTMENT', 'VOUCHER'].includes(b.kind) && <>Code {b.voucherCode} · {b.sessionsUsed}/{b.sessionsTotal} sessions used</>}
                      {b.kind === 'PROJECT' && <>{b.caseRef} · PIN {b.projectDetails?.pincode} · {b.projectDetails?.propertyType} {b.projectDetails?.rooms} · {b.milestones.filter((m) => m.status === 'DONE').length}/{b.milestones.length} milestones</>}
                    </div>
                    {requested && <p className="mt-2 inline-block rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Customer requested {formatDateTime(requested.at)}</p>}
                    {scheduled && <p className="mt-2 inline-block rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Scheduled {formatDateTime(scheduled.at)}</p>}
                  </div>
                  {!closed && (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {['APPOINTMENT', 'VOUCHER', 'PROJECT'].includes(b.kind) && (
                        <Button size="sm" variant="secondary" icon={CalendarCheck} onClick={() => { setSlot(requested ? requested.at.slice(0, 16) : ''); setModal({ type: 'slot', b }); }}>
                          {requested ? 'Confirm slot' : 'Schedule'}
                        </Button>
                      )}
                      {b.kind === 'ENROLMENT' && <Button size="sm" variant="secondary" icon={UserCheck} loading={busy} onClick={() => run('bookingAction', { bookingId: b.id, action: 'ATTENDANCE' }, 'Attendance recorded')}>Mark attendance</Button>}
                      {b.kind === 'PROJECT' && <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => setModal({ type: 'milestones', b })}>Milestones</Button>}
                      {b.kind === 'PROJECT' && <Button size="sm" icon={FileText} onClick={() => { setItems([{ description: '', type: 'INCLUDED', amount: '' }]); setNotes(''); setModal({ type: 'quote', b }); }}>Issue quote</Button>}
                      {scheduled && <Button size="sm" variant="ghost" loading={busy} onClick={() => run('bookingAction', { bookingId: b.id, action: 'NO_SHOW' }, 'Marked no-show')}>No-show</Button>}
                      {['ENROLMENT', 'APPOINTMENT'].includes(b.kind) && <Button size="sm" variant="success" loading={busy} onClick={() => run('bookingAction', { bookingId: b.id, action: 'COMPLETE' }, 'Marked complete')}>Complete</Button>}
                      <Button size="sm" variant="ghost" icon={XCircle} className="!text-rose-600" onClick={() => { setReason(''); setModal({ type: 'cancel', b }); }}>Cancel</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="No bookings yet" description="Bookings appear once a customer's group is confirmed." />
      )}

      <Modal open={modal?.type === 'slot'} onClose={() => setModal(null)} title="Confirm appointment slot" footer={<Button loading={busy} disabled={!slot} onClick={() => run('bookingAction', { bookingId: modal.b.id, action: 'CONFIRM_SLOT', slot: new Date(slot).toISOString() }, 'Slot confirmed — customer notified')}>Confirm</Button>}>
        <Field label="Date & time"><Input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} /></Field>
        <p className="mt-2 text-xs text-ink-500">Validate your capacity for this slot before confirming.</p>
      </Modal>

      <Modal open={modal?.type === 'cancel'} onClose={() => setModal(null)} title="Cancel this booking" footer={<Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => run('bookingAction', { bookingId: modal.b.id, action: 'PROVIDER_CANCEL', reason }, 'Booking cancelled — customer refunded')}>Cancel & refund</Button>}>
        <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Provider cancellation triggers a full refund to the customer and opens a support case. It is recorded against your provider performance.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shared with the customer)" aria-label="Reason" />
      </Modal>

      <Modal open={modal?.type === 'milestones'} onClose={() => setModal(null)} title="Project milestones" size="lg">
        {modal?.b && (
          <div className="space-y-2">
            {modal.b.milestones.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-ink-100">
                <div>
                  <p className="text-sm font-semibold">{m.label}</p>
                  {m.note && <p className="text-xs text-ink-500">{m.note} · {formatDateTime(m.at)}</p>}
                </div>
                {m.status === 'DONE' ? (
                  <Badge tone="emerald" icon={CheckCircle2}>Done</Badge>
                ) : (
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => run('updateMilestone', { bookingId: modal.b.id, key: m.key, status: 'DONE', note: 'Completed' }, 'Milestone updated')}>Mark done</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={modal?.type === 'quote'}
        onClose={() => setModal(null)}
        title="Issue itemised quotation"
        size="lg"
        footer={<Button loading={busy} onClick={() => run('issueQuotation', { bookingId: modal.b.id, items: items.map((i) => ({ ...i, amount: Number(i.amount) })), notes }, 'Quotation sent to customer')}>Send quotation</Button>}
      >
        <p className="mb-3 text-sm text-ink-500">Separate included work, optional upgrades, materials and additional charges. GST 18% is added automatically. No open-ended "starting from" prices.</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Input className="flex-1" placeholder="Line item" value={it.description} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <Select className="!w-36" value={it.type} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                <option value="INCLUDED">Included</option>
                <option value="OPTIONAL">Optional</option>
                <option value="MATERIAL">Material</option>
                <option value="ADDITIONAL">Additional</option>
              </Select>
              <Input className="!w-28" placeholder="₹" inputMode="numeric" value={it.amount} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
              <button className="rounded-lg p-2 text-ink-400 hover:text-rose-500" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setItems((l) => [...l, { description: '', type: 'INCLUDED', amount: '' }])}>Add line</Button>
        </div>
        <p className="mt-3 text-right text-sm">Subtotal (excl. optional): <b>{formatINR(items.filter((i) => i.type !== 'OPTIONAL').reduce((s, i) => s + Number(i.amount || 0), 0))}</b></p>
        <Field label="Notes (timeline, payment milestones)" className="mt-3"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
