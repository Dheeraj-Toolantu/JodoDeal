/**
 * Core helpers for business operations.
 *
 * Every operation is written once against a minimal transactional store interface so the
 * exact same rules run inside Firebase Cloud Functions (Firestore Admin SDK) and in the
 * browser demo backend. Store interface:
 *
 *   store.runTransaction(async (tx) => ...)
 *   store.newId(prefix?) -> string
 *   tx.get(path) -> doc | null           (path = 'collection/id' or nested)
 *   tx.query(collectionPath, [[field, op, value]...], { limit }) -> doc[]
 *   tx.set(path, data) / tx.update(path, patch) / tx.delete(path)
 *
 * Like Firestore, all reads in a transaction must happen before any writes.
 */
import { ROLES, STAFF_ROLES, REFUND_REASONS } from '../constants.js';
import { round2 } from '../pricing.js';

export class OpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const fail = (code, message) => {
  throw new OpError(code, message);
};

export const nowISO = (now) => (now ? new Date(now) : new Date()).toISOString();

export function requireAuth(ctx) {
  if (!ctx?.uid) fail('unauthenticated', 'Please sign in to continue.');
  return ctx.uid;
}

/** Loads the caller's profile (role is authoritative from the users collection). */
export async function loadActor(tx, ctx, { required = true } = {}) {
  requireAuth(ctx);
  const user = await tx.get(`users/${ctx.uid}`);
  if (!user && required) fail('failed-precondition', 'Your profile is not set up yet. Please sign in again.');
  return user;
}

export function isStaff(user) {
  return !!user && STAFF_ROLES.includes(user.role);
}

export function requireStaff(user, roles = STAFF_ROLES) {
  if (!user || !roles.includes(user.role)) fail('permission-denied', 'You do not have permission for this action.');
}

export function requireAdmin(user) {
  requireStaff(user, [ROLES.ADMIN]);
}

export function requireMerchant(user) {
  if (!user || user.role !== ROLES.MERCHANT || !user.merchantId) {
    fail('permission-denied', 'A merchant / provider account is required.');
  }
  return user.merchantId;
}

/** Merchant who owns the entity, or staff, may act on it. */
export function requireOwnerMerchantOrStaff(user, entity) {
  if (isStaff(user)) return;
  if (user?.role === ROLES.MERCHANT && user.merchantId && user.merchantId === entity.merchantId) return;
  fail('permission-denied', 'You do not have permission for this record.');
}

export function audit(tx, store, { actor, action, entity, entityId, note = '', data = null, now }) {
  const id = store.newId('aud');
  tx.set(`auditLogs/${id}`, {
    id,
    actorUid: actor?.uid || 'system',
    actorRole: actor?.role || 'system',
    actorName: actor?.displayName || 'System',
    action,
    entity,
    entityId,
    note,
    data,
    at: nowISO(now),
  });
}

export function notify(tx, store, { uid, title, body, link = '', kind = 'info', now }) {
  if (!uid) return;
  const id = store.newId('ntf');
  tx.set(`notifications/${id}`, {
    id,
    uid,
    title,
    body,
    link,
    kind,
    read: false,
    createdAt: nowISO(now),
    // Delivery over WhatsApp/SMS/email happens only via approved integrations and the
    // user's consented preferences (BRD §7.7) — see functions/src/notifications.js.
    delivery: 'PENDING',
  });
}

export function timelineEntry(status, note = '', now) {
  return { at: nowISO(now), status, note };
}

/**
 * Creates a refund record. The refund id is deterministic per payment + reason so duplicate
 * webhooks or retried jobs can never create duplicate refunds (AC-14).
 */
export function refundWrite(tx, { payment, order, amount, reason, note = '', now, suffix = '' }) {
  const id = `rf_${payment.id}_${reason}${suffix ? `_${suffix}` : ''}`;
  const refund = {
    id,
    paymentId: payment.id,
    orderId: order?.id || null,
    groupId: payment.groupId,
    offerId: payment.offerId,
    merchantId: payment.merchantId,
    uid: payment.uid,
    amount: round2(amount),
    reason,
    reasonLabel: REFUND_REASONS[reason] || reason,
    note,
    method: 'ORIGINAL_PAYMENT_METHOD',
    status: 'INITIATED',
    createdAt: nowISO(now),
    timeline: [timelineEntry('INITIATED', note || REFUND_REASONS[reason], now)],
  };
  tx.set(`refunds/${id}`, refund);
  return refund;
}

/** Returns a patched copy of the offer's options/capacity counters. */
export function adjustOfferCounters(offer, optionId, { held = 0, used = 0 }) {
  const options = (offer.options || []).map((o) =>
    o.id === optionId ? { ...o, held: Math.max(0, (o.held || 0) + held), used: Math.max(0, (o.used || 0) + used) } : o,
  );
  return {
    options,
    held: Math.max(0, (offer.held || 0) + held),
    used: Math.max(0, (offer.used || 0) + used),
  };
}

export function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || 'Member';
}

export function sanitizeText(value, max = 2000) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[<>]/g, '').trim().slice(0, max);
}
