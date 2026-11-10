/**
 * Merchant / provider portal operations — BRD §6, §7.3–7.5.
 */
import { categoryById } from '../categories.js';
import { ACTIVATION_RULES, FAILURE_POLICIES, MERCHANT_STATUS, OFFER_STATUS, PRICING_RULES, PROJECT_MILESTONES, ROLES } from '../constants.js';
import { randomCode, round2, sortTiers } from '../pricing.js';
import {
  adjustOfferCounters,
  audit,
  fail,
  loadActor,
  notify,
  nowISO,
  refundWrite,
  requireMerchant,
  requireOwnerMerchantOrStaff,
  sanitizeText,
  timelineEntry,
} from './core.js';

const list = (arr, max = 20, len = 200) => (Array.isArray(arr) ? arr : String(arr || '').split('\n')).map((s) => sanitizeText(s, len)).filter(Boolean).slice(0, max);

export async function registerMerchant(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  const name = sanitizeText(data.businessName, 100);
  if (!name) fail('invalid-argument', 'Business name is required.');
  if (!data.categoryIds?.length) fail('invalid-argument', 'Select at least one category.');
  if (!data.city) fail('invalid-argument', 'City is required.');
  if (data.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(String(data.gstin).toUpperCase())) fail('invalid-argument', 'GSTIN looks invalid (15 characters).');
  if (data.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(data.pan).toUpperCase())) fail('invalid-argument', 'PAN looks invalid.');
  if (!data.acceptAgreement) fail('failed-precondition', 'Please accept the merchant agreement.');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    if (user.merchantId) fail('already-exists', 'You already have a merchant account.');
    const id = store.newId('mer');
    tx.set(`merchants/${id}`, {
      id,
      name,
      tagline: sanitizeText(data.tagline, 120),
      description: sanitizeText(data.description, 1500),
      businessType: sanitizeText(data.businessType, 40) || 'Proprietorship',
      categoryIds: data.categoryIds.filter((c) => categoryById(c)).slice(0, 6),
      city: sanitizeText(data.city, 40),
      address: sanitizeText(data.address, 300),
      serviceAreas: list(data.serviceAreas, 50, 6),
      contactEmail: sanitizeText(data.contactEmail || user.email, 120),
      supportPhone: sanitizeText(data.supportPhone || user.phone, 15),
      status: MERCHANT_STATUS.PENDING_VERIFICATION,
      verified: false,
      rating: 0,
      ratingCount: 0,
      ownerUid: ctx.uid,
      createdAt: nowISO(now),
    });
    tx.set(`merchantPrivate/${id}`, {
      id,
      ownerUid: ctx.uid,
      legalName: sanitizeText(data.legalName || name, 120),
      gstin: data.gstin ? String(data.gstin).toUpperCase() : null,
      pan: data.pan ? String(data.pan).toUpperCase() : null,
      bank: {
        accountName: sanitizeText(data.bankAccountName, 100),
        accountLast4: sanitizeText(String(data.bankAccountNumber || '').slice(-4), 4),
        ifsc: sanitizeText(data.ifsc, 11).toUpperCase(),
      },
      documents: (data.documents || []).slice(0, 10).map((d) => ({ name: sanitizeText(d.name, 120), url: sanitizeText(d.url, 500), type: sanitizeText(d.type, 40) })),
      agreementAcceptedAt: nowISO(now),
    });
    tx.update(`users/${ctx.uid}`, { role: ROLES.MERCHANT, merchantId: id });
    audit(tx, store, { actor: user, action: 'MERCHANT_REGISTERED', entity: 'merchant', entityId: id, note: name, now });
    return { merchantId: id };
  });
}

export async function updateMerchantProfile(ctx, data, store) {
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const merchantId = requireMerchant(user);
    const patch = {};
    for (const [k, max] of [['tagline', 120], ['description', 1500], ['address', 300], ['supportPhone', 15], ['contactEmail', 120]]) {
      if (data[k] !== undefined) patch[k] = sanitizeText(data[k], max);
    }
    if (data.serviceAreas !== undefined) patch.serviceAreas = list(data.serviceAreas, 50, 6);
    tx.update(`merchants/${merchantId}`, patch);
    return { ok: true };
  });
}

/** Validates an offer against BRD rules: transparent pricing, scope, capacity and terms. */
export function validateOffer(o) {
  const errors = [];
  const cat = categoryById(o.categoryId);
  if (!o.title || o.title.length < 8) errors.push('Title must be at least 8 characters.');
  if (!cat) errors.push('Choose a valid category.');
  if (/starting\s+(from|at)/i.test(`${o.title} ${o.summary} ${o.description}`)) errors.push('Avoid open-ended "starting from" pricing — state the exact package price (BRD §6.3).');
  if (!(o.mrp > 0)) errors.push('Standard price must be greater than 0.');
  const tiers = sortTiers(o.tiers || []);
  if (!tiers.length) errors.push('Add at least one group price tier.');
  tiers.forEach((t, i) => {
    if (!(t.minMembers >= 1)) errors.push(`Tier ${i + 1}: members must be at least 1.`);
    if (!(t.price > 0) || t.price >= o.mrp) errors.push(`Tier ${i + 1}: price must be positive and lower than the standard price.`);
    if (i > 0 && t.price >= tiers[i - 1].price) errors.push(`Tier ${i + 1}: each higher tier must be cheaper than the previous one.`);
    if (i > 0 && t.minMembers === tiers[i - 1].minMembers) errors.push('Two tiers cannot have the same member count.');
  });
  if (!(o.minGroupSize >= 2)) errors.push('Minimum group size must be at least 2.');
  if (o.maxGroupSize && o.maxGroupSize < o.minGroupSize) errors.push('Maximum group size must be ≥ minimum group size.');
  if (!(o.capacity >= o.minGroupSize)) errors.push('Total capacity must be at least the minimum group size.');
  if (!(o.groupDurationHours >= 6 && o.groupDurationHours <= 720)) errors.push('Group duration must be between 6 hours and 30 days.');
  if (!PRICING_RULES[o.pricingRule]) errors.push('Choose a pricing rule.');
  if (!FAILURE_POLICIES[o.failurePolicy]) errors.push('Choose what happens if the group fails.');
  if (!o.inclusions?.length) errors.push('List what is included.');
  if (!o.exclusions?.length) errors.push('List exclusions (write "None" if there are none).');
  if (!o.cancellationText) errors.push('Describe cancellation / refund terms in plain language.');
  if (!o.options?.length) errors.push(`Add at least one ${o.fulfilment === 'COURSE' ? 'cohort' : o.fulfilment === 'MEMBERSHIP' ? 'branch/plan' : 'option'}.`);
  (o.options || []).forEach((op, i) => {
    if (!op.label) errors.push(`Option ${i + 1} needs a name.`);
    if (!(op.capacity >= 1)) errors.push(`Option ${i + 1} needs a capacity (memberships / seats / stock).`);
  });
  const optionCap = (o.options || []).reduce((s, op) => s + (Number(op.capacity) || 0), 0);
  if (optionCap && optionCap < o.capacity) errors.push('Total capacity cannot exceed the sum of option capacities.');
  if (o.fulfilment === 'MEMBERSHIP') {
    if (!ACTIVATION_RULES[o.activationRule]) errors.push('Choose when membership validity starts.');
    if ((o.options || []).some((op) => !(op.durationDays > 0))) errors.push('Each membership plan needs a validity (days).');
  }
  if (o.fulfilment === 'COURSE') {
    if ((o.options || []).some((op) => !op.startDate)) errors.push('Each cohort needs a start date.');
    if (!o.instructor) errors.push('Add the instructor profile.');
    if (!o.syllabus?.length) errors.push('Add the syllabus / learning outcomes.');
  }
  if (o.fulfilment === 'PROJECT') {
    if (!o.remoteSupported && !o.serviceAreas?.length) errors.push('Add serviceable PIN codes (or enable remote consultation).');
    if (!o.scope) errors.push('Define the package scope (property type, rooms, deliverables, revisions).');
  }
  if (o.fulfilment === 'PRODUCT' && !o.deliveryEstimate) errors.push('Add a delivery estimate.');
  return errors;
}

function normalizeOffer(data, merchant, existing) {
  const cat = categoryById(data.categoryId) || {};
  const fulfilment = cat.fulfilment || data.fulfilment;
  const num = (v, d = 0) => (v === '' || v === undefined || v === null ? d : Number(v));
  return {
    title: sanitizeText(data.title, 120),
    summary: sanitizeText(data.summary, 240),
    description: sanitizeText(data.description, 4000),
    categoryId: data.categoryId,
    fulfilment,
    format: data.format || cat.format,
    city: sanitizeText(data.city || merchant.city, 40),
    pincodes: list(data.pincodes, 50, 6),
    address: sanitizeText(data.address || merchant.address, 300),
    mrp: round2(num(data.mrp)),
    tiers: sortTiers((data.tiers || []).map((t) => ({ minMembers: Math.round(num(t.minMembers)), price: round2(num(t.price)) }))),
    minGroupSize: Math.round(num(data.minGroupSize, 2)),
    maxGroupSize: data.maxGroupSize ? Math.round(num(data.maxGroupSize)) : null,
    capacity: Math.round(num(data.capacity)),
    maxPerCustomer: Math.max(1, Math.round(num(data.maxPerCustomer, 1))),
    onePerCustomer: data.onePerCustomer !== false,
    groupDurationHours: Math.round(num(data.groupDurationHours, 72)),
    extensionHours: Math.round(num(data.extensionHours, 72)),
    endAt: data.endAt ? new Date(data.endAt).toISOString() : null,
    pricingRule: data.pricingRule || 'ALL_MEMBERS',
    failurePolicy: data.failurePolicy || 'AUTO_REFUND',
    gstRate: num(data.gstRate, cat.gstRate ?? 18),
    platformFee: cat.platformFee ?? 0,
    deliveryFee: fulfilment === 'PRODUCT' ? num(data.deliveryFee, cat.deliveryFee ?? 0) : 0,
    visitFee: fulfilment === 'PROJECT' ? num(data.visitFee, 0) : 0,
    inclusions: list(data.inclusions),
    exclusions: list(data.exclusions),
    eligibility: sanitizeText(data.eligibility, 300),
    cancellationText: sanitizeText(data.cancellationText, 1500),
    cancellation: {
      freeCancelHours: num(data.cancellation?.freeCancelHours, 48),
      lateCancelPct: num(data.cancellation?.lateCancelPct, 50),
      afterUsePct: num(data.cancellation?.afterUsePct, 0),
    },
    returnWindowDays: fulfilment === 'PRODUCT' ? num(data.returnWindowDays, 7) : null,
    options: (data.options || []).slice(0, 20).map((op, i) => {
      const prev = (existing?.options || []).find((p) => p.id === op.id);
      return {
        id: op.id || `opt${i + 1}${randomCode(4)}`,
        label: sanitizeText(op.label, 80),
        description: sanitizeText(op.description, 200),
        capacity: Math.round(num(op.capacity)),
        priceDelta: round2(num(op.priceDelta)),
        durationDays: op.durationDays ? Math.round(num(op.durationDays)) : null,
        startDate: op.startDate || null,
        schedule: sanitizeText(op.schedule, 120),
        sessions: op.sessions ? Math.round(num(op.sessions)) : null,
        address: sanitizeText(op.address, 200),
        used: prev?.used || 0,
        held: prev?.held || 0,
      };
    }),
    // Type-specific fields
    activationRule: fulfilment === 'MEMBERSHIP' ? data.activationRule : null,
    facilities: list(data.facilities, 30, 60),
    operatingHours: sanitizeText(data.operatingHours, 120),
    blackoutDates: sanitizeText(data.blackoutDates, 200),
    healthSafety: sanitizeText(data.healthSafety, 600),
    instructor: sanitizeText(data.instructor, 300),
    syllabus: list(data.syllabus, 30, 200),
    language: sanitizeText(data.language, 40),
    prerequisites: sanitizeText(data.prerequisites, 300),
    platform: sanitizeText(data.platform, 60),
    accessInstructions: sanitizeText(data.accessInstructions, 600),
    accessDuration: sanitizeText(data.accessDuration, 120),
    certificatePolicy: sanitizeText(data.certificatePolicy, 200),
    lateJoinPolicy: sanitizeText(data.lateJoinPolicy, 200),
    serviceAreas: list(data.serviceAreas, 100, 6),
    remoteSupported: !!data.remoteSupported,
    scope: sanitizeText(data.scope, 1500),
    warranty: sanitizeText(data.warranty, 300),
    projectMilestones: Array.isArray(data.projectMilestones) && data.projectMilestones.length ? data.projectMilestones.filter((k) => PROJECT_MILESTONES.some((m) => m.key === k)) : PROJECT_MILESTONES.slice(0, 4).map((m) => m.key),
    deliveryEstimate: sanitizeText(data.deliveryEstimate, 80),
    sessions: data.sessions ? Math.round(num(data.sessions)) : null,
    voucherValidityDays: Math.round(num(data.voucherValidityDays, 90)),
    images: list(data.images, 6, 500),
    highlights: list(data.highlights, 6, 80),
  };
}

export async function saveOffer(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const merchantId = requireMerchant(user);
    const merchant = await tx.get(`merchants/${merchantId}`);
    const existing = data.id ? await tx.get(`offers/${data.id}`) : null;
    if (existing && existing.merchantId !== merchantId) fail('permission-denied', 'Not your offer.');
    const id = existing?.id || store.newId('off');
    const normalized = normalizeOffer(data, merchant, existing);
    const wasLive = existing?.status === OFFER_STATUS.APPROVED;
    const offer = {
      ...(existing || {}),
      ...normalized,
      id,
      merchantId,
      merchantName: merchant.name,
      merchantVerified: merchant.status === MERCHANT_STATUS.VERIFIED,
      status: wasLive ? OFFER_STATUS.PENDING_APPROVAL : existing?.status === OFFER_STATUS.PENDING_APPROVAL ? OFFER_STATUS.PENDING_APPROVAL : OFFER_STATUS.DRAFT,
      version: (existing?.version || 0) + 1,
      used: existing?.used || 0,
      held: existing?.held || 0,
      stats: existing?.stats || { views: 0, shares: 0, joins: 0, groups: 0, revenue: 0, cancellations: 0 },
      rating: existing?.rating || 0,
      ratingCount: existing?.ratingCount || 0,
      createdAt: existing?.createdAt || nowISO(now),
      updatedAt: nowISO(now),
    };
    tx.set(`offers/${id}`, offer);
    audit(tx, store, { actor: user, action: existing ? 'OFFER_UPDATED' : 'OFFER_CREATED', entity: 'offer', entityId: id, note: `v${offer.version}${wasLive ? ' — sent back for review' : ''}`, now });
    return { offerId: id, errors: validateOffer(offer), status: offer.status };
  });
}

export async function submitOffer(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const merchantId = requireMerchant(user);
    const merchant = await tx.get(`merchants/${merchantId}`);
    const offer = await tx.get(`offers/${data.offerId}`);
    if (!offer || offer.merchantId !== merchantId) fail('not-found', 'Offer not found.');
    if (merchant.status !== MERCHANT_STATUS.VERIFIED) fail('failed-precondition', 'Your business must be verified by JodoDeal before you can publish offers.');
    const errors = validateOffer(offer);
    if (errors.length) fail('invalid-argument', errors.join(' '));
    tx.update(`offers/${offer.id}`, { status: OFFER_STATUS.PENDING_APPROVAL, submittedAt: nowISO(now), moderationNote: '' });
    audit(tx, store, { actor: user, action: 'OFFER_SUBMITTED', entity: 'offer', entityId: offer.id, now });
    return { ok: true };
  });
}

export async function setOfferPaused(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const offer = await tx.get(`offers/${data.offerId}`);
    if (!offer) fail('not-found', 'Offer not found.');
    requireOwnerMerchantOrStaff(user, offer);
    if (data.paused && offer.status !== OFFER_STATUS.APPROVED) fail('failed-precondition', 'Only live offers can be paused.');
    if (!data.paused && offer.status !== OFFER_STATUS.PAUSED) fail('failed-precondition', 'Offer is not paused.');
    tx.update(`offers/${offer.id}`, { status: data.paused ? OFFER_STATUS.PAUSED : OFFER_STATUS.APPROVED });
    audit(tx, store, { actor: user, action: data.paused ? 'OFFER_PAUSED' : 'OFFER_RESUMED', entity: 'offer', entityId: offer.id, now });
    return { ok: true };
  });
}

/** Product fulfilment: process, ship with AWB, tracking events, delivery (BRD §7.3). */
export async function fulfilOrder(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const order = await tx.get(`orders/${data.orderId}`);
    if (!order) fail('not-found', 'Order not found.');
    requireOwnerMerchantOrStaff(user, order);
    if (order.kind !== 'PRODUCT') fail('failed-precondition', 'Use booking actions for services.');
    const shipment = await tx.get(`shipments/${order.id}`);
    const t = (s, n) => [...(order.timeline || []), timelineEntry(s, n, now)];
    switch (data.action) {
      case 'PROCESS':
        if (order.status !== 'CONFIRMED') fail('failed-precondition', 'Only confirmed orders can be processed.');
        tx.update(`orders/${order.id}`, { status: 'PROCESSING', timeline: t('PROCESSING', 'Merchant is packing your order') });
        break;
      case 'SHIP': {
        if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) fail('failed-precondition', 'Order cannot be shipped now.');
        const awb = sanitizeText(data.awb, 30);
        const carrier = sanitizeText(data.carrier, 40);
        if (!awb || !carrier) fail('invalid-argument', 'Carrier and AWB number are required.');
        tx.set(`shipments/${order.id}`, {
          id: order.id,
          orderId: order.id,
          uid: order.uid,
          merchantId: order.merchantId,
          carrier,
          awb,
          status: 'LABEL_CREATED',
          events: [{ at: nowISO(now), event: 'LABEL_CREATED', note: `${carrier} AWB ${awb}` }],
          createdAt: nowISO(now),
        });
        tx.update(`orders/${order.id}`, { status: 'SHIPPED', shippedAt: nowISO(now), timeline: t('SHIPPED', `Shipped via ${carrier} · AWB ${awb}`) });
        notify(tx, store, { uid: order.uid, title: 'Order shipped 📦', body: `${order.offerTitle} shipped via ${carrier}. AWB ${awb}.`, link: `/account/orders/${order.id}`, now });
        break;
      }
      case 'EVENT': {
        if (!shipment) fail('failed-precondition', 'No shipment yet.');
        const ev = sanitizeText(data.event, 30);
        tx.update(`shipments/${order.id}`, { status: ev, events: [...shipment.events, { at: nowISO(now), event: ev, note: sanitizeText(data.note, 200) }] });
        if (ev === 'DELIVERED') {
          tx.update(`orders/${order.id}`, { status: 'DELIVERED', deliveredAt: nowISO(now), timeline: t('DELIVERED', 'Delivered') });
          notify(tx, store, { uid: order.uid, title: 'Delivered ✅', body: `${order.offerTitle} was delivered. Enjoy — and leave a review!`, link: `/account/orders/${order.id}`, now });
        }
        if (ev === 'DELIVERY_FAILED') notify(tx, store, { uid: order.uid, title: 'Delivery attempt failed', body: 'The courier will retry. Please keep your phone reachable.', link: `/account/orders/${order.id}`, kind: 'warning', now });
        break;
      }
      default:
        fail('invalid-argument', 'Unknown action.');
    }
    return { ok: true };
  });
}

/** Voucher / QR redemption with duplicate-use protection (BRD §6.1). */
export async function redeemVoucher(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  const code = sanitizeText(data.code, 20).toUpperCase().replace(/\s/g, '');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const voucher = await tx.get(`vouchers/${code}`);
    if (!voucher) fail('not-found', 'Invalid code. Please check and try again.');
    requireOwnerMerchantOrStaff(user, voucher);
    const booking = await tx.get(`bookings/${voucher.bookingId}`);
    const order = await tx.get(`orders/${voucher.orderId}`);
    if (voucher.status === 'VOID') fail('failed-precondition', 'This code was cancelled.');
    if (new Date(voucher.validTo) < now) fail('failed-precondition', 'This code has expired.');
    if ((voucher.redemptions || []).length >= voucher.maxRedemptions) {
      const last = voucher.redemptions[voucher.redemptions.length - 1];
      fail('already-exists', `Already redeemed on ${new Date(last.at).toLocaleString('en-IN')}. Duplicate use blocked.`);
    }
    const redemptions = [...(voucher.redemptions || []), { at: nowISO(now), by: user.displayName, note: sanitizeText(data.note, 120) }];
    const done = redemptions.length >= voucher.maxRedemptions;
    tx.update(`vouchers/${code}`, { redemptions, status: done ? 'REDEEMED' : 'PARTIALLY_REDEEMED' });
    if (booking) {
      if (booking.kind === 'MEMBERSHIP') {
        const validFrom = booking.validFrom || nowISO(now);
        const validTo = booking.validTo || new Date(new Date(validFrom).getTime() + booking.durationDays * 864e5).toISOString();
        tx.update(`bookings/${booking.id}`, { status: 'ACTIVE', firstVisitAt: booking.firstVisitAt || nowISO(now), validFrom, validTo });
        if (order) tx.update(`orders/${order.id}`, { status: 'ACTIVE', timeline: [...(order.timeline || []), timelineEntry('ACTIVE', 'Membership activated at the branch', now)] });
      } else {
        const used = (booking.sessionsUsed || 0) + 1;
        const complete = used >= (booking.sessionsTotal || 1);
        tx.update(`bookings/${booking.id}`, { sessionsUsed: used, status: complete ? 'COMPLETED' : 'ACTIVE' });
        if (order && complete) tx.update(`orders/${order.id}`, { status: 'COMPLETED', timeline: [...(order.timeline || []), timelineEntry('COMPLETED', 'All sessions redeemed', now)] });
      }
    }
    notify(tx, store, { uid: voucher.uid, title: 'Code redeemed', body: `${voucher.offerTitle}: redemption ${redemptions.length}/${voucher.maxRedemptions} recorded.`, link: `/account/orders/${voucher.orderId}`, now });
    return { ok: true, voucher: { ...voucher, redemptions, status: done ? 'REDEEMED' : 'PARTIALLY_REDEEMED' } };
  });
}

/**
 * Provider booking actions: confirm slot, mark attendance, complete, customer no-show,
 * provider cancellation (triggers documented remedy: full refund + support case).
 */
export async function bookingAction(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking) fail('not-found', 'Booking not found.');
    requireOwnerMerchantOrStaff(user, booking);
    const order = await tx.get(`orders/${booking.orderId}`);
    const payment = data.action === 'PROVIDER_CANCEL' ? await tx.get(`payments/${order.paymentId}`) : null;
    const offer = data.action === 'PROVIDER_CANCEL' ? await tx.get(`offers/${order.offerId}`) : null;
    const voucher = data.action === 'PROVIDER_CANCEL' && (booking.voucherCode || booking.membershipCode) ? await tx.get(`vouchers/${booking.voucherCode || booking.membershipCode}`) : null;
    const t = (s, n) => [...(order.timeline || []), timelineEntry(s, n, now)];

    switch (data.action) {
      case 'CONFIRM_SLOT': {
        const slot = data.slot ? new Date(data.slot) : null;
        if (!slot || Number.isNaN(slot.getTime())) fail('invalid-argument', 'Choose a slot.');
        const slots = [...(booking.slots || [])];
        const idx = slots.findIndex((s) => s.status === 'REQUESTED');
        const entry = { at: slot.toISOString(), status: 'SCHEDULED', confirmedBy: 'provider' };
        if (idx >= 0) slots[idx] = { ...slots[idx], ...entry };
        else slots.push(entry);
        tx.update(`bookings/${booking.id}`, { slots, status: 'SCHEDULED' });
        if (booking.kind === 'PROJECT') {
          tx.update(`bookings/${booking.id}`, { milestones: (booking.milestones || []).map((m) => (m.key === 'CONSULTATION' ? { ...m, status: 'DONE', at: nowISO(now), note: `Scheduled for ${slot.toLocaleString('en-IN')}` } : m)) });
        }
        notify(tx, store, { uid: booking.uid, title: 'Appointment confirmed 📅', body: `${booking.merchantName} confirmed ${slot.toLocaleString('en-IN')}. We'll remind you a day before.`, link: `/account/orders/${booking.orderId}`, now });
        break;
      }
      case 'ATTENDANCE': {
        const attendance = [...(booking.attendance || []), { at: nowISO(now), session: sanitizeText(data.session, 80) || `Session ${(booking.attendance || []).length + 1}` }];
        tx.update(`bookings/${booking.id}`, { attendance, status: 'ACTIVE' });
        if (order.status === 'CONFIRMED') tx.update(`orders/${order.id}`, { status: 'ACTIVE', timeline: t('ACTIVE', 'Course started') });
        break;
      }
      case 'COMPLETE':
        tx.update(`bookings/${booking.id}`, { status: 'COMPLETED', completedAt: nowISO(now) });
        tx.update(`orders/${order.id}`, { status: 'COMPLETED', timeline: t('COMPLETED', 'Service completed') });
        notify(tx, store, { uid: booking.uid, title: 'Service completed', body: `How was ${booking.offerTitle}? Leave a verified review.`, link: `/account/orders/${booking.orderId}`, now });
        break;
      case 'NO_SHOW': {
        const slots = (booking.slots || []).map((s) => (s.status === 'SCHEDULED' ? { ...s, status: 'NO_SHOW' } : s));
        tx.update(`bookings/${booking.id}`, { slots, status: 'CONFIRMED' });
        notify(tx, store, { uid: booking.uid, title: 'Missed appointment', body: 'You were marked as a no-show. Request a new slot from your bookings.', link: `/account/orders/${booking.orderId}`, kind: 'warning', now });
        break;
      }
      case 'PROVIDER_CANCEL': {
        const reason = sanitizeText(data.reason, 400);
        if (!reason) fail('invalid-argument', 'A reason is required.');
        tx.update(`bookings/${booking.id}`, { status: 'PROVIDER_CANCELLED', cancelReason: reason });
        tx.update(`orders/${order.id}`, { status: 'REFUNDED', timeline: t('PROVIDER_CANCELLED', `Provider cancelled: ${reason} — full refund initiated`) });
        refundWrite(tx, { payment, order, amount: order.amountPaid, reason: 'PROVIDER_CANCELLATION', note: reason, now });
        if (voucher) tx.update(`vouchers/${voucher.id}`, { status: 'VOID' });
        const patch = adjustOfferCounters(offer, order.optionId, { used: -order.quantity });
        tx.update(`offers/${offer.id}`, { options: patch.options, used: patch.used });
        const tid = store.newId('tkt');
        tx.set(`tickets/${tid}`, {
          id: tid,
          ref: `JD-${randomCode(6)}`,
          uid: booking.uid,
          customerName: booking.customerName,
          category: 'PROVIDER',
          subject: `Provider cancellation — ${booking.offerTitle}`,
          orderId: order.id,
          merchantId: booking.merchantId,
          priority: 'HIGH',
          status: 'OPEN',
          system: true,
          messages: [{ from: 'support', name: 'JodoDeal Support', text: `The provider cancelled your booking (${reason}). A full refund has been initiated. Reply here if you'd like help finding an alternative.`, at: nowISO(now) }],
          createdAt: nowISO(now),
          updatedAt: nowISO(now),
        });
        notify(tx, store, { uid: booking.uid, title: 'Booking cancelled by provider', body: `Full refund of ₹${order.amountPaid} initiated. Our team will help you with alternatives.`, link: '/account/refunds', kind: 'error', now });
        audit(tx, store, { actor: user, action: 'PROVIDER_CANCELLED_BOOKING', entity: 'booking', entityId: booking.id, note: reason, now });
        break;
      }
      default:
        fail('invalid-argument', 'Unknown action.');
    }
    return { ok: true };
  });
}

export async function updateMilestone(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking || booking.kind !== 'PROJECT') fail('not-found', 'Project not found.');
    requireOwnerMerchantOrStaff(user, booking);
    const milestones = (booking.milestones || []).map((m) =>
      m.key === data.key ? { ...m, status: data.status === 'PENDING' ? 'PENDING' : 'DONE', note: sanitizeText(data.note, 300), evidenceUrl: sanitizeText(data.evidenceUrl, 500), at: nowISO(now) } : m,
    );
    tx.update(`bookings/${booking.id}`, { milestones, status: 'IN_PROGRESS' });
    const m = PROJECT_MILESTONES.find((x) => x.key === data.key);
    notify(tx, store, { uid: booking.uid, title: 'Project update', body: `${booking.offerTitle}: ${m?.label || data.key} — done.`, link: `/account/orders/${booking.orderId}`, now });
    return { ok: true };
  });
}

/** Itemised quotation: included work, optional upgrades, materials, taxes & extras (BRD §6.3). */
export async function issueQuotation(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  const items = (data.items || [])
    .map((it) => ({ description: sanitizeText(it.description, 160), type: ['INCLUDED', 'OPTIONAL', 'MATERIAL', 'ADDITIONAL'].includes(it.type) ? it.type : 'ADDITIONAL', amount: round2(Number(it.amount) || 0) }))
    .filter((it) => it.description);
  if (!items.length) fail('invalid-argument', 'Add at least one line item.');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking || booking.kind !== 'PROJECT') fail('not-found', 'Project not found.');
    requireOwnerMerchantOrStaff(user, booking);
    const subtotal = round2(items.filter((i) => i.type !== 'OPTIONAL').reduce((s, i) => s + i.amount, 0));
    const gstRate = Number(data.gstRate ?? 18);
    const gst = round2((subtotal * gstRate) / 100);
    const q = {
      id: store.newId('quo'),
      number: `Q-${randomCode(5)}`,
      items,
      subtotal,
      gstRate,
      gst,
      total: round2(subtotal + gst),
      optionalTotal: round2(items.filter((i) => i.type === 'OPTIONAL').reduce((s, i) => s + i.amount, 0)),
      validUntil: data.validUntil || new Date(now.getTime() + 14 * 864e5).toISOString(),
      notes: sanitizeText(data.notes, 600),
      status: 'ISSUED',
      issuedAt: nowISO(now),
    };
    const milestones = (booking.milestones || []).map((m) => (m.key === 'QUOTATION' ? { ...m, status: 'DONE', at: nowISO(now), note: `${q.number} issued` } : m));
    tx.update(`bookings/${booking.id}`, { quotations: [...(booking.quotations || []), q], milestones });
    notify(tx, store, { uid: booking.uid, title: 'Quotation received', body: `${booking.merchantName} sent itemised quote ${q.number} (₹${q.total}). Review and accept or decline.`, link: `/account/orders/${booking.orderId}`, now });
    return { ok: true, quotation: q };
  });
}

/** Merchant (own records) or staff resolve a cancellation / return case. */
export async function resolveCase(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const kase = await tx.get(`cases/${data.caseId}`);
    if (!kase) fail('not-found', 'Case not found.');
    requireOwnerMerchantOrStaff(user, kase);
    if (!['OPEN', 'IN_REVIEW'].includes(kase.status)) fail('failed-precondition', 'Case already resolved.');
    const order = await tx.get(`orders/${kase.orderId}`);
    const payment = await tx.get(`payments/${order.paymentId}`);
    const offer = await tx.get(`offers/${order.offerId}`);
    const booking = order.kind === 'PRODUCT' ? null : await tx.get(`bookings/${order.id}`);
    const voucherCode = booking?.voucherCode || booking?.membershipCode;
    const voucher = voucherCode ? await tx.get(`vouchers/${voucherCode}`) : null;
    const note = sanitizeText(data.note, 500);
    const t = (s, n) => [...(order.timeline || []), timelineEntry(s, n, now)];

    if (data.decision === 'APPROVE') {
      const amount = round2(Math.min(order.amountPaid, data.refundAmount !== undefined ? Number(data.refundAmount) : kase.proposedRefund));
      const reason = kase.type === 'RETURN' ? 'PRODUCT_RETURN' : 'CUSTOMER_CANCELLATION';
      if (amount > 0) refundWrite(tx, { payment, order, amount, reason, note, now });
      tx.update(`cases/${kase.id}`, { status: 'RESOLVED', decision: 'APPROVED', refundAmount: amount, resolvedAt: nowISO(now), resolvedBy: user.displayName, timeline: [...(kase.timeline || []), timelineEntry('APPROVED', note || `Refund ₹${amount}`, now)] });
      tx.update(`orders/${order.id}`, { status: amount > 0 ? 'REFUNDED' : 'CANCELLED', openCaseId: null, timeline: t(kase.type === 'RETURN' ? 'RETURN_APPROVED' : 'CANCELLED', `Approved — refund ₹${amount}`) });
      if (booking) tx.update(`bookings/${booking.id}`, { status: 'CANCELLED' });
      if (voucher) tx.update(`vouchers/${voucher.id}`, { status: 'VOID' });
      const patch = adjustOfferCounters(offer, order.optionId, { used: -order.quantity });
      tx.update(`offers/${offer.id}`, { options: patch.options, used: patch.used, stats: { ...(offer.stats || {}), cancellations: (offer.stats?.cancellations || 0) + 1 } });
      notify(tx, store, { uid: kase.uid, title: 'Request approved', body: amount > 0 ? `₹${amount} is being refunded to your original payment method.` : 'Your request was approved.', link: '/account/refunds', kind: 'success', now });
    } else if (data.decision === 'REJECT') {
      if (!note) fail('invalid-argument', 'Please explain why the request is declined.');
      tx.update(`cases/${kase.id}`, { status: 'RESOLVED', decision: 'REJECTED', resolvedAt: nowISO(now), resolvedBy: user.displayName, timeline: [...(kase.timeline || []), timelineEntry('REJECTED', note, now)] });
      tx.update(`orders/${order.id}`, { status: kase.prevStatus || 'CONFIRMED', openCaseId: null, timeline: t('REQUEST_DECLINED', note) });
      notify(tx, store, { uid: kase.uid, title: 'Request declined', body: `${note} You can escalate via Support.`, link: '/account/support', kind: 'warning', now });
    } else {
      fail('invalid-argument', 'Decision must be APPROVE or REJECT.');
    }
    audit(tx, store, { actor: user, action: `CASE_${data.decision}`, entity: 'case', entityId: kase.id, note, now });
    return { ok: true };
  });
}
