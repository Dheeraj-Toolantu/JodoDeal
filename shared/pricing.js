/**
 * Group buying & tier pricing engine — BRD §5.
 * Pure functions: no I/O, fully unit-tested.
 */
import { GROUP_TRANSITIONS, JOINABLE_GROUP_STATES } from './constants.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Tiers sorted ascending by minMembers. */
export function sortTiers(tiers = []) {
  return [...tiers].sort((a, b) => a.minMembers - b.minMembers);
}

/** Index of the best tier unlocked at `count` confirmed members, or -1 if none. */
export function tierIndexForCount(tiers, count) {
  const sorted = sortTiers(tiers);
  let idx = -1;
  sorted.forEach((t, i) => {
    if (count >= t.minMembers) idx = i;
  });
  return idx;
}

/** Group price at `count` members (falls back to standard price / MRP). */
export function priceAtCount(offer, count) {
  const sorted = sortTiers(offer.tiers);
  const idx = tierIndexForCount(sorted, count);
  return idx >= 0 ? sorted[idx].price : offer.mrp;
}

/** Information about the next tier to unlock. */
export function nextTierInfo(offer, count) {
  const sorted = sortTiers(offer.tiers);
  const next = sorted.find((t) => t.minMembers > count);
  if (!next) return null;
  return { tier: next, membersNeeded: next.minMembers - count, saving: priceAtCount(offer, count) - next.price };
}

export function optionById(offer, optionId) {
  return (offer.options || []).find((o) => o.id === optionId) || null;
}

/**
 * Unit price for the next joiner of a group.
 * The joiner is member #(paidCount + 1); the tier for that position applies.
 */
export function joinUnitPrice(offer, group, optionId) {
  const position = (group?.paidCount || 0) + 1;
  const base = priceAtCount(offer, position);
  const option = optionById(offer, optionId);
  return round2(base + (option?.priceDelta || 0));
}

/** Full, disclosed price breakdown shown before payment (BRD §8.1, AC-15). */
export function priceBreakdown(offer, unitPrice, quantity = 1) {
  const qty = Math.max(1, Math.min(Number(quantity) || 1, offer.maxPerCustomer || 1));
  const subtotal = round2(unitPrice * qty);
  const gstRate = offer.gstRate ?? 18;
  const gst = round2((subtotal * gstRate) / 100);
  const deliveryFee = round2(offer.deliveryFee || 0);
  const visitFee = round2(offer.visitFee || 0);
  const platformFee = round2(offer.platformFee || 0);
  const total = round2(subtotal + gst + deliveryFee + visitFee + platformFee);
  const mrpSubtotal = round2((offer.mrp || unitPrice) * qty);
  const savings = round2(Math.max(0, mrpSubtotal - subtotal));
  return { unitPrice: round2(unitPrice), quantity: qty, subtotal, gstRate, gst, deliveryFee, visitFee, platformFee, total, mrpSubtotal, savings };
}

export function discountPct(mrp, price) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function canTransition(from, to) {
  return (GROUP_TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new Error(`Invalid group state transition ${from} → ${to}`);
  }
}

/** Remaining capacity for an option, counting confirmed + held (reserved) units. */
export function optionAvailability(option) {
  if (!option) return 0;
  const cap = Number(option.capacity ?? Infinity);
  return Math.max(0, cap - (option.used || 0) - (option.held || 0));
}

export function offerAvailability(offer) {
  const cap = Number(offer.capacity ?? Infinity);
  return Math.max(0, cap - (offer.used || 0) - (offer.held || 0));
}

/**
 * Why a customer cannot join right now, or null when they can.
 */
export function joinBlocker({ offer, group, optionId, now = new Date() }) {
  if (!offer || offer.status !== 'APPROVED') return 'This offer is not currently available.';
  if (!group) return 'Group not found.';
  if (!JOINABLE_GROUP_STATES.includes(group.state)) return 'This group is no longer accepting members.';
  if (new Date(group.deadline) <= now) return 'This group has passed its deadline.';
  if (group.maxMembers && (group.paidCount || 0) + (group.heldCount || 0) >= group.maxMembers) return 'This group is full.';
  if (offerAvailability(offer) <= 0) return 'The provider has no remaining capacity for this offer.';
  const option = optionById(offer, optionId);
  if ((offer.options || []).length && !option) return 'Please select an option.';
  if (option && optionAvailability(option) <= 0) return `${option.label} is sold out.`;
  return null;
}

export function groupProgress(group) {
  const pct = group?.minGroupSize ? Math.min(100, Math.round(((group.paidCount || 0) / group.minGroupSize) * 100)) : 0;
  return { pct, remaining: Math.max(0, (group?.minGroupSize || 0) - (group?.paidCount || 0)) };
}

/** Generate a human-friendly code (vouchers, share codes). */
export function randomCode(len = 8, rng = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i += 1) s += alphabet[Math.floor(rng() * alphabet.length)];
  return s;
}

export function addHours(date, hours) {
  return new Date(new Date(date).getTime() + hours * 3600 * 1000);
}

export function addDays(date, days) {
  return addHours(date, days * 24);
}

/** Refund calculation for service cancellation in plain language (BRD §8.3). */
export function cancellationRefund({ order, offer, now = new Date() }) {
  const paid = order.amountPaid || 0;
  if (order.status === 'AWAITING_GROUP') {
    return { amount: paid, pct: 100, explanation: 'The group is not confirmed yet, so you get a full refund.' };
  }
  const policy = offer?.cancellation || {};
  const confirmedAt = order.confirmedAt ? new Date(order.confirmedAt) : now;
  const hoursSince = (now - confirmedAt) / 36e5;
  if (order.consumed) {
    const pct = Math.max(0, policy.afterUsePct ?? 0);
    return { amount: round2((paid * pct) / 100), pct, explanation: `Service already started/used: ${pct}% refund as per the offer's cancellation terms.` };
  }
  if (hoursSince <= (policy.freeCancelHours ?? 48)) {
    return { amount: paid, pct: 100, explanation: `Cancelled within ${policy.freeCancelHours ?? 48} hours of confirmation: full refund.` };
  }
  const pct = Math.max(0, policy.lateCancelPct ?? 50);
  return { amount: round2((paid * pct) / 100), pct, explanation: `Cancelled after the free window: ${pct}% refund as per the offer's cancellation terms.` };
}
