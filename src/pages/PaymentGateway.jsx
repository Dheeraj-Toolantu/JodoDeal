import { Building2, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Smartphone, Timer, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, Input, PageLoader } from '@/components/ui.jsx';
import { useDoc, useNow } from '@/hooks/useData.js';
import { cx, formatINR, timeLeft } from '@/lib/format.js';
import { isDemoMode } from '@/lib/firebase.js';
import { call, errorMessage } from '@/services/api.js';

const METHODS = [
  { id: 'UPI', label: 'UPI', icon: Smartphone, hint: 'GPay, PhonePe, Paytm, BHIM' },
  { id: 'CARD', label: 'Card', icon: CreditCard, hint: 'Credit / debit card' },
  { id: 'NETBANKING', label: 'Netbanking', icon: Building2, hint: 'All major banks' },
];

/**
 * Simulated payment gateway (demo + emulator). In production this step is replaced by the
 * approved Indian payment gateway's checkout; the gateway then calls the signed webhook.
 */
export default function PaymentGateway() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { data: payment, loading } = useDoc(`payments/${paymentId}`);
  const [method, setMethod] = useState('UPI');
  const [upi, setUpi] = useState('priya@okaxis');
  const [busy, setBusy] = useState(null);
  const now = useNow(1000);

  useEffect(() => {
    if (payment?.status === 'SUCCEEDED' && payment.orderId && !busy) navigate(`/account/orders/${payment.orderId}`, { replace: true });
  }, [payment, busy, navigate]);

  if (loading) return <PageLoader />;
  if (!payment) return <div className="container-page py-16"><EmptyState icon={XCircle} title="Payment not found" action={<Button to="/deals">Explore deals</Button>} /></div>;

  const t = timeLeft(payment.expiresAt, now);
  const closed = payment.status !== 'CREATED' || t.expired;

  const pay = async (outcome) => {
    setBusy(outcome);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const res = await call('confirmMockPayment', { paymentId, outcome, method });
      if (res.status === 'SUCCEEDED') {
        toast.success(res.groupConfirmed ? 'Payment successful — group confirmed! 🎉' : 'Payment successful — you joined the group! 🎉');
        navigate(`/account/orders/${res.orderId}?welcome=1`, { replace: true });
      } else if (res.status === 'REFUND') {
        toast.error('Payment received but you could not be added — a full refund has been initiated.');
        navigate('/account/refunds', { replace: true });
      } else {
        toast.error('Payment failed. No money was taken.');
        navigate(`/g/${payment.groupId}`, { replace: true });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    await call('cancelPendingPayment', { paymentId }).catch(() => {});
    navigate(`/g/${payment.groupId}`, { replace: true });
  };

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-ink-50 to-white py-10">
      <div className="mx-auto max-w-md px-4">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-ink-600">
            <Lock className="h-4 w-4 text-emerald-600" /> Secure checkout
          </span>
          {isDemoMode && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">Test gateway — no real money</span>}
        </div>
        <Card className="overflow-hidden">
          <div className="bg-ink-gradient p-6 text-white">
            <p className="text-sm text-ink-200">Paying JodoDeal for</p>
            <p className="mt-0.5 font-semibold">{payment.offerTitle}</p>
            {payment.optionLabel && <p className="text-sm text-ink-300">{payment.optionLabel}</p>}
            <p className="mt-4 font-display text-4xl font-extrabold">{formatINR(payment.amount, true)}</p>
            <p className={cx('mt-2 flex items-center gap-1.5 text-sm', t.urgent ? 'text-amber-300' : 'text-ink-300')}>
              <Timer className="h-4 w-4" /> {closed ? 'This payment session has ended' : `Spot reserved · ${t.m}m ${String(t.s).padStart(2, '0')}s left`}
            </p>
          </div>
          {closed ? (
            <div className="p-6 text-center">
              <p className="font-semibold">This payment is {payment.status === 'CREATED' ? 'expired' : payment.status.toLowerCase()}.</p>
              <Button className="mt-4" to={`/g/${payment.groupId}`}>Back to group</Button>
            </div>
          ) : (
            <div className="p-6">
              <p className="mb-3 text-sm font-bold">Choose a payment method</p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button key={m.id} onClick={() => setMethod(m.id)} className={cx('rounded-xl p-3 text-center ring-2 transition', method === m.id ? 'bg-brand-50 ring-brand-500' : 'ring-ink-100 hover:ring-ink-200')}>
                    <m.icon className="mx-auto h-6 w-6 text-ink-700" />
                    <span className="mt-1 block text-xs font-bold">{m.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-400">{METHODS.find((m) => m.id === method).hint}</p>
              {method === 'UPI' && <Input className="mt-4" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@upi" aria-label="UPI ID" />}
              {method === 'CARD' && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Input className="col-span-2" defaultValue="4111 1111 1111 1111" aria-label="Card number" />
                  <Input defaultValue="12/29" aria-label="Expiry" />
                  <Input defaultValue="123" aria-label="CVV" />
                </div>
              )}
              {method === 'NETBANKING' && (
                <select className="mt-4 w-full rounded-xl border-0 py-2.5 ring-1 ring-ink-200" aria-label="Bank">
                  {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'].map((b) => <option key={b}>{b}</option>)}
                </select>
              )}
              <Button size="lg" className="mt-5 w-full" onClick={() => pay('SUCCESS')} loading={busy === 'SUCCESS'} disabled={!!busy}>
                Pay {formatINR(payment.amount, true)}
              </Button>
              <div className="mt-3 flex items-center justify-between text-xs">
                <button onClick={cancel} disabled={!!busy} className="font-semibold text-ink-500 hover:text-ink-900">Cancel & release spot</button>
                {isDemoMode && (
                  <button onClick={() => pay('FAILED')} disabled={!!busy} className="font-semibold text-rose-500 hover:text-rose-700">
                    {busy === 'FAILED' ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Simulate failure
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
        <div className="mt-5 space-y-2 text-xs text-ink-500">
          <p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Only successful, verified payments count toward the group. Duplicate payment events are ignored automatically.</p>
          <p className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> If the group doesn't reach its target, you are refunded to this same payment method.</p>
        </div>
      </div>
    </div>
  );
}
