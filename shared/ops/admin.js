/**
 * Admin, moderation, refunds and operations — BRD §7.6, §8.
 */
import { categoryById } from '../categories.js';
import { MERCHANT_STATUS, OFFER_STATUS, ROLES, GROUP_STATES } from '../constants.js';
import { round2 } from '../pricing.js';
import { buildGroup } from './groups.js';
import { adjustOfferCounters, audit, fail, loadActor, notify, nowISO, refundWrite, requireAdmin, requireStaff, sanitizeText, timelineEntry } from './core.js';
import { validateOffer } from './merchant.js';

export async function reviewMerchant(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireStaff(user, [ROLES.ADMIN, ROLES.OPERATIONS]);
    const merchant = await tx.get(`merchants/${data.merchantId}`);
    if (!merchant) fail('not-found', 'Merchant not found.');
    const offers = data.decision === 'SUSPEND' ? await tx.query('offers', [['merchantId', '==', merchant.id], ['status', '==', OFFER_STATUS.APPROVED]]) : [];
    const note = sanitizeText(data.note, 500);
    const map = { VERIFY: MERCHANT_STATUS.VERIFIED, REJECT: MERCHANT_STATUS.REJECTED, SUSPEND: MERCHANT_STATUS.SUSPENDED, REINSTATE: MERCHANT_STATUS.VERIFIED };
    const status = map[data.decision];
    if (!status) fail('invalid-argument', 'Unknown decision.');
    if (['REJECT', 'SUSPEND'].includes(data.decision) && !note) fail('invalid-argument', 'A note is required.');
    tx.update(`merchants/${merchant.id}`, { status, verified: status === MERCHANT_STATUS.VERIFIED, verifiedAt: status === MERCHANT_STATUS.VERIFIED ? nowISO(now) : merchant.verifiedAt || null, moderationNote: note });
    offers.forEach((o) => tx.update(`offers/${o.id}`, { status: OFFER_STATUS.PAUSED, moderationNote: 'Provider suspended' }));
    notify(tx, store, { uid: merchant.ownerUid, title: `Business ${status.toLowerCase().replace('_', ' ')}`, body: note || (status === 'VERIFIED' ? 'You can now submit offers for approval.' : ''), link: '/merchant', now });
    audit(tx, store, { actor: user, action: `MERCHANT_${data.decision}`, entity: 'merchant', entityId: merchant.id, note, now });
    return { ok: true };
  });
}

export async function reviewOffer(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireStaff(user, [ROLES.ADMIN, ROLES.OPERATIONS]);
    const offer = await tx.get(`offers/${data.offerId}`);
    if (!offer) fail('not-found', 'Offer not found.');
    const merchant = await tx.get(`merchants/${offer.merchantId}`);
    const existingGroups = await tx.query('groups', [['offerId', '==', offer.id]], { limit: 5 });
    const note = sanitizeText(data.note, 800);
    let status;
    if (data.decision === 'APPROVE') {
      if (merchant?.status !== MERCHANT_STATUS.VERIFIED) fail('failed-precondition', 'Provider must be verified before offers can go live.');
      const errors = validateOffer(offer);
      if (errors.length) fail('invalid-argument', errors.join(' '));
      status = OFFER_STATUS.APPROVED;
    } else if (data.decision === 'REJECT') status = OFFER_STATUS.REJECTED;
    else if (data.decision === 'REQUEST_CHANGES') status = OFFER_STATUS.CHANGES_REQUESTED;
    else fail('invalid-argument', 'Unknown decision.');
    if (status !== OFFER_STATUS.APPROVED && !note) fail('invalid-argument', 'Moderation feedback is required.');

    tx.update(`offers/${offer.id}`, { status, moderationNote: note, reviewedAt: nowISO(now), reviewedBy: user.displayName, merchantVerified: true, approvedAt: status === OFFER_STATUS.APPROVED ? nowISO(now) : offer.approvedAt || null });
    if (status === OFFER_STATUS.APPROVED && !existingGroups.some((g) => ['OPEN', 'TARGET_REACHED', 'CONFIRMED'].includes(g.state))) {
      // Seed a first open group so the deal is joinable immediately; customers can start more.
      const group = buildGroup({ offer: { ...offer, status }, store, now });
      tx.set(`groups/${group.id}`, group);
    }
    notify(tx, store, { uid: merchant?.ownerUid, title: `Offer ${status === 'APPROVED' ? 'approved 🎉' : status.toLowerCase().replace('_', ' ')}`, body: note || `${offer.title} is now live.`, link: '/merchant/offers', now });
    audit(tx, store, { actor: user, action: `OFFER_${data.decision}`, entity: 'offer', entityId: offer.id, note, now });
    return { ok: true };
  });
}

export async function updateCategory(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireAdmin(user);
    const existing = (await tx.get(`categories/${data.categoryId}`)) || categoryById(data.categoryId);
    if (!existing) fail('not-found', 'Category not found.');
    const p = data.patch || {};
    const patch = {
      commissionPct: p.commissionPct !== undefined ? round2(Math.min(50, Math.max(0, Number(p.commissionPct)))) : existing.commissionPct,
      platformFee: p.platformFee !== undefined ? round2(Math.max(0, Number(p.platformFee))) : existing.platformFee,
      active: p.active !== undefined ? !!p.active : existing.active,
      pilot: p.pilot !== undefined ? !!p.pilot : existing.pilot,
    };
    tx.set(`categories/${existing.id}`, { ...existing, ...patch, updatedAt: nowISO(now) });
    audit(tx, store, { actor: user, action: 'CATEGORY_UPDATED', entity: 'category', entityId: existing.id, data: patch, now });
    return { ok: true };
  });
}

/** Refund lifecycle to completion (BRD §8.2 "tracked to completion"). */
export async function processRefund(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireStaff(user, [ROLES.ADMIN, ROLES.OPERATIONS]);
    const refund = await tx.get(`refunds/${data.refundId}`);
    if (!refund) fail('not-found', 'Refund not found.');
    const next = { PROCESS: 'PROCESSING', COMPLETE: 'COMPLETED', FAIL: 'FAILED', RETRY: 'PROCESSING' }[data.action];
    if (!next) fail('invalid-argument', 'Unknown action.');
    const allowed = { INITIATED: ['PROCESSING', 'COMPLETED', 'FAILED'], PROCESSING: ['COMPLETED', 'FAILED'], FAILED: ['PROCESSING'], COMPLETED: [] };
    if (!allowed[refund.status]?.includes(next)) fail('failed-precondition', `Refund is ${refund.status}.`);
    const patch = { status: next, timeline: [...(refund.timeline || []), timelineEntry(next, sanitizeText(data.note, 300), now)] };
    if (next === 'COMPLETED') {
      patch.completedAt = nowISO(now);
      patch.gatewayRefundRef = `RFND${refund.id.slice(-8).toUpperCase()}`;
      patch.resolutionHours = round2((now - new Date(refund.createdAt)) / 36e5);
    }
    tx.update(`refunds/${refund.id}`, patch);
    if (next === 'COMPLETED') notify(tx, store, { uid: refund.uid, title: 'Refund completed 💸', body: `₹${refund.amount} has been credited to your original payment method.`, link: '/account/refunds', kind: 'success', now });
    audit(tx, store, { actor: user, action: `REFUND_${next}`, entity: 'refund', entityId: refund.id, note: `₹${refund.amount}`, now });
    return { ok: true };
  });
}

/** Admin cancels a whole group (e.g. provider cannot fulfil) — every member refunded. */
export async function cancelGroup(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  const reason = sanitizeText(data.reason, 400);
  if (!reason) fail('invalid-argument', 'A reason is required.');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireStaff(user, [ROLES.ADMIN, ROLES.OPERATIONS]);
    const group = await tx.get(`groups/${data.groupId}`);
    if (!group) fail('not-found', 'Group not found.');
    if (['CANCELLED', 'EXPIRED_FAILED', 'COMPLETED'].includes(group.state)) fail('failed-precondition', 'Group already closed.');
    const offer = await tx.get(`offers/${group.offerId}`);
    const orders = (await tx.query('orders', [['groupId', '==', group.id]])).filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status));
    const payments = await Promise.all(orders.map((o) => tx.get(`payments/${o.paymentId}`)));
    let offerPatch = { ...offer };
    orders.forEach((o, i) => {
      if (payments[i]) refundWrite(tx, { payment: payments[i], order: o, amount: o.amountPaid, reason: 'ADMIN', note: reason, now });
      tx.update(`orders/${o.id}`, { status: 'REFUNDED', timeline: [...(o.timeline || []), timelineEntry('CANCELLED', `Group cancelled by JodoDeal: ${reason}`, now)] });
      offerPatch = { ...offerPatch, ...adjustOfferCounters(offerPatch, o.optionId, { used: -o.quantity }) };
      notify(tx, store, { uid: o.uid, title: 'Group cancelled — full refund', body: `${group.offerTitle}: ${reason}. ₹${o.amountPaid} is being refunded.`, link: '/account/refunds', kind: 'error', now });
    });
    tx.update(`offers/${offer.id}`, { options: offerPatch.options, used: offerPatch.used });
    tx.update(`groups/${group.id}`, { state: GROUP_STATES.CANCELLED, cancelledAt: nowISO(now), stateHistory: [...(group.stateHistory || []), timelineEntry(GROUP_STATES.CANCELLED, reason, now)] });
    audit(tx, store, { actor: user, action: 'GROUP_CANCELLED', entity: 'group', entityId: group.id, note: `${reason} — ${orders.length} refunds`, now });
    return { ok: true, refunds: orders.length };
  });
}

export async function setUserRole(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireAdmin(user);
    const target = await tx.get(`users/${data.uid}`);
    if (!target) fail('not-found', 'User not found.');
    const patch = {};
    if (data.role) {
      if (!Object.values(ROLES).includes(data.role) || data.role === 'guest') fail('invalid-argument', 'Invalid role.');
      if (data.role === ROLES.MERCHANT && !target.merchantId) fail('failed-precondition', 'User has no merchant profile.');
      patch.role = data.role;
    }
    if (data.status) patch.status = data.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    tx.update(`users/${target.uid}`, patch);
    audit(tx, store, { actor: user, action: 'USER_UPDATED', entity: 'user', entityId: target.uid, data: patch, now });
    return { ok: true };
  });
}

export async function updateTicket(ctx, data, store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    requireStaff(user);
    const ticket = await tx.get(`tickets/${data.ticketId}`);
    if (!ticket) fail('not-found', 'Ticket not found.');
    const patch = { updatedAt: nowISO(now) };
    if (data.status) patch.status = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'].includes(data.status) ? data.status : ticket.status;
    if (data.priority) patch.priority = data.priority === 'HIGH' ? 'HIGH' : 'NORMAL';
    tx.update(`tickets/${ticket.id}`, patch);
    audit(tx, store, { actor: user, action: 'TICKET_UPDATED', entity: 'ticket', entityId: ticket.id, data: patch, now });
    return { ok: true };
  });
}
