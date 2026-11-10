import { AlertCircle, ArrowLeft, ImagePlus, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, categoryById } from '@shared/categories.js';
import { ACTIVATION_RULES, DEAL_FORMATS, FAILURE_POLICIES, FULFILMENT_META, PRICING_RULES, PROJECT_MILESTONES } from '@shared/constants.js';
import { validateOffer } from '@shared/operations.js';
import { TierLadder } from '@/components/deal.jsx';
import { Button, Card, Checkbox, Field, Input, PageHeader, PageLoader, Select, Textarea } from '@/components/ui.jsx';
import { useDoc } from '@/hooks/useData.js';
import { call, data, errorMessage } from '@/services/api.js';
import { useMerchantData } from './useMerchant.js';

const lines = (v) => (Array.isArray(v) ? v.join('\n') : v || '');

const BLANK = {
  title: '',
  summary: '',
  description: '',
  categoryId: 'gym-fitness',
  format: '',
  city: '',
  mrp: '',
  tiers: [{ minMembers: 1, price: '' }, { minMembers: 5, price: '' }, { minMembers: 10, price: '' }],
  minGroupSize: 5,
  maxGroupSize: 30,
  capacity: 50,
  maxPerCustomer: 1,
  groupDurationHours: 72,
  extensionHours: 72,
  pricingRule: 'ALL_MEMBERS',
  failurePolicy: 'AUTO_REFUND',
  inclusions: '',
  exclusions: '',
  eligibility: '',
  cancellationText: '',
  cancellation: { freeCancelHours: 48, lateCancelPct: 50, afterUsePct: 0 },
  options: [{ label: '', capacity: 50 }],
  activationRule: 'ON_FIRST_VISIT',
  facilities: '',
  operatingHours: '',
  blackoutDates: '',
  healthSafety: '',
  instructor: '',
  syllabus: '',
  language: '',
  prerequisites: '',
  platform: '',
  accessInstructions: '',
  accessDuration: '',
  certificatePolicy: '',
  lateJoinPolicy: '',
  serviceAreas: '',
  remoteSupported: false,
  scope: '',
  warranty: '',
  visitFee: 0,
  projectMilestones: PROJECT_MILESTONES.slice(0, 4).map((m) => m.key),
  deliveryEstimate: '',
  deliveryFee: '',
  returnWindowDays: 7,
  sessions: '',
  voucherValidityDays: 90,
  images: [],
  highlights: '',
};

function Section({ title, subtitle, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="font-display text-lg font-bold">{title}</p>
      {subtitle && <p className="mb-4 text-sm text-ink-500">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-4'}>{children}</div>
    </Card>
  );
}

export default function OfferEditor() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { merchant } = useMerchantData();
  const { data: existing, loading } = useDoc(offerId ? `offers/${offerId}` : null);
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  useEffect(() => {
    if (existing) {
      setF({
        ...BLANK,
        ...existing,
        inclusions: lines(existing.inclusions),
        exclusions: lines(existing.exclusions),
        facilities: lines(existing.facilities),
        syllabus: lines(existing.syllabus),
        serviceAreas: lines(existing.serviceAreas),
        highlights: lines(existing.highlights),
        endAt: existing.endAt ? existing.endAt.slice(0, 10) : '',
      });
    } else if (merchant && !offerId) {
      setF((x) => ({ ...x, categoryId: merchant.categoryIds?.[0] || x.categoryId, city: merchant.city }));
    }
  }, [existing, merchant, offerId]);

  const cat = categoryById(f.categoryId);
  const fulfilment = cat?.fulfilment;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const num = (v) => (v === '' ? '' : Number(v));

  const payload = useMemo(
    () => ({
      ...f,
      id: offerId,
      mrp: num(f.mrp),
      tiers: f.tiers.filter((t) => t.price !== '').map((t) => ({ minMembers: Number(t.minMembers), price: Number(t.price) })),
      minGroupSize: Number(f.minGroupSize),
      maxGroupSize: f.maxGroupSize ? Number(f.maxGroupSize) : null,
      capacity: Number(f.capacity),
      groupDurationHours: Number(f.groupDurationHours),
      options: f.options.map((o) => ({ ...o, capacity: Number(o.capacity), priceDelta: Number(o.priceDelta || 0), durationDays: o.durationDays ? Number(o.durationDays) : null, sessions: o.sessions ? Number(o.sessions) : null })),
      inclusions: f.inclusions.split('\n'),
      exclusions: f.exclusions.split('\n'),
      facilities: f.facilities.split('\n'),
      syllabus: f.syllabus.split('\n'),
      serviceAreas: f.serviceAreas.split(/[\n,\s]+/),
      highlights: f.highlights.split('\n'),
      endAt: f.endAt || null,
    }),
    [f, offerId],
  );

  const clientErrors = useMemo(() => {
    const p = { ...payload, fulfilment, inclusions: payload.inclusions.filter((x) => x.trim()), exclusions: payload.exclusions.filter((x) => x.trim()), syllabus: payload.syllabus.filter((x) => x.trim()), serviceAreas: payload.serviceAreas.filter(Boolean) };
    return validateOffer(p);
  }, [payload, fulfilment]);

  if (offerId && loading) return <PageLoader />;

  const save = async (submit) => {
    setBusy(true);
    try {
      const r = await call('saveOffer', payload);
      setServerErrors(r.errors || []);
      if (submit) {
        if (r.errors?.length) {
          toast.error('Please fix the highlighted issues before submitting.');
          if (!offerId) navigate(`/merchant/offers/${r.offerId}/edit`, { replace: true });
          return;
        }
        await call('submitOffer', { offerId: r.offerId });
        toast.success('Submitted for JodoDeal approval');
        navigate('/merchant/offers');
      } else {
        toast.success('Draft saved');
        if (!offerId) navigate(`/merchant/offers/${r.offerId}/edit`, { replace: true });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setTier = (i, k, v) => setF((x) => ({ ...x, tiers: x.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const setOpt = (i, k, v) => setF((x) => ({ ...x, options: x.options.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const previewTiers = payload.tiers.filter((t) => t.price > 0);

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await data.uploadFile(file, 'offer-images');
      setF((x) => ({ ...x, images: [...(x.images || []), url].slice(0, 6) }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      <Link to="/merchant/offers" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Offers</Link>
      <PageHeader title={offerId ? 'Edit offer' : 'Create a group offer'} subtitle={existing?.status === 'APPROVED' ? 'This offer is live. Saving changes sends it back for review; existing groups keep the terms members accepted.' : 'All fields are shown to customers before payment.'} />

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required>
            <Select value={f.categoryId} onChange={set('categoryId')}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Deal format">
            <Select value={f.format || cat?.format} onChange={set('format')}>
              {Object.entries(DEAL_FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Title" required className="sm:col-span-2"><Input value={f.title} onChange={set('title')} placeholder="e.g. 6-Month Gym Membership — Baner" /></Field>
          <Field label="Short summary" className="sm:col-span-2"><Input value={f.summary} onChange={set('summary')} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} rows={4} /></Field>
          <Field label="City / delivery area"><Input value={f.city} onChange={set('city')} /></Field>
          <Field label="Highlights" hint="One per line (max 6)"><Textarea value={f.highlights} onChange={set('highlights')} rows={2} /></Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Photos</p>
          <div className="flex flex-wrap gap-2">
            {(f.images || []).map((src, i) => (
              <div key={i} className="relative h-20 w-28 overflow-hidden rounded-xl ring-1 ring-ink-100">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setF((x) => ({ ...x, images: x.images.filter((_, j) => j !== i) }))} className="absolute right-1 top-1 rounded-md bg-white/90 p-1" aria-label="Remove image"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>
              </div>
            ))}
            <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-500 hover:border-brand-300">
              <ImagePlus className="h-5 w-5" /> Add photo
              <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
            </label>
          </div>
          <p className="mt-1 text-xs text-ink-400">Use real photos of your products, premises or past work. Don't promise facilities you haven't verified.</p>
        </div>
      </Section>

      <Section title="Group pricing" subtitle="Each tier unlocks when that many paid members join. Prices exclude GST.">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Field label="Standard price (₹)" required><Input inputMode="numeric" value={f.mrp} onChange={(e) => setF((x) => ({ ...x, mrp: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <div className="space-y-2">
              {f.tiers.map((t, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Field label={i === 0 ? 'Members ≥' : undefined} className="w-28"><Input inputMode="numeric" value={t.minMembers} onChange={(e) => setTier(i, 'minMembers', e.target.value.replace(/\D/g, ''))} /></Field>
                  <Field label={i === 0 ? 'Price per member (₹)' : undefined} className="flex-1"><Input inputMode="numeric" value={t.price} onChange={(e) => setTier(i, 'price', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                  <button type="button" className="mb-1 rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-500" onClick={() => setF((x) => ({ ...x, tiers: x.tiers.filter((_, j) => j !== i) }))} aria-label="Remove tier"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setF((x) => ({ ...x, tiers: [...x.tiers, { minMembers: (Number(x.tiers.at(-1)?.minMembers) || 0) + 5, price: '' }] }))}>Add tier</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Minimum group size" required hint="Target to confirm a group"><Input inputMode="numeric" value={f.minGroupSize} onChange={set('minGroupSize')} /></Field>
              <Field label="Max members per group"><Input inputMode="numeric" value={f.maxGroupSize || ''} onChange={set('maxGroupSize')} /></Field>
              <Field label="Group duration (hours)" required><Input inputMode="numeric" value={f.groupDurationHours} onChange={set('groupDurationHours')} /></Field>
              <Field label="Total capacity" required hint="Memberships / seats / stock"><Input inputMode="numeric" value={f.capacity} onChange={set('capacity')} /></Field>
              <Field label="Max per customer"><Input inputMode="numeric" value={f.maxPerCustomer} onChange={set('maxPerCustomer')} /></Field>
              <Field label="Campaign end date"><Input type="date" value={f.endAt || ''} onChange={set('endAt')} /></Field>
            </div>
            <Field label="Pricing rule" required>
              <Select value={f.pricingRule} onChange={set('pricingRule')}>
                {Object.entries(PRICING_RULES).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.short}</option>)}
              </Select>
            </Field>
            <Field label="If the group misses its target" required>
              <Select value={f.failurePolicy} onChange={set('failurePolicy')}>
                {Object.entries(FAILURE_POLICIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="rounded-2xl bg-ink-50 p-4">
            <p className="mb-3 text-sm font-bold">Customer preview</p>
            {f.mrp && previewTiers.length ? <TierLadder mrp={Number(f.mrp)} tiers={previewTiers} count={0} minGroupSize={Number(f.minGroupSize)} /> : <p className="text-sm text-ink-400">Add a standard price and tiers to preview.</p>}
            <p className="mt-3 text-xs text-ink-500">GST {cat?.gstRate}% and platform fee ₹{cat?.platformFee} are added transparently at checkout. Commission for this category: {cat?.commissionPct}%.</p>
          </div>
        </div>
      </Section>

      <Section title={`${FULFILMENT_META[fulfilment]?.optionLabel || 'Option'}s & capacity`} subtitle={fulfilment === 'COURSE' ? 'Add each cohort with its start date, schedule and seat capacity.' : fulfilment === 'MEMBERSHIP' ? 'Add each branch / plan with its validity and membership allocation.' : 'Add variants or packages with their own capacity.'}>
        <div className="space-y-3">
          {f.options.map((o, i) => (
            <div key={i} className="grid gap-3 rounded-2xl p-4 ring-1 ring-ink-100 sm:grid-cols-6">
              <Field label="Name" className="sm:col-span-3"><Input value={o.label} onChange={(e) => setOpt(i, 'label', e.target.value)} /></Field>
              <Field label="Capacity"><Input inputMode="numeric" value={o.capacity} onChange={(e) => setOpt(i, 'capacity', e.target.value.replace(/\D/g, ''))} /></Field>
              <Field label="Price +/- (₹)"><Input inputMode="numeric" value={o.priceDelta || ''} onChange={(e) => setOpt(i, 'priceDelta', e.target.value.replace(/[^\d.-]/g, ''))} /></Field>
              <div className="flex items-end justify-end">
                <button type="button" className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-500" onClick={() => setF((x) => ({ ...x, options: x.options.filter((_, j) => j !== i) }))} aria-label="Remove option"><Trash2 className="h-4 w-4" /></button>
              </div>
              {fulfilment === 'MEMBERSHIP' && (
                <>
                  <Field label="Validity (days)"><Input inputMode="numeric" value={o.durationDays || ''} onChange={(e) => setOpt(i, 'durationDays', e.target.value.replace(/\D/g, ''))} /></Field>
                  <Field label="Branch address" className="sm:col-span-5"><Input value={o.address || ''} onChange={(e) => setOpt(i, 'address', e.target.value)} /></Field>
                </>
              )}
              {fulfilment === 'COURSE' && (
                <>
                  <Field label="Start date" className="sm:col-span-2"><Input type="date" value={o.startDate || ''} onChange={(e) => setOpt(i, 'startDate', e.target.value)} /></Field>
                  <Field label="Schedule" className="sm:col-span-4"><Input value={o.schedule || ''} onChange={(e) => setOpt(i, 'schedule', e.target.value)} placeholder="Mon/Wed/Fri 8–9:30 PM IST" /></Field>
                </>
              )}
              {['APPOINTMENT', 'VOUCHER'].includes(fulfilment) && (
                <Field label="Sessions included" className="sm:col-span-2"><Input inputMode="numeric" value={o.sessions || ''} onChange={(e) => setOpt(i, 'sessions', e.target.value.replace(/\D/g, ''))} /></Field>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setF((x) => ({ ...x, options: [...x.options, { label: '', capacity: 10 }] }))}>Add {FULFILMENT_META[fulfilment]?.optionLabel.toLowerCase()}</Button>
        </div>
      </Section>

      {fulfilment === 'MEMBERSHIP' && (
        <Section title="Membership terms">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validity starts" required>
              <Select value={f.activationRule} onChange={set('activationRule')}>
                {Object.entries(ACTIVATION_RULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Access hours"><Input value={f.operatingHours} onChange={set('operatingHours')} /></Field>
            <Field label="Verified facilities" hint="One per line"><Textarea value={f.facilities} onChange={set('facilities')} /></Field>
            <Field label="Blackout dates"><Textarea value={f.blackoutDates} onChange={set('blackoutDates')} /></Field>
            <Field label="Health & safety rules" className="sm:col-span-2"><Textarea value={f.healthSafety} onChange={set('healthSafety')} /></Field>
          </div>
        </Section>
      )}

      {fulfilment === 'COURSE' && (
        <Section title="Course details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instructor profile" required className="sm:col-span-2"><Textarea value={f.instructor} onChange={set('instructor')} /></Field>
            <Field label="Syllabus / outcomes" hint="One per line" required className="sm:col-span-2"><Textarea value={f.syllabus} onChange={set('syllabus')} rows={4} /></Field>
            <Field label="Language"><Input value={f.language} onChange={set('language')} /></Field>
            <Field label="Platform"><Input value={f.platform} onChange={set('platform')} placeholder="Zoom, Google Meet, LMS…" /></Field>
            <Field label="Prerequisites"><Input value={f.prerequisites} onChange={set('prerequisites')} /></Field>
            <Field label="Recordings: access duration & device limits"><Input value={f.accessDuration} onChange={set('accessDuration')} /></Field>
            <Field label="Certificate policy"><Input value={f.certificatePolicy} onChange={set('certificatePolicy')} /></Field>
            <Field label="Late-join policy"><Input value={f.lateJoinPolicy} onChange={set('lateJoinPolicy')} /></Field>
            <Field label="Access instructions (shown after confirmation)" className="sm:col-span-2"><Textarea value={f.accessInstructions} onChange={set('accessInstructions')} /></Field>
          </div>
        </Section>
      )}

      {fulfilment === 'PROJECT' && (
        <Section title="Project scope & service area">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Package scope" required hint="Property type, room size range, deliverables, revisions, material grades" className="sm:col-span-2"><Textarea value={f.scope} onChange={set('scope')} rows={4} /></Field>
            <Field label="Serviceable PIN codes" hint="Comma/space separated. Prefixes like 4110 cover 4110xx."><Textarea value={f.serviceAreas} onChange={set('serviceAreas')} /></Field>
            <div className="space-y-4">
              <Field label="Visit / travel fee (₹)"><Input inputMode="numeric" value={f.visitFee} onChange={set('visitFee')} /></Field>
              <Checkbox checked={!!f.remoteSupported} onChange={set('remoteSupported')} label="Remote consultation supported" />
            </div>
            <Field label="Warranty / after-sales" className="sm:col-span-2"><Input value={f.warranty} onChange={set('warranty')} /></Field>
          </div>
          <p className="mb-2 mt-4 text-sm font-semibold">Milestones tracked for each customer</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROJECT_MILESTONES.map((m) => (
              <Checkbox key={m.key} checked={f.projectMilestones.includes(m.key)} onChange={(e) => setF((x) => ({ ...x, projectMilestones: e.target.checked ? [...x.projectMilestones, m.key] : x.projectMilestones.filter((k) => k !== m.key) }))} label={m.label} />
            ))}
          </div>
        </Section>
      )}

      {fulfilment === 'PRODUCT' && (
        <Section title="Delivery & returns">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Delivery estimate" required><Input value={f.deliveryEstimate} onChange={set('deliveryEstimate')} placeholder="4–7 days after confirmation" /></Field>
            <Field label="Delivery fee (₹)"><Input inputMode="numeric" value={f.deliveryFee} onChange={set('deliveryFee')} placeholder={String(cat?.deliveryFee ?? 0)} /></Field>
            <Field label="Return window (days)"><Input inputMode="numeric" value={f.returnWindowDays} onChange={set('returnWindowDays')} /></Field>
          </div>
        </Section>
      )}

      {['APPOINTMENT', 'VOUCHER'].includes(fulfilment) && (
        <Section title="Redemption">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voucher validity (days)"><Input inputMode="numeric" value={f.voucherValidityDays} onChange={set('voucherValidityDays')} /></Field>
            <Field label="Operating hours"><Input value={f.operatingHours} onChange={set('operatingHours')} /></Field>
          </div>
        </Section>
      )}

      <Section title="Inclusions, exclusions & terms" subtitle="Plain language. Customers must see all final charges, exclusions and cancellation terms before payment.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What's included" hint="One per line" required><Textarea value={f.inclusions} onChange={set('inclusions')} rows={4} /></Field>
          <Field label="Not included" hint="One per line" required><Textarea value={f.exclusions} onChange={set('exclusions')} rows={4} /></Field>
          <Field label="Eligibility" className="sm:col-span-2"><Input value={f.eligibility} onChange={set('eligibility')} /></Field>
          <Field label="Cancellation & refund terms" required className="sm:col-span-2"><Textarea value={f.cancellationText} onChange={set('cancellationText')} /></Field>
          <Field label="Free cancellation window (hours after confirmation)"><Input inputMode="numeric" value={f.cancellation.freeCancelHours} onChange={(e) => setF((x) => ({ ...x, cancellation: { ...x.cancellation, freeCancelHours: Number(e.target.value) } }))} /></Field>
          <Field label="Refund % after free window"><Input inputMode="numeric" value={f.cancellation.lateCancelPct} onChange={(e) => setF((x) => ({ ...x, cancellation: { ...x.cancellation, lateCancelPct: Number(e.target.value) } }))} /></Field>
        </div>
      </Section>

      {(clientErrors.length > 0 || serverErrors.length > 0) && (
        <Card className="bg-amber-50 p-5 ring-amber-200">
          <p className="flex items-center gap-2 font-bold text-amber-900"><AlertCircle className="h-5 w-5" /> Before submitting</p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-amber-900">
            {[...new Set([...clientErrors, ...serverErrors])].map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Card>
      )}

      <div className="sticky bottom-16 z-20 flex justify-end gap-2 rounded-2xl bg-white/90 p-3 shadow-lift ring-1 ring-ink-100 backdrop-blur md:bottom-4">
        <Button variant="secondary" icon={Save} loading={busy} onClick={() => save(false)}>Save draft</Button>
        <Button icon={Send} loading={busy} disabled={merchant?.status !== 'VERIFIED'} onClick={() => save(true)} title={merchant?.status !== 'VERIFIED' ? 'Your business must be verified first' : undefined}>Submit for approval</Button>
      </div>
    </div>
  );
}
