import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileSignature,
  GraduationCap,
  LifeBuoy,
  MapPin,
  MessageSquarePlus,
  PartyPopper,
  QrCode,
  RotateCcw,
  Star,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ACTIVATION_RULES, FAILURE_POLICIES, FULFILMENT_META, PRICING_RULES, TICKET_CATEGORIES } from '@shared/constants.js';
import { cancellationRefund } from '@shared/pricing.js';
import { BookingStatusBadge, OrderStatusBadge, ShareBar, Stars } from '@/components/deal.jsx';
import { Badge, Button, Card, EmptyState, Field, Input, KeyValue, Modal, PageLoader, Select, Textarea } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useDoc } from '@/hooks/useData.js';
import { cx, formatDate, formatDateTime, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

function useAction() {
  const [busy, setBusy] = useState(false);
  const run = async (fn, success) => {
    setBusy(true);
    try {
      const r = await fn();
      if (success) toast.success(success);
      return r;
    } catch (e) {
      toast.error(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

function CodeCard({ code, title, subtitle, children }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 p-6 text-white sm:flex-row">
      <div className="rounded-2xl bg-white p-3">
        <QRCodeSVG value={`JODODEAL:${code}`} size={132} level="M" />
      </div>
      <div className="text-center sm:text-left">
        <p className="text-sm text-ink-200">{title}</p>
        <p className="mt-1 font-display text-2xl font-extrabold tracking-[0.2em]">{code}</p>
        {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function MembershipSection({ booking, voucher }) {
  return (
    <div className="space-y-4">
      <CodeCard code={booking.membershipCode} title="Membership activation code" subtitle={`Show at ${booking.branch || 'the branch'}`}>
        <p className="mt-2 text-xs text-ink-300">{voucher?.redemptions?.length ? `Activated ${formatDateTime(voucher.redemptions[0].at)}` : 'Not yet activated · single use'}</p>
      </CodeCard>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Activation', ACTIVATION_RULES[booking.activationRule]],
          ['Valid from', booking.validFrom ? formatDate(booking.validFrom) : 'Your first visit'],
          ['Valid until', booking.validTo ? formatDate(booking.validTo) : `${booking.durationDays} days after activation`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-ink-50 p-3">
            <p className="text-xs text-ink-500">{l}</p>
            <p className="mt-0.5 text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {booking.address && (
        <p className="flex items-center gap-2 text-sm text-ink-600">
          <MapPin className="h-4 w-4" /> {booking.address}
        </p>
      )}
    </div>
  );
}

function CourseSection({ booking }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100">
        <GraduationCap className="h-6 w-6 shrink-0 text-violet-600" />
        <div>
          <p className="font-bold text-violet-900">{booking.cohort}</p>
          <p className="text-sm text-violet-900/80">{booking.schedule} · {booking.platform}</p>
          {booking.startDate && <p className="mt-1 text-sm font-semibold text-violet-900">Starts {formatDate(booking.startDate)}</p>}
        </div>
      </div>
      <div className="rounded-2xl p-4 ring-1 ring-ink-100">
        <p className="text-sm font-bold">Access instructions</p>
        <p className="mt-1 text-sm text-ink-600">{booking.accessInstructions}</p>
        <p className="mt-2 text-xs text-ink-400">Enrolment code: <code className="font-bold">{booking.accessCode}</code></p>
      </div>
      {booking.attendance?.length > 0 && <p className="text-sm text-ink-600">Attendance recorded: {booking.attendance.length} session(s)</p>}
    </div>
  );
}

function SlotRequest({ booking }) {
  const [slot, setSlot] = useState('');
  const [busy, run] = useAction();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="Request a slot" className="flex-1">
        <Input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
      </Field>
      <Button variant="secondary" icon={CalendarClock} loading={busy} disabled={!slot} onClick={() => run(() => call('rescheduleBooking', { bookingId: booking.id, slot: new Date(slot).toISOString() }), 'Slot request sent to provider')}>
        Request
      </Button>
    </div>
  );
}

function Slots({ booking }) {
  if (!booking.slots?.length) return null;
  return (
    <ul className="space-y-2">
      {booking.slots.map((s, i) => (
        <li key={i} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-ink-400" /> {formatDateTime(s.at)}
          </span>
          <Badge tone={s.status === 'SCHEDULED' ? 'emerald' : s.status === 'NO_SHOW' ? 'rose' : 'amber'}>{s.status === 'REQUESTED' ? 'Awaiting provider' : s.status.replace('_', ' ').toLowerCase()}</Badge>
        </li>
      ))}
    </ul>
  );
}

function AppointmentSection({ booking }) {
  return (
    <div className="space-y-4">
      <CodeCard code={booking.voucherCode} title={booking.kind === 'VOUCHER' ? 'Voucher code' : 'Package code'} subtitle={`${booking.sessionsUsed}/${booking.sessionsTotal} sessions used · valid until ${formatDate(booking.validTo)}`} />
      <Slots booking={booking} />
      {booking.status !== 'COMPLETED' && <SlotRequest booking={booking} />}
    </div>
  );
}

function ProjectSection({ booking }) {
  const [busy, run] = useAction();
  const [cr, setCr] = useState('');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="dark">Case {booking.caseRef}</Badge>
        {booking.projectDetails?.pincode && <span className="text-ink-500">PIN {booking.projectDetails.pincode} · {booking.projectDetails.propertyType} · {booking.projectDetails.rooms}</span>}
      </div>
      <Slots booking={booking} />
      {!booking.slots?.some((s) => s.status === 'SCHEDULED') && booking.status !== 'COMPLETED' && <SlotRequest booking={booking} />}

      <div>
        <p className="mb-3 font-display font-bold">Milestones</p>
        <ol className="space-y-3">
          {booking.milestones.map((m) => (
            <li key={m.key} className="flex gap-3">
              {m.status === 'DONE' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-ink-200" />}
              <div>
                <p className={cx('text-sm font-semibold', m.status !== 'DONE' && 'text-ink-500')}>{m.label}</p>
                {m.note && <p className="text-xs text-ink-500">{m.note}</p>}
                {m.at && <p className="text-[11px] text-ink-400">{formatDateTime(m.at)}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {booking.quotations?.map((q) => (
        <div key={q.id} className="overflow-hidden rounded-2xl ring-1 ring-ink-100">
          <div className="flex items-center justify-between bg-ink-50 px-4 py-3">
            <p className="font-bold">Quotation {q.number}</p>
            <Badge tone={q.status === 'ACCEPTED' ? 'emerald' : q.status === 'DECLINED' ? 'rose' : 'amber'}>{q.status}</Badge>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {q.items.map((it, i) => (
                <tr key={i} className="border-t border-ink-50">
                  <td className="px-4 py-2">
                    {it.description} <Badge tone={{ INCLUDED: 'emerald', OPTIONAL: 'blue', MATERIAL: 'violet', ADDITIONAL: 'amber' }[it.type]} className="ml-1">{it.type.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">{formatINR(it.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-ink-100 bg-ink-50/50">
                <td className="px-4 py-2 text-ink-500">Subtotal (excl. optional)</td>
                <td className="px-4 py-2 text-right">{formatINR(q.subtotal)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-ink-500">GST {q.gstRate}%</td>
                <td className="px-4 py-2 text-right">{formatINR(q.gst)}</td>
              </tr>
              <tr className="border-t border-ink-100">
                <td className="px-4 py-2 font-bold">Total</td>
                <td className="px-4 py-2 text-right font-display text-lg font-extrabold">{formatINR(q.total)}</td>
              </tr>
              {q.optionalTotal > 0 && (
                <tr>
                  <td className="px-4 pb-3 text-xs text-ink-500" colSpan={2}>Optional upgrades available: {formatINR(q.optionalTotal)} (not included in total)</td>
                </tr>
              )}
            </tbody>
          </table>
          {q.notes && <p className="border-t border-ink-50 px-4 py-3 text-xs text-ink-500">{q.notes}</p>}
          {q.status === 'ISSUED' && (
            <div className="flex gap-2 border-t border-ink-100 p-4">
              <Button variant="success" size="sm" loading={busy} onClick={() => run(() => call('respondQuotation', { bookingId: booking.id, quotationId: q.id, accept: true }), 'Quotation accepted')}>
                Accept quote
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => call('respondQuotation', { bookingId: booking.id, quotationId: q.id, accept: false }), 'Quotation declined')}>
                Decline
              </Button>
              <span className="ml-auto self-center text-xs text-ink-400">Valid until {formatDate(q.validUntil)}</span>
            </div>
          )}
        </div>
      ))}

      <div>
        <p className="mb-2 font-display font-bold">Change requests</p>
        {booking.changeRequests?.length ? (
          <ul className="mb-3 space-y-2">
            {booking.changeRequests.map((c) => (
              <li key={c.id} className="rounded-xl bg-ink-50 p-3 text-sm">
                <span className="font-semibold capitalize">{c.raisedBy}:</span> {c.description} {c.costImpact ? <b>({formatINR(c.costImpact)})</b> : null}
                <span className="block text-xs text-ink-400">{formatDateTime(c.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-ink-500">No change requests. Any scope change is recorded here for both parties.</p>
        )}
        {booking.status !== 'COMPLETED' && (
          <div className="flex gap-2">
            <Input value={cr} onChange={(e) => setCr(e.target.value)} placeholder="Describe a change you'd like…" />
            <Button
              variant="secondary"
              icon={MessageSquarePlus}
              disabled={!cr.trim() || busy}
              onClick={async () => {
                const r = await run(() => call('addChangeRequest', { bookingId: booking.id, description: cr }), 'Change request recorded');
                if (r) setCr('');
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>
      {booking.status !== 'COMPLETED' && booking.milestones.some((m) => m.status === 'DONE') && (
        <Button variant="dark" icon={FileSignature} loading={busy} onClick={() => window.confirm('Sign off this project as complete? This confirms handover.') && run(() => call('signOffProject', { bookingId: booking.id }), 'Project signed off — thank you!')}>
          Sign off handover
        </Button>
      )}
    </div>
  );
}

function ShipmentSection({ shipment, order }) {
  if (!shipment) {
    return <p className="text-sm text-ink-600">{order.status === 'AWAITING_GROUP' ? 'Your order will be packed once the group is confirmed.' : 'The merchant is preparing your parcel. Tracking appears here once shipped.'}</p>;
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="indigo" icon={Truck}>{shipment.carrier}</Badge>
        <span>AWB <b>{shipment.awb}</b></span>
      </div>
      <ol className="relative space-y-4 border-l-2 border-ink-100 pl-5">
        {[...shipment.events].reverse().map((e, i) => (
          <li key={i} className="relative">
            <span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4', i === 0 ? 'bg-emerald-500 ring-emerald-100' : 'bg-ink-300 ring-ink-100')} />
            <p className="text-sm font-semibold">{e.event.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</p>
            {e.note && <p className="text-xs text-ink-500">{e.note}</p>}
            <p className="text-[11px] text-ink-400">{formatDateTime(e.at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const { data: order, loading } = useDoc(`orders/${orderId}`);
  const { data: booking } = useDoc(order && order.kind !== 'PRODUCT' ? `bookings/${orderId}` : null);
  const { data: shipment } = useDoc(order?.kind === 'PRODUCT' ? `shipments/${orderId}` : null);
  const { data: group } = useDoc(order ? `groups/${order.groupId}` : null);
  const { data: offer } = useDoc(order ? `offers/${order.offerId}` : null);
  const { data: review } = useDoc(order ? `reviews/${orderId}` : null);
  const voucherCode = booking?.membershipCode || booking?.voucherCode;
  const { data: voucher } = useDoc(voucherCode ? `vouchers/${voucherCode}` : null);
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState('CHANGED_MIND');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [ticket, setTicket] = useState({ category: 'ORDER', subject: '', message: '' });
  const [busy, run] = useAction();

  if (loading) return <PageLoader />;
  if (!order) return <EmptyState icon={XCircle} title="Order not found" action={<Button to="/account/orders">Back to orders</Button>} />;

  const meta = FULFILMENT_META[order.kind];
  const canCancel = !['CANCELLED', 'REFUNDED', 'CANCELLATION_REQUESTED', 'RETURN_REQUESTED', 'COMPLETED', 'SHIPPED', 'DELIVERED'].includes(order.status);
  const canReturn = order.kind === 'PRODUCT' && order.status === 'DELIVERED';
  const canReview = !review && ['CONFIRMED', 'ACTIVE', 'DELIVERED', 'COMPLETED', 'SHIPPED'].includes(order.status);
  const refundPreview = offer ? cancellationRefund({ order: { ...order, consumed: (booking?.sessionsUsed || 0) > 0 || !!booking?.firstVisitAt }, offer }) : null;
  const t = order.termsSnapshot || {};

  const close = () => setModal(null);

  return (
    <div className="space-y-5">
      <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      {params.get('welcome') && (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200 animate-fade-up">
          <PartyPopper className="h-7 w-7 shrink-0 text-emerald-600" />
          <div>
            <p className="font-display text-lg font-bold text-emerald-900">Payment successful — you're in!</p>
            <p className="text-sm text-emerald-800">
              {order.status === 'AWAITING_GROUP' ? 'Share the group with friends so it reaches its target faster. If it does not fill in time, you get a full refund.' : `The group is confirmed. Your ${meta.record.toLowerCase()} details are below.`}
            </p>
          </div>
        </div>
      )}

      {order.extensionConsent === 'PENDING' && (
        <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-5 w-5" /> Your group missed its target — do you want to stay in?
          </p>
          <p className="mt-1 text-sm text-amber-900/80">The provider has extended the deadline once. Opt in to stay; otherwise you'll be refunded in full. We never assume you accepted.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="success" loading={busy} onClick={() => run(() => call('respondToExtension', { orderId, accept: true }), "You're staying in the group")}>Yes, keep me in</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => call('respondToExtension', { orderId, accept: false }), 'Refund initiated')}>No, refund me</Button>
          </div>
        </div>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              {booking && booking.status !== order.status && <BookingStatusBadge status={booking.status} />}
              <Badge>{meta.record}</Badge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold">{order.offerTitle}</h1>
            <p className="text-sm text-ink-500">{[order.optionLabel, order.merchantName].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 text-xs text-ink-400">Order {order.id.slice(-12).toUpperCase()} · placed {formatDateTime(order.createdAt)} · member #{order.memberPosition}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" to={`/g/${order.groupId}`} icon={Users}>View group</Button>
            <Button variant="secondary" size="sm" icon={LifeBuoy} onClick={() => setModal('ticket')}>Get help</Button>
          </div>
        </div>
      </Card>

      {order.status === 'AWAITING_GROUP' && group && offer && (
        <Card className="p-5 sm:p-6">
          <p className="font-display text-lg font-bold">
            {group.paidCount}/{group.minGroupSize} joined — {Math.max(0, group.minGroupSize - group.paidCount)} more to unlock
          </p>
          <p className="mb-4 text-sm text-ink-500">Invite people who'd genuinely want this deal.</p>
          <ShareBar offer={offer} group={group} referralCode={profile?.referralCode} />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {(booking || order.kind === 'PRODUCT') && order.status !== 'AWAITING_GROUP' && (
            <Card className="p-5 sm:p-6">
              <p className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                {order.kind === 'PRODUCT' ? <Truck className="h-5 w-5 text-brand-500" /> : <QrCode className="h-5 w-5 text-brand-500" />}
                {order.kind === 'PRODUCT' ? 'Delivery & tracking' : `Your ${meta.record.toLowerCase()}`}
              </p>
              {order.kind === 'PRODUCT' && <ShipmentSection shipment={shipment} order={order} />}
              {booking?.kind === 'MEMBERSHIP' && <MembershipSection booking={booking} voucher={voucher} />}
              {booking?.kind === 'ENROLMENT' && <CourseSection booking={booking} />}
              {booking?.kind === 'PROJECT' && <ProjectSection booking={booking} />}
              {['APPOINTMENT', 'VOUCHER'].includes(booking?.kind) && <AppointmentSection booking={booking} />}
              {booking?.status === 'PROVIDER_CANCELLED' && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Cancelled by provider: {booking.cancelReason}. A full refund has been initiated.</p>}
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <p className="mb-4 font-display text-lg font-bold">Timeline</p>
            <ol className="relative space-y-4 border-l-2 border-ink-100 pl-5">
              {[...(order.timeline || [])].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4', i === 0 ? 'bg-brand-500 ring-brand-100' : 'bg-ink-300 ring-ink-100')} />
                  <p className="text-sm font-semibold">{e.status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</p>
                  {e.note && <p className="text-sm text-ink-500">{e.note}</p>}
                  <p className="text-[11px] text-ink-400">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5 sm:p-6 text-sm">
            <p className="mb-3 font-display text-lg font-bold">Terms you accepted</p>
            <p className="text-xs text-ink-400">Terms version {t.termsVersion} · offer v{t.offerVersion} · accepted {formatDateTime(t.acceptedAt)}</p>
            <div className="mt-3 space-y-2 text-ink-700">
              <p><b>Pricing:</b> {PRICING_RULES[t.pricingRule]?.description}</p>
              <p><b>Group failure:</b> {FAILURE_POLICIES[t.failurePolicy]?.description}</p>
              {t.activationRule && <p><b>Activation:</b> {ACTIVATION_RULES[t.activationRule]}</p>}
              {offer?.cancellationText && <p><b>Cancellation:</b> {offer.cancellationText}</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-2 font-display font-bold">Payment summary</p>
            <KeyValue label={`Price × ${order.quantity}`} value={formatINR(order.breakdown.subtotal, true)} />
            <KeyValue label={`GST ${order.breakdown.gstRate}%`} value={formatINR(order.breakdown.gst, true)} />
            {order.breakdown.deliveryFee > 0 && <KeyValue label="Delivery" value={formatINR(order.breakdown.deliveryFee)} />}
            {order.breakdown.visitFee > 0 && <KeyValue label="Visit fee" value={formatINR(order.breakdown.visitFee)} />}
            <KeyValue label="Platform fee" value={formatINR(order.breakdown.platformFee)} />
            <div className="my-2 border-t border-dashed border-ink-200" />
            <KeyValue label="Paid" value={<span className="font-display text-lg">{formatINR(order.amountPaid, true)}</span>} />
            {order.breakdown.savings > 0 && <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-center text-sm font-bold text-emerald-700">Saved {formatINR(order.breakdown.savings)}</p>}
            {order.priceDropRefund > 0 && <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-center text-sm font-bold text-emerald-700">+ {formatINR(order.priceDropRefund, true)} tier refund</p>}
          </Card>

          {order.kind === 'PRODUCT' && order.fulfilmentDetails?.address && (
            <Card className="p-5 text-sm">
              <p className="mb-2 font-display font-bold">Delivery address</p>
              <p className="text-ink-600">{order.fulfilmentDetails.address.name}<br />{order.fulfilmentDetails.address.line1}, {order.fulfilmentDetails.address.line2}<br />{order.fulfilmentDetails.address.city} {order.fulfilmentDetails.address.pincode}</p>
            </Card>
          )}

          <Card className="space-y-2 p-5">
            <p className="mb-1 font-display font-bold">Actions</p>
            {canReview && <Button variant="secondary" className="w-full" icon={Star} onClick={() => setModal('review')}>Write a review</Button>}
            {review && <p className="flex items-center gap-2 rounded-xl bg-ink-50 p-3 text-sm"><BadgeCheck className="h-4 w-4 text-emerald-600" /> You rated this {review.rating}/5</p>}
            {canReturn && <Button variant="secondary" className="w-full" icon={RotateCcw} onClick={() => setModal('return')}>Return / replace</Button>}
            {canCancel && <Button variant="ghost" className="w-full !text-rose-600 hover:!bg-rose-50" icon={XCircle} onClick={() => setModal('cancel')}>Cancel {order.kind === 'PRODUCT' ? 'order' : 'booking'}</Button>}
            {order.openCaseId && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Your request is being reviewed by the provider. We'll notify you.</p>}
            <Link to={`/deal/${order.offerId}`} className="flex items-center justify-center gap-1 pt-1 text-sm font-semibold text-brand-600 hover:underline">
              View deal page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>

      <Modal
        open={modal === 'cancel'}
        onClose={close}
        title="Cancel this purchase"
        footer={
          <>
            <Button variant="secondary" onClick={close}>Keep it</Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!reason.trim()}
              onClick={async () => {
                const r = await run(() => call('requestCancellation', { orderId, reason, reasonCode }));
                if (r) {
                  toast.success(r.instant ? `Cancelled — ${formatINR(r.refund.amount, true)} refund initiated` : 'Cancellation request sent to the provider');
                  close();
                }
              }}
            >
              Confirm cancellation
            </Button>
          </>
        }
      >
        {refundPreview && (
          <div className="mb-4 rounded-2xl bg-ink-50 p-4">
            <p className="text-sm text-ink-500">Estimated refund</p>
            <p className="font-display text-2xl font-extrabold">{formatINR(refundPreview.amount, true)}</p>
            <p className="mt-1 text-sm text-ink-600">{refundPreview.explanation}</p>
          </div>
        )}
        <Field label="Reason" required className="mb-3">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            <option value="CHANGED_MIND">Changed my mind</option>
            <option value="SCHEDULE">Schedule doesn't work</option>
            <option value="RELOCATING">Moving / relocating</option>
            <option value="FOUND_BETTER">Found a better option</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us a little more" aria-label="Details" />
        <p className="mt-3 text-xs text-ink-500">Cancelling never affects other group members' prices or bookings.</p>
      </Modal>

      <Modal
        open={modal === 'return'}
        onClose={close}
        title="Return or replace item"
        footer={
          <Button
            loading={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              const r = await run(() => call('requestReturn', { orderId, reason, reasonCode }), 'Return requested — reverse pickup will be arranged');
              if (r) close();
            }}
          >
            Submit request
          </Button>
        }
      >
        <Field label="Issue" className="mb-3">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            <option value="DEFECTIVE">Defective / not working</option>
            <option value="DAMAGED">Damaged in transit</option>
            <option value="WRONG_ITEM">Wrong item received</option>
            <option value="NOT_AS_DESCRIBED">Not as described</option>
          </Select>
        </Field>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the problem" aria-label="Description" />
      </Modal>

      <Modal
        open={modal === 'review'}
        onClose={close}
        title="Rate your experience"
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              const r = await run(() => call('addReview', { orderId, rating, comment }), 'Thanks for your review!');
              if (r) close();
            }}
          >
            Submit review
          </Button>
        }
      >
        <div className="flex justify-center py-2">
          <Stars value={rating} onChange={setRating} size="h-9 w-9" />
        </div>
        <Textarea className="mt-4" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you like? What could be better?" aria-label="Review" />
        <p className="mt-2 text-xs text-ink-500">Reviews are marked as verified purchases and shown with your first name only.</p>
      </Modal>

      <Modal
        open={modal === 'ticket'}
        onClose={close}
        title="Contact support"
        footer={
          <Button
            loading={busy}
            disabled={!ticket.subject || !ticket.message}
            onClick={async () => {
              const r = await run(() => call('createTicket', { ...ticket, orderId }));
              if (r) {
                toast.success(`Ticket ${r.ref} created`);
                close();
              }
            }}
          >
            Create ticket
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Topic">
            <Select value={ticket.category} onChange={(e) => setTicket((x) => ({ ...x, category: e.target.value }))}>
              {Object.entries(TICKET_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" required><Input value={ticket.subject} onChange={(e) => setTicket((x) => ({ ...x, subject: e.target.value }))} /></Field>
          <Field label="Message" required><Textarea value={ticket.message} onChange={(e) => setTicket((x) => ({ ...x, message: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
