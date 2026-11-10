/**
 * Group creation, joining, checkout and payment handling — BRD §5, §7.2, §8.1.
 */
import { GROUP_STATES, JOINABLE_GROUP_STATES, OFFER_STATUS, RESERVATION_MINUTES, TERMS_VERSION, PROJECT_MILESTONES } from '../constants.js';
import {
  addHours,
  assertTransition,
  joinBlocker,
  joinUnitPrice,
  optionById,
  priceAtCount,
  priceBreakdown,
  randomCode,
  sortTiers,
  tierIndexForCount,
} from '../pricing.js';
import {
  adjustOfferCounters,
  fail,
  firstName,
  loadActor,
  notify,
  nowISO,
  refundWrite,
  requireAuth,
  sanitizeText,
  timelineEntry,
} from './core.js';

const MAX_OPEN_GROUPS_PER_HOST = 2;

/** Customer creates a new group from an approved offer (BRD §7.2). */
export async function createGroup(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const offer = await tx.get(`offers/${data.offerId}`);
    if (!offer || offer.status !== OFFER_STATUS.APPROVED) fail('failed-precondition', 'This offer is not live.');
    if (offer.endAt && new Date(offer.endAt) <= now) fail('failed-precondition', 'This offer campaign has ended.');
    const hosted = await tx.query('groups', [
      ['offerId', '==', offer.id],
      ['hostUid', '==', ctx.uid],
    ]);
    const openHosted = hosted.filter((g) => JOINABLE_GROUP_STATES.includes(g.state) && new Date(g.deadline) > now);
    if (openHosted.length >= MAX_OPEN_GROUPS_PER_HOST) {
      fail('resource-exhausted', 'You already have open groups for this offer. Share one of them instead!');
    }
    const group = buildGroup({ offer, store, now, hostUid: ctx.uid, hostName: firstName(user.displayName) });
    tx.set(`groups/${group.id}`, group);
    tx.update(`offers/${offer.id}`, { stats: { ...(offer.stats || {}), groups: (offer.stats?.groups || 0) + 1 } });
    return { groupId: group.id };
  });
}

export function buildGroup({ offer, store, now, hostUid = null, hostName = 'JodoDeal', id }) {
  const deadlineByDuration = addHours(now, offer.groupDurationHours || 72);
  const deadline = offer.endAt && new Date(offer.endAt) < deadlineByDuration ? new Date(offer.endAt) : deadlineByDuration;
  const tiers = sortTiers(offer.tiers);
  const groupId = id || store.newId('grp');
  return {
    id: groupId,
    offerId: offer.id,
    merchantId: offer.merchantId,
    merchantName: offer.merchantName,
    offerTitle: offer.title,
    categoryId: offer.categoryId,
    city: offer.city,
    fulfilment: offer.fulfilment,
    state: GROUP_STATES.OPEN,
    hostUid,
    hostName,
    shareCode: randomCode(6),
    paidCount: 0,
    heldCount: 0,
    maxCountReached: 0,
    minGroupSize: offer.minGroupSize,
    maxMembers: offer.maxGroupSize || null,
    tiers,
    mrp: offer.mrp,
    pricingRule: offer.pricingRule,
    failurePolicy: offer.failurePolicy,
    bestTierIndex: -1,
    achievedPrice: offer.mrp,
    nextJoinPrice: priceAtCount({ ...offer, tiers }, 1),
    deadline: deadline.toISOString(),
    extensionUsed: false,
    shares: 0,
    avatars: [],
    createdAt: now.toISOString(),
    stateHistory: [timelineEntry(GROUP_STATES.OPEN, 'Group opened', now)],
  };
}

function validateFulfilmentDetails(offer, details = {}) {
  const clean = {};
  if (offer.fulfilment === 'PRODUCT') {
    const a = details.address || {};
    for (const f of ['name', 'line1', 'city', 'pincode', 'phone']) {
      if (!a[f]) fail('invalid-argument', 'Please provide a complete delivery address.');
    }
    if (!/^\d{6}$/.test(String(a.pincode))) fail('invalid-argument', 'Please enter a valid 6-digit PIN code.');
    clean.address = {
      name: sanitizeText(a.name, 80),
      line1: sanitizeText(a.line1, 160),
      line2: sanitizeText(a.line2, 160),
      city: sanitizeText(a.city, 60),
      state: sanitizeText(a.state, 60),
      pincode: String(a.pincode),
      phone: sanitizeText(a.phone, 15),
    };
  }
  if (offer.fulfilment === 'PROJECT') {
    const pin = String(details.pincode || '');
    if (!/^\d{6}$/.test(pin)) fail('invalid-argument', 'Please enter the 6-digit PIN code of the project site.');
    const areas = offer.serviceAreas || [];
    if (!offer.remoteSupported && areas.length && !areas.some((p) => pin.startsWith(String(p)))) {
      fail('failed-precondition', 'Sorry, this provider does not serve that PIN code yet.');
    }
    clean.pincode = pin;
    clean.propertyType = sanitizeText(details.propertyType, 40);
    clean.rooms = sanitizeText(details.rooms, 40);
    clean.notes = sanitizeText(details.notes, 600);
    clean.preferredDate = sanitizeText(details.preferredDate, 30);
  }
  if (['MEMBERSHIP', 'APPOINTMENT', 'VOUCHER', 'COURSE'].includes(offer.fulfilment)) {
    clean.preferredDate = sanitizeText(details.preferredDate, 30);
    clean.notes = sanitizeText(details.notes, 300);
  }
  return clean;
}

/**
 * Starts checkout: validates eligibility, discloses the exact price breakdown,
 * reserves capacity for a limited window and creates an idempotent payment intent.
 */
export async function startCheckout(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const key = sanitizeText(data.idempotencyKey, 64);
  if (!key || key.length < 8) fail('invalid-argument', 'Missing idempotency key.');
  if (data.acceptedTermsVersion !== TERMS_VERSION || !data.acceptedTerms) {
    fail('failed-precondition', 'Please review and accept the offer terms before paying.');
  }
  const paymentId = `pay_${ctx.uid.slice(0, 12)}_${key}`.replace(/[^A-Za-z0-9_-]/g, '');

  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const existing = await tx.get(`payments/${paymentId}`);
    if (existing) {
      if (existing.uid !== ctx.uid) fail('permission-denied', 'Payment mismatch.');
      return { paymentId, payment: existing, reused: true };
    }
    const group = await tx.get(`groups/${data.groupId}`);
    if (!group) fail('not-found', 'Group not found.');
    const offer = await tx.get(`offers/${group.offerId}`);
    const member = await tx.get(`groups/${group.id}/members/${ctx.uid}`);
    const pending = await tx.query('payments', [
      ['uid', '==', ctx.uid],
      ['groupId', '==', group.id],
      ['status', '==', 'CREATED'],
    ]);

    if (user.status === 'SUSPENDED') fail('permission-denied', 'Your account is suspended. Please contact support.');
    if (member && member.status === 'ACTIVE' && offer?.onePerCustomer !== false) {
      fail('already-exists', 'You are already a member of this group.');
    }
    const optionId = data.optionId || (offer?.options?.length === 1 ? offer.options[0].id : null);
    const blocker = joinBlocker({ offer, group, optionId, now });
    if (blocker) fail('failed-precondition', blocker);

    const details = validateFulfilmentDetails(offer, data.fulfilmentDetails);
    const unitPrice = joinUnitPrice(offer, { ...group, tiers: group.tiers }, optionId);
    const breakdown = priceBreakdown(offer, unitPrice, data.quantity || 1);
    const option = optionById(offer, optionId);

    // Release any earlier un-paid hold by this user for this group (one live hold at a time).
    let offerPatch = { ...offer };
    let heldDelta = 0;
    for (const p of pending) {
      tx.update(`payments/${p.id}`, { status: 'CANCELLED', updatedAt: nowISO(now) });
      offerPatch = { ...offerPatch, ...adjustOfferCounters(offerPatch, p.optionId, { held: -p.quantity }) };
      heldDelta -= p.quantity;
    }
    offerPatch = { ...offerPatch, ...adjustOfferCounters(offerPatch, optionId, { held: breakdown.quantity }) };
    heldDelta += breakdown.quantity;

    const payment = {
      id: paymentId,
      uid: ctx.uid,
      groupId: group.id,
      offerId: offer.id,
      merchantId: offer.merchantId,
      offerTitle: offer.title,
      optionId,
      optionLabel: option?.label || null,
      quantity: breakdown.quantity,
      position: (group.paidCount || 0) + 1,
      amount: breakdown.total,
      currency: 'INR',
      breakdown,
      fulfilmentDetails: details,
      termsSnapshot: {
        termsVersion: TERMS_VERSION,
        offerVersion: offer.version || 1,
        pricingRule: group.pricingRule,
        failurePolicy: group.failurePolicy,
        cancellation: offer.cancellation || null,
        inclusions: offer.inclusions || [],
        exclusions: offer.exclusions || [],
        activationRule: offer.activationRule || null,
        acceptedAt: nowISO(now),
      },
      referralCode: sanitizeText(data.referralCode, 20) || null,
      idempotencyKey: key,
      gateway: 'MOCK_UPI',
      status: 'CREATED',
      createdAt: nowISO(now),
      expiresAt: addHours(now, RESERVATION_MINUTES / 60).toISOString(),
    };
    tx.set(`payments/${paymentId}`, payment);
    tx.update(`offers/${offer.id}`, { options: offerPatch.options, held: offerPatch.held });
    tx.update(`groups/${group.id}`, { heldCount: Math.max(0, (group.heldCount || 0) + heldDelta) });
    return { paymentId, payment };
  });
}

/** Customer abandons an unpaid checkout: release the reserved seat immediately. */
export async function cancelPendingPayment(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const payment = await tx.get(`payments/${data.paymentId}`);
    if (!payment || payment.uid !== ctx.uid) fail('not-found', 'Payment not found.');
    if (payment.status !== 'CREATED') return { ok: true };
    const offer = await tx.get(`offers/${payment.offerId}`);
    const group = await tx.get(`groups/${payment.groupId}`);
    releaseHold(tx, { payment, offer, group, status: 'CANCELLED', now });
    return { ok: true };
  });
}

export function releaseHold(tx, { payment, offer, group, status, now }) {
  tx.update(`payments/${payment.id}`, { status, updatedAt: nowISO(now) });
  if (offer) {
    const patch = adjustOfferCounters(offer, payment.optionId, { held: -payment.quantity });
    tx.update(`offers/${offer.id}`, { options: patch.options, held: patch.held });
  }
  if (group) tx.update(`groups/${group.id}`, { heldCount: Math.max(0, (group.heldCount || 0) - payment.quantity) });
}

/**
 * Mock payment gateway used for demo / emulator runs. In production the real gateway
 * calls the signed webhook (functions/src/index.js → paymentWebhook) instead.
 * The event id is deterministic so double-clicks never double-process.
 */
export async function confirmMockPayment(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const outcome = data.outcome === 'FAILED' ? 'FAILED' : 'SUCCESS';
  const payment = await store.runTransaction(async (tx) => tx.get(`payments/${data.paymentId}`));
  if (!payment || payment.uid !== ctx.uid) fail('not-found', 'Payment not found.');
  return handlePaymentEvent(
    {
      eventId: `evt_mock_${payment.id}_${outcome}`,
      paymentId: payment.id,
      status: outcome,
      amount: payment.amount,
      gatewayRef: `MOCKUPI${payment.id.slice(-10).toUpperCase()}`,
      method: data.method || 'UPI',
    },
    store,
    env,
  );
}

/**
 * Idempotent payment event handler (webhook or mock gateway) — AC-02, AC-03, AC-14.
 * Only valid paid transactions count toward group progress.
 */
export async function handlePaymentEvent(event, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    // ---- reads ----
    const seen = await tx.get(`paymentEvents/${event.eventId}`);
    if (seen) return { duplicate: true, paymentId: event.paymentId, orderId: seen.orderId || null };
    const payment = await tx.get(`payments/${event.paymentId}`);
    if (!payment) fail('not-found', 'Unknown payment.');
    const group = await tx.get(`groups/${payment.groupId}`);
    const offer = await tx.get(`offers/${payment.offerId}`);
    const member = await tx.get(`groups/${payment.groupId}/members/${payment.uid}`);
    const user = await tx.get(`users/${payment.uid}`);
    const waiting = await tx.query('orders', [
      ['groupId', '==', payment.groupId],
      ['status', '==', 'AWAITING_GROUP'],
    ]);

    const orderId = `ord_${payment.id}`;
    const eventDoc = { id: event.eventId, paymentId: payment.id, status: event.status, receivedAt: nowISO(now), orderId: null };

    if (!['CREATED', 'EXPIRED', 'CANCELLED'].includes(payment.status)) {
      tx.set(`paymentEvents/${event.eventId}`, { ...eventDoc, note: `Ignored: payment already ${payment.status}` });
      return { duplicate: true, paymentId: payment.id, orderId: payment.orderId || null };
    }

    if (event.status !== 'SUCCESS') {
      tx.set(`paymentEvents/${event.eventId}`, eventDoc);
      if (payment.status === 'CREATED') releaseHold(tx, { payment, offer, group, status: 'FAILED', now });
      notify(tx, store, { uid: payment.uid, title: 'Payment failed', body: `Your payment for ${payment.offerTitle} did not go through. No money was taken.`, link: `/g/${payment.groupId}`, kind: 'error', now });
      return { ok: false, status: 'FAILED', paymentId: payment.id };
    }

    if (event.amount !== undefined && Math.abs(Number(event.amount) - payment.amount) > 0.01) {
      tx.set(`paymentEvents/${event.eventId}`, { ...eventDoc, note: 'Amount mismatch' });
      tx.update(`payments/${payment.id}`, { status: 'SUCCEEDED', flagged: 'AMOUNT_MISMATCH', gatewayRef: event.gatewayRef || null, paidAt: nowISO(now) });
      refundWrite(tx, { payment, amount: Number(event.amount), reason: 'ADMIN', note: 'Amount mismatch — auto refund', now });
      return { ok: false, status: 'REFUND', paymentId: payment.id };
    }

    // Was the hold still valid? A late success after expiry is only honoured if capacity remains.
    const wasHeld = payment.status === 'CREATED';
    const option = optionById(offer, payment.optionId);
    const capacityOk =
      wasHeld ||
      (((offer?.capacity ?? Infinity) - (offer?.used || 0) - (offer?.held || 0)) >= payment.quantity &&
        (!option || (option.capacity ?? Infinity) - (option.used || 0) - (option.held || 0) >= payment.quantity));
    const deadlineOk = group && (new Date(group.deadline) > now || new Date(payment.createdAt) < new Date(group.deadline));
    const stateOk = group && JOINABLE_GROUP_STATES.includes(group.state);
    const duplicateMember = member && member.status === 'ACTIVE' && offer?.onePerCustomer !== false;
    const sizeOk = !group?.maxMembers || (group.paidCount || 0) < group.maxMembers;

    let rejectReason = null;
    if (duplicateMember) rejectReason = 'DUPLICATE_PAYMENT';
    else if (!stateOk || !deadlineOk) rejectReason = 'GROUP_CLOSED';
    else if (!capacityOk || !sizeOk) rejectReason = 'CAPACITY_FULL';

    const paidPatch = { status: 'SUCCEEDED', gatewayRef: event.gatewayRef || null, method: event.method || 'UPI', paidAt: nowISO(now), updatedAt: nowISO(now) };

    if (rejectReason) {
      tx.set(`paymentEvents/${event.eventId}`, { ...eventDoc, note: rejectReason });
      tx.update(`payments/${payment.id}`, { ...paidPatch, rejected: rejectReason });
      if (wasHeld) {
        const patch = adjustOfferCounters(offer, payment.optionId, { held: -payment.quantity });
        tx.update(`offers/${offer.id}`, { options: patch.options, held: patch.held });
        tx.update(`groups/${group.id}`, { heldCount: Math.max(0, (group.heldCount || 0) - payment.quantity) });
      }
      refundWrite(tx, { payment, amount: payment.amount, reason: rejectReason, now });
      notify(tx, store, { uid: payment.uid, title: 'Payment refunded', body: `We could not add you to the group (${rejectReason.replace(/_/g, ' ').toLowerCase()}). A full refund has been initiated.`, link: '/account/refunds', kind: 'warning', now });
      return { ok: false, status: 'REFUND', reason: rejectReason, paymentId: payment.id };
    }

    // ---- accept: writes ----
    const paidCount = (group.paidCount || 0) + 1;
    const counters = adjustOfferCounters(offer, payment.optionId, { held: wasHeld ? -payment.quantity : 0, used: payment.quantity });
    const tierIdx = tierIndexForCount(group.tiers, paidCount);
    const prevBest = group.bestTierIndex ?? -1;
    const bestTierIndex = Math.max(prevBest, tierIdx);
    const tiersForPrice = { mrp: group.mrp, tiers: group.tiers };
    const groupPatch = {
      paidCount,
      heldCount: Math.max(0, (group.heldCount || 0) - (wasHeld ? payment.quantity : 0)),
      maxCountReached: Math.max(group.maxCountReached || 0, paidCount),
      bestTierIndex,
      achievedPrice: priceAtCount(tiersForPrice, Math.max(group.maxCountReached || 0, paidCount)),
      nextJoinPrice: priceAtCount(tiersForPrice, paidCount + 1),
      avatars: [...(group.avatars || []), { initial: firstName(user?.displayName).charAt(0).toUpperCase(), hue: (paidCount * 47) % 360 }].slice(-12),
      updatedAt: nowISO(now),
    };

    let confirmingNow = false;
    const history = [...(group.stateHistory || [])];
    if (group.state === GROUP_STATES.OPEN && paidCount >= group.minGroupSize) {
      assertTransition(GROUP_STATES.OPEN, GROUP_STATES.TARGET_REACHED);
      assertTransition(GROUP_STATES.TARGET_REACHED, GROUP_STATES.CONFIRMED);
      history.push(timelineEntry(GROUP_STATES.TARGET_REACHED, `Minimum of ${group.minGroupSize} paid members reached`, now));
      history.push(timelineEntry(GROUP_STATES.CONFIRMED, 'Confirmation checks passed — fulfilment can begin', now));
      groupPatch.state = GROUP_STATES.CONFIRMED;
      groupPatch.confirmedAt = nowISO(now);
      groupPatch.stateHistory = history;
      confirmingNow = true;
    }
    const groupConfirmed = confirmingNow || group.state === GROUP_STATES.CONFIRMED;

    const order = {
      id: orderId,
      uid: payment.uid,
      customerName: user?.displayName || 'Customer',
      merchantId: payment.merchantId,
      merchantName: offer.merchantName,
      offerId: offer.id,
      offerTitle: offer.title,
      categoryId: offer.categoryId,
      groupId: group.id,
      paymentId: payment.id,
      kind: offer.fulfilment,
      optionId: payment.optionId,
      optionLabel: payment.optionLabel,
      quantity: payment.quantity,
      unitPrice: payment.breakdown.unitPrice,
      breakdown: payment.breakdown,
      amountPaid: payment.amount,
      memberPosition: paidCount,
      fulfilmentDetails: payment.fulfilmentDetails,
      termsSnapshot: payment.termsSnapshot,
      status: groupConfirmed ? 'CONFIRMED' : 'AWAITING_GROUP',
      createdAt: nowISO(now),
      confirmedAt: groupConfirmed ? nowISO(now) : null,
      timeline: [timelineEntry('PAID', `Payment ${event.gatewayRef || ''} received`, now)].concat(
        groupConfirmed ? [timelineEntry('CONFIRMED', 'Group confirmed', now)] : [timelineEntry('AWAITING_GROUP', 'Waiting for the group to reach its minimum size', now)],
      ),
    };

    tx.set(`paymentEvents/${event.eventId}`, { ...eventDoc, orderId });
    tx.update(`payments/${payment.id}`, { ...paidPatch, orderId });
    tx.set(`orders/${orderId}`, order);
    tx.set(`groups/${group.id}/members/${payment.uid}`, {
      uid: payment.uid,
      groupId: group.id,
      paymentId: payment.id,
      orderId,
      pricePaid: payment.breakdown.unitPrice,
      position: paidCount,
      status: 'ACTIVE',
      referralCode: payment.referralCode || null,
      joinedAt: nowISO(now),
    });
    tx.update(`groups/${group.id}`, groupPatch);
    tx.update(`offers/${offer.id}`, {
      options: counters.options,
      held: counters.held,
      used: counters.used,
      stats: { ...(offer.stats || {}), joins: (offer.stats?.joins || 0) + 1, revenue: (offer.stats?.revenue || 0) + payment.amount },
    });
    if (payment.referralCode && payment.referralCode !== user?.referralCode) {
      tx.set(`referrals/${payment.id}`, { id: payment.id, referralCode: payment.referralCode, refereeUid: payment.uid, groupId: group.id, offerId: offer.id, status: 'ATTRIBUTED', createdAt: nowISO(now) });
    }

    notify(tx, store, {
      uid: payment.uid,
      title: 'You are in! 🎉',
      body: groupConfirmed
        ? `Payment received for ${offer.title}. The group is confirmed — your ${offer.fulfilment === 'PRODUCT' ? 'order' : 'booking'} is ready.`
        : `Payment received for ${offer.title}. ${Math.max(0, group.minGroupSize - paidCount)} more member(s) needed — share the group link to unlock it faster!`,
      link: `/account/orders/${orderId}`,
      kind: 'success',
      now,
    });

    if (groupConfirmed) {
      writeFulfilment(tx, store, { order, offer, now });
    }
    if (confirmingNow) {
      for (const o of waiting) {
        if (o.id === orderId) continue;
        tx.update(`orders/${o.id}`, {
          status: 'CONFIRMED',
          confirmedAt: nowISO(now),
          timeline: [...(o.timeline || []), timelineEntry('CONFIRMED', 'Group reached its target and is confirmed', now)],
        });
        writeFulfilment(tx, store, { order: { ...o, confirmedAt: nowISO(now) }, offer, now });
        notify(tx, store, { uid: o.uid, title: 'Group confirmed! ✅', body: `${offer.title} reached its target. Your ${o.kind === 'PRODUCT' ? 'order is being prepared' : 'booking details are ready'}.`, link: `/account/orders/${o.id}`, kind: 'success', now });
      }
      notify(tx, store, { uid: group.hostUid, title: 'Your group is confirmed', body: `${offer.title} reached ${group.minGroupSize} members. Thanks for bringing people together!`, link: `/g/${group.id}`, kind: 'success', now });
    } else if (bestTierIndex > prevBest && group.hostUid) {
      notify(tx, store, { uid: group.hostUid, title: 'New price tier unlocked', body: `${offer.title} is now ₹${group.tiers[bestTierIndex].price} per member.`, link: `/g/${group.id}`, kind: 'info', now });
    }
    return { ok: true, status: 'SUCCEEDED', paymentId: payment.id, orderId, groupConfirmed };
  });
}

/**
 * Creates the customer's individual fulfilment record after group confirmation.
 * A group is a pricing campaign; each customer gets their own membership / enrolment /
 * project / booking / voucher record (BRD §6.4, §10.2).
 */
export function writeFulfilment(tx, store, { order, offer, now }) {
  const base = {
    id: order.id,
    orderId: order.id,
    uid: order.uid,
    customerName: order.customerName,
    merchantId: order.merchantId,
    merchantName: order.merchantName,
    offerId: order.offerId,
    offerTitle: order.offerTitle,
    groupId: order.groupId,
    optionId: order.optionId,
    optionLabel: order.optionLabel,
    createdAt: nowISO(now),
  };
  const option = optionById(offer, order.optionId) || {};
  const code = randomCode(10);

  switch (offer.fulfilment) {
    case 'MEMBERSHIP': {
      const durationDays = option.durationDays || offer.durationDays || 30;
      let validFrom = null;
      if (offer.activationRule === 'ON_PURCHASE') validFrom = order.createdAt;
      if (offer.activationRule === 'ON_GROUP_CONFIRMATION') validFrom = nowISO(now);
      const validTo = validFrom ? new Date(new Date(validFrom).getTime() + durationDays * 864e5).toISOString() : null;
      tx.set(`bookings/${order.id}`, {
        ...base,
        kind: 'MEMBERSHIP',
        status: validFrom ? 'ACTIVE' : 'CONFIRMED',
        membershipCode: code,
        activationRule: offer.activationRule,
        durationDays,
        validFrom,
        validTo,
        branch: option.label || null,
        address: option.address || offer.address || null,
      });
      tx.set(`vouchers/${code}`, voucherDoc({ base, code, kind: 'MEMBERSHIP_ACTIVATION', maxRedemptions: 1, offer, now }));
      break;
    }
    case 'COURSE': {
      tx.set(`bookings/${order.id}`, {
        ...base,
        kind: 'ENROLMENT',
        status: 'CONFIRMED',
        cohort: option.label || null,
        startDate: option.startDate || null,
        schedule: option.schedule || offer.schedule || null,
        platform: offer.platform || 'Online',
        accessInstructions: offer.accessInstructions || 'Your instructor will email joining instructions 24 hours before the first class.',
        accessCode: code,
        attendance: [],
      });
      break;
    }
    case 'PROJECT': {
      const keys = offer.projectMilestones?.length ? offer.projectMilestones : PROJECT_MILESTONES.slice(0, 4).map((m) => m.key);
      tx.set(`bookings/${order.id}`, {
        ...base,
        kind: 'PROJECT',
        status: 'CONFIRMED',
        projectDetails: order.fulfilmentDetails || {},
        milestones: PROJECT_MILESTONES.filter((m) => keys.includes(m.key)).map((m) => ({ ...m, status: 'PENDING', note: '', at: null })),
        quotations: [],
        changeRequests: [],
        caseRef: `PRJ-${code.slice(0, 6)}`,
      });
      break;
    }
    case 'APPOINTMENT':
    case 'VOUCHER': {
      const sessions = option.sessions || offer.sessions || 1;
      tx.set(`bookings/${order.id}`, {
        ...base,
        kind: offer.fulfilment,
        status: 'CONFIRMED',
        sessionsTotal: sessions,
        sessionsUsed: 0,
        slots: [],
        voucherCode: code,
        validTo: new Date(now.getTime() + (offer.voucherValidityDays || 90) * 864e5).toISOString(),
      });
      tx.set(`vouchers/${code}`, voucherDoc({ base, code, kind: offer.fulfilment, maxRedemptions: sessions, offer, now }));
      break;
    }
    default:
      // PRODUCT: individual order; the merchant creates the shipment (AWB) next — BRD §7.3.
      break;
  }
}

function voucherDoc({ base, code, kind, maxRedemptions, offer, now }) {
  return {
    id: code,
    code,
    kind,
    bookingId: base.orderId,
    orderId: base.orderId,
    uid: base.uid,
    customerName: base.customerName,
    merchantId: base.merchantId,
    offerId: base.offerId,
    offerTitle: base.offerTitle,
    optionLabel: base.optionLabel,
    maxRedemptions,
    redemptions: [],
    status: 'ISSUED',
    validTo: new Date(now.getTime() + (offer.voucherValidityDays || 90) * 864e5).toISOString(),
    createdAt: nowISO(now),
  };
}
