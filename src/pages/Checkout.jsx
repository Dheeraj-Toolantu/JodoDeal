import { ArrowLeft, CheckCircle2, ClipboardList, Home, Lock, MapPin, ShieldCheck, Timer, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACTIVATION_RULES, FAILURE_POLICIES, FULFILMENT_META, PRICING_RULES, RESERVATION_MINUTES, TERMS_VERSION } from '@shared/constants.js';
import { joinBlocker, joinUnitPrice, optionAvailability, priceBreakdown } from '@shared/pricing.js';
import { CategoryArt, GroupStateBadge } from '@/components/deal.jsx';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, KeyValue, PageLoader, Select, Textarea } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useDoc } from '@/hooks/useData.js';
import { cx, formatDate, formatINR, uuid } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

function StepTitle({ n, title, done }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={cx('flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold', done ? 'bg-emerald-500 text-white' : 'bg-ink-900 text-white')}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
      <h2 className="font-display text-lg font-bold">{title}</h2>
    </div>
  );
}

export default function Checkout() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: group, loading } = useDoc(`groups/${groupId}`);
  const { data: offer } = useDoc(group ? `offers/${group.offerId}` : null);
  const [optionId, setOptionId] = useState(null);
  const [qty, setQty] = useState(1);
  const [addrId, setAddrId] = useState(() => profile?.addresses?.find((a) => a.kind !== 'SERVICE')?.id || profile?.addresses?.[0]?.id || 'new');
  const [address, setAddress] = useState({ name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '' });
  const [project, setProject] = useState({ pincode: '', propertyType: 'Apartment', rooms: '2BHK', notes: '', preferredDate: '' });
  const [pref, setPref] = useState({ preferredDate: '', notes: '' });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idemKey] = useState(() => uuid());

  const savedAddresses = profile?.addresses || [];
  // Pre-select the customer's saved address once the profile arrives.
  useEffect(() => {
    if (addrId === 'new' && savedAddresses.length && !address.line1) setAddrId(savedAddresses[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses.length]);
  const effectiveOption = optionId || (offer?.options?.length === 1 ? offer.options[0].id : null);
  const unit = offer && group ? joinUnitPrice(offer, group, effectiveOption) : 0;
  const breakdown = useMemo(() => (offer ? priceBreakdown(offer, unit, qty) : null), [offer, unit, qty]);
  const rawBlocker = offer && group ? joinBlocker({ offer, group, optionId: effectiveOption }) : null;
  // Not having picked an option yet is a normal step, not an error — the hint by the Pay button covers it.
  const blocker = rawBlocker === 'Please select an option.' ? null : rawBlocker;

  const detailsIssue = (() => {
    if (!offer) return null;
    if (offer.fulfilment === 'PRODUCT') {
      const a = addrId !== 'new' ? savedAddresses.find((x) => x.id === addrId) : address;
      if (!a || !a.name || !a.line1 || !a.city || !a.phone) return 'Add your delivery address (name, address, city and mobile) to continue.';
      if (!/^\d{6}$/.test(String(a.pincode || ''))) return 'Enter a valid 6-digit PIN code for delivery.';
    }
    if (offer.fulfilment === 'PROJECT' && !/^\d{6}$/.test(project.pincode)) return 'Enter the 6-digit PIN code of your project site.';
    return null;
  })();

  if (loading || (group && !offer)) return <PageLoader />;
  if (!group || !offer) return <div className="container-page py-16"><EmptyState icon={XCircle} title="Group not found" action={<Button to="/deals">Explore deals</Button>} /></div>;

  const meta = FULFILMENT_META[offer.fulfilment];
  const fulfilmentDetails = () => {
    if (offer.fulfilment === 'PRODUCT') {
      const a = addrId !== 'new' ? savedAddresses.find((x) => x.id === addrId) : address;
      return { address: a };
    }
    if (offer.fulfilment === 'PROJECT') return project;
    return pref;
  };

  const submit = async () => {
    if (!accepted) return toast.error('Please accept the offer terms to continue.');
    setSubmitting(true);
    try {
      let referralCode = null;
      try {
        referralCode = sessionStorage.getItem(`jd-ref-${groupId}`);
      } catch {
        /* ignore */
      }
      const { paymentId } = await call('startCheckout', {
        groupId,
        optionId: effectiveOption,
        quantity: qty,
        fulfilmentDetails: fulfilmentDetails(),
        acceptedTerms: true,
        acceptedTermsVersion: TERMS_VERSION,
        idempotencyKey: idemKey,
        referralCode,
      });
      navigate(`/pay/${paymentId}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const setA = (k) => (e) => setAddress((a) => ({ ...a, [k]: e.target.value }));
  const setP = (k) => (e) => setProject((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="container-page max-w-6xl py-8">
      <Link to={`/deal/${offer.id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to deal
      </Link>
      <h1 className="mb-6 font-display text-3xl font-extrabold">Join the group</h1>

      {blocker && <div className="mb-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">{blocker}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <StepTitle n={1} title={`Choose your ${meta.optionLabel.toLowerCase()}`} done={!!effectiveOption} />
            <div className="grid gap-3 sm:grid-cols-2">
              {offer.options.map((o) => {
                const left = optionAvailability(o);
                const active = effectiveOption === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={left <= 0}
                    onClick={() => setOptionId(o.id)}
                    className={cx('rounded-2xl p-4 text-left ring-2 transition disabled:opacity-50', active ? 'bg-brand-50 ring-brand-500' : 'ring-ink-100 hover:ring-ink-200')}
                  >
                    <p className="font-semibold">{o.label}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {o.startDate && <Badge tone="violet">Starts {formatDate(o.startDate)}</Badge>}
                      {o.schedule && <Badge tone="blue">{o.schedule}</Badge>}
                      {o.durationDays && <Badge>{o.durationDays} days</Badge>}
                      {o.priceDelta ? <Badge tone="amber">+{formatINR(o.priceDelta)}</Badge> : null}
                      <Badge tone={left > 5 ? 'emerald' : left > 0 ? 'amber' : 'rose'}>{left > 0 ? `${left} left` : 'Sold out'}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
            {(offer.maxPerCustomer || 1) > 1 && (
              <Field label="Quantity" className="mt-4 max-w-[160px]">
                <Select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                  {Array.from({ length: offer.maxPerCustomer }).map((_, i) => (
                    <option key={i} value={i + 1}>{i + 1}</option>
                  ))}
                </Select>
              </Field>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <StepTitle n={2} title={offer.fulfilment === 'PRODUCT' ? 'Delivery address' : offer.fulfilment === 'PROJECT' ? 'Project details' : 'Your preferences'} />
            {offer.fulfilment === 'PRODUCT' && (
              <div className="space-y-4">
                {savedAddresses.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedAddresses.map((a) => (
                      <button key={a.id} type="button" onClick={() => setAddrId(a.id)} className={cx('rounded-2xl p-4 text-left text-sm ring-2', addrId === a.id ? 'bg-brand-50 ring-brand-500' : 'ring-ink-100')}>
                        <p className="flex items-center gap-1.5 font-semibold">
                          <Home className="h-4 w-4" /> {a.label}
                        </p>
                        <p className="mt-1 text-ink-600">{a.name}, {a.line1}, {a.line2 && `${a.line2}, `}{a.city} {a.pincode}</p>
                      </button>
                    ))}
                    <button type="button" onClick={() => setAddrId('new')} className={cx('rounded-2xl p-4 text-left text-sm font-semibold ring-2', addrId === 'new' ? 'bg-brand-50 ring-brand-500' : 'ring-ink-100')}>
                      + Use a new address
                    </button>
                  </div>
                )}
                {addrId === 'new' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Full name" required><Input value={address.name} onChange={setA('name')} autoComplete="name" /></Field>
                    <Field label="Mobile number" required><Input value={address.phone} onChange={setA('phone')} inputMode="tel" autoComplete="tel" /></Field>
                    <Field label="House / flat, street" required className="sm:col-span-2"><Input value={address.line1} onChange={setA('line1')} autoComplete="address-line1" /></Field>
                    <Field label="Area / landmark" className="sm:col-span-2"><Input value={address.line2} onChange={setA('line2')} autoComplete="address-line2" /></Field>
                    <Field label="City" required><Input value={address.city} onChange={setA('city')} autoComplete="address-level2" /></Field>
                    <Field label="State"><Input value={address.state} onChange={setA('state')} autoComplete="address-level1" /></Field>
                    <Field label="PIN code" required><Input value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" autoComplete="postal-code" /></Field>
                  </div>
                )}
                <p className="text-xs text-ink-400">
                  <Lock className="mr-1 inline h-3 w-3" /> Your address is shared only with the merchant for delivery — never with other group members.
                </p>
              </div>
            )}
            {offer.fulfilment === 'PROJECT' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Site PIN code" required hint="We'll check it is within the provider's service area.">
                  <Input icon={MapPin} value={project.pincode} onChange={(e) => setProject((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" />
                </Field>
                <Field label="Property type">
                  <Select value={project.propertyType} onChange={setP('propertyType')}>
                    {['Apartment', 'Independent house', 'Villa', 'Office'].map((x) => <option key={x}>{x}</option>)}
                  </Select>
                </Field>
                <Field label="Size">
                  <Select value={project.rooms} onChange={setP('rooms')}>
                    {['1BHK', '2BHK', '3BHK', '4BHK+', 'Single room'].map((x) => <option key={x}>{x}</option>)}
                  </Select>
                </Field>
                <Field label="Preferred visit date">
                  <Input type="date" value={project.preferredDate} onChange={setP('preferredDate')} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Anything we should know?" className="sm:col-span-2">
                  <Textarea value={project.notes} onChange={setP('notes')} placeholder="e.g. Need storage ideas for kids' room" />
                </Field>
              </div>
            )}
            {['MEMBERSHIP', 'COURSE', 'APPOINTMENT', 'VOUCHER'].includes(offer.fulfilment) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {offer.fulfilment !== 'COURSE' && (
                  <Field label={offer.fulfilment === 'MEMBERSHIP' ? 'Planned start date (optional)' : 'Preferred first slot (optional)'}>
                    <Input type="date" value={pref.preferredDate} onChange={(e) => setPref((p) => ({ ...p, preferredDate: e.target.value }))} min={new Date().toISOString().slice(0, 10)} />
                  </Field>
                )}
                <Field label="Note for the provider (optional)" className={offer.fulfilment === 'COURSE' ? 'sm:col-span-2' : ''}>
                  <Input value={pref.notes} onChange={(e) => setPref((p) => ({ ...p, notes: e.target.value }))} placeholder={offer.fulfilment === 'COURSE' ? 'Your experience level' : 'Any preferences'} />
                </Field>
                {offer.fulfilment === 'MEMBERSHIP' && <p className="text-sm text-ink-600 sm:col-span-2"><b>Activation:</b> {ACTIVATION_RULES[offer.activationRule]}.</p>}
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <StepTitle n={3} title="Review terms" done={accepted} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-bold">Included</p>
                <ul className="space-y-1.5 text-sm text-ink-700">
                  {offer.inclusions.map((i) => (
                    <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{i}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold">Not included</p>
                <ul className="space-y-1.5 text-sm text-ink-700">
                  {offer.exclusions.map((i) => (
                    <li key={i} className="flex gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />{i}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 space-y-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-700">
              <p><b>Pricing rule — {PRICING_RULES[group.pricingRule].label}:</b> {PRICING_RULES[group.pricingRule].description}</p>
              <p><b>If the group misses its target:</b> {FAILURE_POLICIES[group.failurePolicy].description}</p>
              <p><b>Cancellation:</b> {offer.cancellationText}</p>
            </div>
            <Checkbox
              className="mt-4"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              label={<>I have read and accept the offer terms, inclusions/exclusions and cancellation policy (terms version {TERMS_VERSION}), and JodoDeal's <Link className="font-semibold text-brand-600 underline" to="/policies/terms" target="_blank">Terms of use</Link>.</>}
            />
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="flex gap-3 border-b border-ink-100 p-4">
              <CategoryArt categoryId={offer.categoryId} image={offer.images?.[0]} className="h-16 w-16 shrink-0 rounded-xl" iconClass="h-6 w-6" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold">{offer.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                  <GroupStateBadge state={group.state} /> {group.paidCount}/{group.minGroupSize} joined
                </div>
              </div>
            </div>
            {breakdown && (
              <div className="p-5">
                <p className="mb-2 text-sm font-semibold text-ink-500">You will be member #{(group.paidCount || 0) + 1}</p>
                <KeyValue label={`Group price × ${breakdown.quantity}`} value={formatINR(breakdown.subtotal, true)} />
                <KeyValue label={`GST (${breakdown.gstRate}%)`} value={formatINR(breakdown.gst, true)} />
                {breakdown.deliveryFee > 0 && <KeyValue label="Delivery" value={formatINR(breakdown.deliveryFee)} />}
                {offer.fulfilment === 'PRODUCT' && breakdown.deliveryFee === 0 && <KeyValue label="Delivery" value={<span className="text-emerald-600">Free</span>} />}
                {breakdown.visitFee > 0 && <KeyValue label="Visit fee" value={formatINR(breakdown.visitFee)} />}
                <KeyValue label="Platform fee" value={formatINR(breakdown.platformFee)} />
                <div className="my-3 border-t border-dashed border-ink-200" />
                <div className="flex items-end justify-between">
                  <span className="font-bold">Total payable</span>
                  <span className="font-display text-2xl font-extrabold">{formatINR(breakdown.total, true)}</span>
                </div>
                {breakdown.savings > 0 && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-700">You save {formatINR(breakdown.savings)} vs standard price</p>}
                {(!effectiveOption || detailsIssue || !accepted) && !blocker && (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" role="status">
                    {!effectiveOption ? `Choose your ${meta.optionLabel.toLowerCase()} above to continue.` : detailsIssue || 'Tick the box to accept the offer terms.'}
                  </p>
                )}
                <Button size="lg" className="mt-4 w-full" onClick={submit} loading={submitting} disabled={!!blocker || !effectiveOption || !accepted || !!detailsIssue} icon={Lock}>
                  Proceed to pay
                </Button>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-500">
                  <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your {offer.fulfilment === 'COURSE' ? 'seat' : 'spot'} is reserved for {RESERVATION_MINUTES} minutes while you pay.
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No hidden charges. This is the final amount.
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-500">
                  <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" /> You'll get your own {meta.record.toLowerCase()} — separate from other members.
                </p>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
