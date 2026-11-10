/**
 * Customer account, post-purchase and support operations — BRD §7.1, §7.4, §8.3.
 */
import { CASE_TYPES, ROLES, TICKET_CATEGORIES } from '../constants.js';
import { cancellationRefund, randomCode, round2 } from '../pricing.js';
import {
  adjustOfferCounters,
  fail,
  firstName,
  isStaff,
  loadActor,
  notify,
  nowISO,
  refundWrite,
  requireAuth,
  sanitizeText,
  timelineEntry,
} from './core.js';

const DEFAULT_PREFS = { inSite: true, email: true, sms: false, whatsapp: false, marketing: false };

/** Creates the caller's profile on first sign-in (role is server-controlled). */
export async function ensureProfile(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const existing = await tx.get(`users/${ctx.uid}`);
    if (existing) return { profile: existing, created: false };
    const adminEmails = (env.adminEmails || []).map((e) => e.toLowerCase());
    const role = ctx.email && adminEmails.includes(ctx.email.toLowerCase()) ? ROLES.ADMIN : ROLES.CUSTOMER;
    const profile = {
      uid: ctx.uid,
      displayName: sanitizeText(data?.displayName || ctx.displayName || (ctx.email ? ctx.email.split('@')[0] : 'JodoDeal member'), 80),
      email: ctx.email || null,
      phone: ctx.phone || sanitizeText(data?.phone, 15) || null,
      city: sanitizeText(data?.city, 40) || null,
      role,
      merchantId: null,
      status: 'ACTIVE',
      referralCode: randomCode(7),
      addresses: [],
      notificationPrefs: DEFAULT_PREFS,
      createdAt: nowISO(now),
    };
    tx.set(`users/${ctx.uid}`, profile);
    return { profile, created: true };
  });
}

export async function updateProfile(ctx, data, store) {
  requireAuth(ctx);
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const patch = {};
    if (data.displayName !== undefined) patch.displayName = sanitizeText(data.displayName, 80) || user.displayName;
    if (data.phone !== undefined) {
      const phone = sanitizeText(data.phone, 15);
      if (phone && !/^\+?\d{10,13}$/.test(phone.replace(/\s/g, ''))) fail('invalid-argument', 'Please enter a valid mobile number.');
      patch.phone = phone;
    }
    if (data.city !== undefined) patch.city = sanitizeText(data.city, 40);
    if (Array.isArray(data.addresses)) {
      patch.addresses = data.addresses.slice(0, 10).map((a, i) => {
        if (a.pincode && !/^\d{6}$/.test(String(a.pincode))) fail('invalid-argument', 'PIN code must be 6 digits.');
        return {
          id: a.id || `addr${i}${Date.now() % 100000}`,
          label: sanitizeText(a.label, 30) || 'Home',
          name: sanitizeText(a.name, 80),
          line1: sanitizeText(a.line1, 160),
          line2: sanitizeText(a.line2, 160),
          city: sanitizeText(a.city, 60),
          state: sanitizeText(a.state, 60),
          pincode: String(a.pincode || ''),
          phone: sanitizeText(a.phone, 15),
          kind: a.kind === 'SERVICE' ? 'SERVICE' : 'DELIVERY',
        };
      });
    }
    if (data.notificationPrefs) {
      const p = data.notificationPrefs;
      patch.notificationPrefs = { inSite: true, email: !!p.email, sms: !!p.sms, whatsapp: !!p.whatsapp, marketing: !!p.marketing, consentAt: nowISO() };
    }
    if (Array.isArray(data.interests)) patch.interests = data.interests.map((x) => sanitizeText(x, 40)).filter(Boolean).slice(0, 14);
    if (data.onboarded) patch.onboardedAt = user.onboardedAt || nowISO();
    tx.update(`users/${ctx.uid}`, patch);
    return { profile: { ...user, ...patch } };
  });
}

/** Opt in / out of a group extension. Declining refunds immediately (BRD §8.2). */
export async function respondToExtension(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const order = await tx.get(`orders/${data.orderId}`);
    if (!order || order.uid !== ctx.uid) fail('not-found', 'Order not found.');
    if (order.extensionConsent !== 'PENDING') fail('failed-precondition', 'No extension decision is pending for this order.');
    const group = await tx.get(`groups/${order.groupId}`);
    const offer = await tx.get(`offers/${order.offerId}`);
    const payment = await tx.get(`payments/${order.paymentId}`);
    if (data.accept) {
      tx.update(`orders/${order.id}`, { extensionConsent: 'ACCEPTED', timeline: [...(order.timeline || []), timelineEntry('EXTENSION_ACCEPTED', 'You opted in to the extended deadline', now)] });
      return { ok: true, accepted: true };
    }
    refundWrite(tx, { payment, order, amount: order.amountPaid, reason: 'EXTENSION_DECLINED', now });
    tx.update(`orders/${order.id}`, { extensionConsent: 'DECLINED', status: 'REFUNDED', timeline: [...(order.timeline || []), timelineEntry('REFUND_INITIATED', 'You declined the extension — full refund initiated', now)] });
    tx.update(`groups/${group.id}/members/${ctx.uid}`, { status: 'REFUNDED' });
    tx.update(`groups/${group.id}`, { paidCount: Math.max(0, (group.paidCount || 0) - 1) });
    const patch = adjustOfferCounters(offer, order.optionId, { used: -order.quantity });
    tx.update(`offers/${offer.id}`, { options: patch.options, used: patch.used });
    return { ok: true, accepted: false };
  });
}

/**
 * Customer cancellation. Before group confirmation → instant full refund.
 * After confirmation → a case with the policy-calculated refund for provider/admin review.
 * Never alters other members' confirmed prices or bookings (AC-11).
 */
export async function requestCancellation(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const reason = sanitizeText(data.reason, 500);
  if (!reason) fail('invalid-argument', 'Please tell us why you want to cancel.');
  return store.runTransaction(async (tx) => {
    const order = await tx.get(`orders/${data.orderId}`);
    if (!order || order.uid !== ctx.uid) fail('not-found', 'Order not found.');
    const offer = await tx.get(`offers/${order.offerId}`);
    const group = await tx.get(`groups/${order.groupId}`);
    const payment = await tx.get(`payments/${order.paymentId}`);
    const booking = order.kind === 'PRODUCT' ? null : await tx.get(`bookings/${order.id}`);
    if (['CANCELLED', 'REFUNDED', 'CANCELLATION_REQUESTED', 'RETURN_REQUESTED', 'COMPLETED'].includes(order.status)) {
      fail('failed-precondition', 'This order cannot be cancelled now.');
    }
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) fail('failed-precondition', 'This order has shipped — please request a return instead.');

    const consumed = !!booking && ((booking.sessionsUsed || 0) > 0 || booking.status === 'ACTIVE' && booking.kind === 'MEMBERSHIP' && !!booking.firstVisitAt || (booking.attendance || []).length > 0 || (booking.milestones || []).some((m) => m.status === 'DONE' && m.key !== 'CONSULTATION'));
    const calc = cancellationRefund({ order: { ...order, consumed }, offer, now });

    if (order.status === 'AWAITING_GROUP') {
      refundWrite(tx, { payment, order, amount: calc.amount, reason: 'CUSTOMER_CANCELLATION', note: reason, now });
      tx.update(`orders/${order.id}`, { status: 'REFUNDED', cancelReason: reason, timeline: [...(order.timeline || []), timelineEntry('CANCELLED', `${calc.explanation}`, now)] });
      tx.update(`groups/${group.id}/members/${ctx.uid}`, { status: 'CANCELLED' });
      tx.update(`groups/${group.id}`, { paidCount: Math.max(0, (group.paidCount || 0) - 1) });
      const patch = adjustOfferCounters(offer, order.optionId, { used: -order.quantity });
      tx.update(`offers/${offer.id}`, { options: patch.options, used: patch.used, stats: { ...(offer.stats || {}), cancellations: (offer.stats?.cancellations || 0) + 1 } });
      return { ok: true, instant: true, refund: calc };
    }

    const caseId = store.newId('case');
    tx.set(`cases/${caseId}`, {
      id: caseId,
      type: 'CANCELLATION',
      typeLabel: CASE_TYPES.CANCELLATION,
      orderId: order.id,
      offerId: order.offerId,
      offerTitle: order.offerTitle,
      groupId: order.groupId,
      merchantId: order.merchantId,
      uid: ctx.uid,
      reason,
      reasonCode: sanitizeText(data.reasonCode, 40) || 'CHANGED_MIND',
      proposedRefund: calc.amount,
      refundExplanation: calc.explanation,
      prevStatus: order.status,
      status: 'OPEN',
      createdAt: nowISO(now),
      timeline: [timelineEntry('OPEN', `Customer requested cancellation: ${reason}`, now)],
    });
    tx.update(`orders/${order.id}`, { status: 'CANCELLATION_REQUESTED', prevStatus: order.status, openCaseId: caseId, timeline: [...(order.timeline || []), timelineEntry('CANCELLATION_REQUESTED', calc.explanation, now)] });
    notify(tx, store, { uid: ctx.uid, title: 'Cancellation request received', body: `Estimated refund ₹${calc.amount}. ${calc.explanation}`, link: `/account/orders/${order.id}`, now });
    return { ok: true, instant: false, caseId, refund: calc };
  });
}

/** Product return / replacement request per item (BRD §7.3, §8.3). */
export async function requestReturn(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const reason = sanitizeText(data.reason, 500);
  if (!reason) fail('invalid-argument', 'Please describe the issue.');
  return store.runTransaction(async (tx) => {
    const order = await tx.get(`orders/${data.orderId}`);
    if (!order || order.uid !== ctx.uid) fail('not-found', 'Order not found.');
    const offer = await tx.get(`offers/${order.offerId}`);
    if (order.kind !== 'PRODUCT' || order.status !== 'DELIVERED') fail('failed-precondition', 'Returns can be requested for delivered products.');
    const windowDays = offer?.returnWindowDays ?? 7;
    if (order.deliveredAt && (now - new Date(order.deliveredAt)) / 864e5 > windowDays) {
      fail('failed-precondition', `The ${windowDays}-day return window has closed. Please raise a support ticket if the item is defective.`);
    }
    const caseId = store.newId('case');
    tx.set(`cases/${caseId}`, {
      id: caseId,
      type: 'RETURN',
      typeLabel: CASE_TYPES.RETURN,
      orderId: order.id,
      offerId: order.offerId,
      offerTitle: order.offerTitle,
      groupId: order.groupId,
      merchantId: order.merchantId,
      uid: ctx.uid,
      reason,
      reasonCode: sanitizeText(data.reasonCode, 40) || 'DEFECTIVE',
      resolution: data.resolution === 'REPLACEMENT' ? 'REPLACEMENT' : 'REFUND',
      evidenceUrls: (data.evidenceUrls || []).slice(0, 5),
      proposedRefund: order.amountPaid,
      refundExplanation: 'Full refund to your original payment method after the reverse pickup is verified.',
      prevStatus: order.status,
      status: 'OPEN',
      createdAt: nowISO(now),
      timeline: [timelineEntry('OPEN', `Return requested: ${reason}`, now)],
    });
    tx.update(`orders/${order.id}`, { status: 'RETURN_REQUESTED', prevStatus: order.status, openCaseId: caseId, timeline: [...(order.timeline || []), timelineEntry('RETURN_REQUESTED', reason, now)] });
    return { ok: true, caseId };
  });
}

/** Customer reschedules an appointment/consultation slot — partial fulfilment (BRD §6.4). */
export async function rescheduleBooking(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const slot = sanitizeText(data.slot, 40);
  if (!slot || Number.isNaN(new Date(slot).getTime())) fail('invalid-argument', 'Please choose a valid date and time.');
  if (new Date(slot) < now) fail('invalid-argument', 'Please choose a future slot.');
  return store.runTransaction(async (tx) => {
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking || booking.uid !== ctx.uid) fail('not-found', 'Booking not found.');
    if (['CANCELLED', 'COMPLETED', 'PROVIDER_CANCELLED'].includes(booking.status)) fail('failed-precondition', 'This booking cannot be rescheduled.');
    const slots = [...(booking.slots || [])];
    const pending = slots.findIndex((s) => s.status === 'REQUESTED' || s.status === 'SCHEDULED');
    const entry = { at: new Date(slot).toISOString(), status: 'REQUESTED', requestedBy: 'customer', note: sanitizeText(data.note, 200) };
    if (pending >= 0) slots[pending] = { ...slots[pending], ...entry, rescheduled: true };
    else slots.push(entry);
    tx.update(`bookings/${booking.id}`, { slots, updatedAt: nowISO(now) });
    notify(tx, store, { uid: ctx.uid, title: 'Slot request sent', body: `We asked ${booking.merchantName} to confirm ${new Date(slot).toLocaleString('en-IN')}.`, link: `/account/orders/${booking.orderId}`, now });
    return { ok: true };
  });
}

/** Customer accepts or declines an itemised quotation (BRD §6.3). */
export async function respondQuotation(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking || booking.uid !== ctx.uid) fail('not-found', 'Project not found.');
    const quotations = (booking.quotations || []).map((q) => {
      if (q.id !== data.quotationId) return q;
      if (q.status !== 'ISSUED') fail('failed-precondition', 'This quotation has already been answered.');
      return { ...q, status: data.accept ? 'ACCEPTED' : 'DECLINED', respondedAt: nowISO(now), customerNote: sanitizeText(data.note, 300) };
    });
    const milestones = (booking.milestones || []).map((m) => (m.key === 'SCOPE_ACCEPTED' && data.accept ? { ...m, status: 'DONE', at: nowISO(now), note: 'Customer accepted quotation' } : m));
    tx.update(`bookings/${booking.id}`, { quotations, milestones, status: data.accept ? 'IN_PROGRESS' : booking.status });
    return { ok: true };
  });
}

/** Either party records a change request on a project, preserving scope evidence. */
export async function addChangeRequest(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking) fail('not-found', 'Project not found.');
    const isOwner = booking.uid === ctx.uid;
    const isMerchant = user.role === ROLES.MERCHANT && user.merchantId === booking.merchantId;
    if (!isOwner && !isMerchant && !isStaff(user)) fail('permission-denied', 'Not allowed.');
    const description = sanitizeText(data.description, 600);
    if (!description) fail('invalid-argument', 'Describe the change.');
    const cr = { id: store.newId('cr'), description, costImpact: round2(Number(data.costImpact) || 0), raisedBy: isOwner ? 'customer' : 'provider', status: 'OPEN', at: nowISO(now) };
    tx.update(`bookings/${booking.id}`, { changeRequests: [...(booking.changeRequests || []), cr] });
    return { ok: true, changeRequest: cr };
  });
}

/** Customer signs off the handover milestone. */
export async function signOffProject(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  return store.runTransaction(async (tx) => {
    const booking = await tx.get(`bookings/${data.bookingId}`);
    if (!booking || booking.uid !== ctx.uid) fail('not-found', 'Project not found.');
    const order = await tx.get(`orders/${booking.orderId}`);
    const milestones = (booking.milestones || []).map((m) => (m.status === 'DONE' ? m : { ...m, status: 'DONE', at: nowISO(now), note: m.key === 'HANDOVER' ? 'Customer signed off' : m.note || 'Closed at sign-off' }));
    tx.update(`bookings/${booking.id}`, { milestones, status: 'COMPLETED', signedOffAt: nowISO(now) });
    tx.update(`orders/${order.id}`, { status: 'COMPLETED', timeline: [...(order.timeline || []), timelineEntry('COMPLETED', 'Customer signed off the project', now)] });
    return { ok: true };
  });
}

/** Authentic reviews only — one per real, fulfilled purchase (BRD §8.4). */
export async function addReview(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const rating = Math.round(Number(data.rating));
  if (!(rating >= 1 && rating <= 5)) fail('invalid-argument', 'Rating must be 1–5 stars.');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const order = await tx.get(`orders/${data.orderId}`);
    if (!order || order.uid !== ctx.uid) fail('not-found', 'Order not found.');
    if (!['CONFIRMED', 'ACTIVE', 'DELIVERED', 'COMPLETED', 'SHIPPED'].includes(order.status)) fail('failed-precondition', 'You can review after your purchase is confirmed.');
    const existing = await tx.get(`reviews/${order.id}`);
    if (existing) fail('already-exists', 'You have already reviewed this purchase.');
    const offer = await tx.get(`offers/${order.offerId}`);
    const merchant = await tx.get(`merchants/${order.merchantId}`);
    tx.set(`reviews/${order.id}`, {
      id: order.id,
      offerId: order.offerId,
      merchantId: order.merchantId,
      uid: ctx.uid,
      authorName: firstName(user.displayName),
      rating,
      comment: sanitizeText(data.comment, 1000),
      verifiedPurchase: true,
      createdAt: nowISO(now),
    });
    const oc = offer.ratingCount || 0;
    tx.update(`offers/${offer.id}`, { ratingCount: oc + 1, rating: round2(((offer.rating || 0) * oc + rating) / (oc + 1)) });
    if (merchant) {
      const mc = merchant.ratingCount || 0;
      tx.update(`merchants/${merchant.id}`, { ratingCount: mc + 1, rating: round2(((merchant.rating || 0) * mc + rating) / (mc + 1)) });
    }
    return { ok: true };
  });
}

export async function createTicket(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const subject = sanitizeText(data.subject, 140);
  const message = sanitizeText(data.message, 2000);
  if (!subject || !message) fail('invalid-argument', 'Please add a subject and describe the issue.');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    let merchantId = null;
    if (data.orderId) {
      const order = await tx.get(`orders/${data.orderId}`);
      if (!order || order.uid !== ctx.uid) fail('not-found', 'Order not found.');
      merchantId = order.merchantId;
    }
    const id = store.newId('tkt');
    const ticket = {
      id,
      ref: `JD-${randomCode(6)}`,
      uid: ctx.uid,
      customerName: user.displayName,
      category: TICKET_CATEGORIES[data.category] ? data.category : 'OTHER',
      subject,
      orderId: data.orderId || null,
      merchantId,
      priority: ['PAYMENT', 'PROVIDER'].includes(data.category) ? 'HIGH' : 'NORMAL',
      status: 'OPEN',
      messages: [{ from: 'customer', name: firstName(user.displayName), text: message, at: nowISO(now) }],
      createdAt: nowISO(now),
      updatedAt: nowISO(now),
    };
    tx.set(`tickets/${id}`, ticket);
    notify(tx, store, { uid: ctx.uid, title: `Ticket ${ticket.ref} created`, body: 'Our support team will respond within 24 hours.', link: '/account/support', now });
    return { ticketId: id, ref: ticket.ref };
  });
}

export async function replyTicket(ctx, data, store, env = {}) {
  requireAuth(ctx);
  const now = env.now ? new Date(env.now) : new Date();
  const text = sanitizeText(data.message, 2000);
  if (!text) fail('invalid-argument', 'Message cannot be empty.');
  return store.runTransaction(async (tx) => {
    const user = await loadActor(tx, ctx);
    const ticket = await tx.get(`tickets/${data.ticketId}`);
    if (!ticket) fail('not-found', 'Ticket not found.');
    const staff = isStaff(user);
    if (!staff && ticket.uid !== ctx.uid) fail('permission-denied', 'Not allowed.');
    const status = staff ? data.status || (ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status) : ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status;
    tx.update(`tickets/${ticket.id}`, {
      messages: [...(ticket.messages || []), { from: staff ? 'support' : 'customer', name: staff ? 'JodoDeal Support' : firstName(user.displayName), text, at: nowISO(now) }],
      status,
      updatedAt: nowISO(now),
    });
    if (staff) notify(tx, store, { uid: ticket.uid, title: `Update on ${ticket.ref}`, body: text.slice(0, 120), link: '/account/support', now });
    return { ok: true };
  });
}

/** Share & view tracking for analytics and the viral loop (BRD §7.2, §16.2). */
export async function trackShare(ctx, data, store) {
  return store.runTransaction(async (tx) => {
    const offer = await tx.get(`offers/${data.offerId}`);
    const group = data.groupId ? await tx.get(`groups/${data.groupId}`) : null;
    if (!offer) return { ok: false };
    tx.update(`offers/${offer.id}`, { stats: { ...(offer.stats || {}), shares: (offer.stats?.shares || 0) + 1 } });
    if (group) tx.update(`groups/${group.id}`, { shares: (group.shares || 0) + 1 });
    return { ok: true };
  });
}

export async function trackView(ctx, data, store) {
  return store.runTransaction(async (tx) => {
    const offer = await tx.get(`offers/${data.offerId}`);
    if (!offer) return { ok: false };
    tx.update(`offers/${offer.id}`, { stats: { ...(offer.stats || {}), views: (offer.stats?.views || 0) + 1 } });
    return { ok: true };
  });
}

export async function markNotificationsRead(ctx, data, store) {
  requireAuth(ctx);
  return store.runTransaction(async (tx) => {
    const items = await tx.query('notifications', [['uid', '==', ctx.uid], ['read', '==', false]], { limit: 100 });
    const ids = data?.ids?.length ? new Set(data.ids) : null;
    items.filter((n) => !ids || ids.has(n.id)).forEach((n) => tx.update(`notifications/${n.id}`, { read: true }));
    return { ok: true };
  });
}
