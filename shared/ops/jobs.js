/**
 * Scheduled background jobs — group expiry, failure handling, hold release,
 * extension consent timeouts, price-drop refunds and completion (BRD §5.1, §8.2).
 * Run every few minutes by Cloud Scheduler (functions) or on an interval in demo mode.
 */
import { EXTENSION_CONSENT_HOURS, GROUP_STATES } from '../constants.js';
import { addHours, assertTransition, priceAtCount, round2 } from '../pricing.js';
import { adjustOfferCounters, audit, notify, nowISO, refundWrite, timelineEntry } from './core.js';
import { releaseHold } from './groups.js';

const TERMINAL_ORDER = ['CANCELLED', 'REFUNDED', 'COMPLETED', 'DELIVERED'];

export async function runScheduledJobs(store, env = {}) {
  const now = env.now ? new Date(env.now) : new Date();
  const iso = now.toISOString();
  const summary = { holdsReleased: 0, groupsFailed: 0, groupsExtended: 0, consentRefunds: 0, groupsClosed: 0, groupsCompleted: 0 };

  // 1. Release expired seat/slot reservations.
  const holds = await store.runTransaction((tx) => tx.query('payments', [['status', '==', 'CREATED'], ['expiresAt', '<', iso]], { limit: 200 }));
  for (const h of holds) {
    await store.runTransaction(async (tx) => {
      const payment = await tx.get(`payments/${h.id}`);
      if (!payment || payment.status !== 'CREATED') return;
      const offer = await tx.get(`offers/${payment.offerId}`);
      const group = await tx.get(`groups/${payment.groupId}`);
      releaseHold(tx, { payment, offer, group, status: 'EXPIRED', now });
      summary.holdsReleased += 1;
    });
  }

  // 2. Groups past deadline without reaching target.
  const failing = await store.runTransaction((tx) => tx.query('groups', [['state', '==', 'OPEN'], ['deadline', '<', iso]], { limit: 100 }));
  for (const g of failing) {
    await store.runTransaction(async (tx) => {
      const group = await tx.get(`groups/${g.id}`);
      if (!group || group.state !== 'OPEN' || new Date(group.deadline) > now) return;
      const offer = await tx.get(`offers/${group.offerId}`);
      const orders = await tx.query('orders', [['groupId', '==', group.id], ['status', '==', 'AWAITING_GROUP']]);
      const payments = await Promise.all(orders.map((o) => tx.get(`payments/${o.paymentId}`)));

      if (group.failurePolicy === 'EXTEND_WITH_CONSENT' && !group.extensionUsed && orders.length > 0) {
        const extHours = offer?.extensionHours || 72;
        tx.update(`groups/${group.id}`, {
          deadline: addHours(now, extHours).toISOString(),
          extensionUsed: true,
          consentDeadline: addHours(now, EXTENSION_CONSENT_HOURS).toISOString(),
          consentProcessed: false,
          stateHistory: [...(group.stateHistory || []), timelineEntry('OPEN', `Target missed — extension of ${extHours}h offered; members must opt in`, now)],
        });
        for (const o of orders) {
          tx.update(`orders/${o.id}`, { extensionConsent: 'PENDING', timeline: [...(o.timeline || []), timelineEntry('EXTENSION_OFFERED', 'Group missed its target. Opt in to the extension or get a full refund.', now)] });
          notify(tx, store, { uid: o.uid, title: 'Your group needs more time', body: `${group.offerTitle} missed its target. Opt in within ${EXTENSION_CONSENT_HOURS}h to stay in the extended group — otherwise you get a full refund.`, link: `/account/orders/${o.id}`, kind: 'warning', now });
        }
        summary.groupsExtended += 1;
        return;
      }

      assertTransition(GROUP_STATES.OPEN, GROUP_STATES.EXPIRED_FAILED);
      tx.update(`groups/${group.id}`, {
        state: GROUP_STATES.EXPIRED_FAILED,
        failedAt: nowISO(now),
        stateHistory: [...(group.stateHistory || []), timelineEntry(GROUP_STATES.EXPIRED_FAILED, `Only ${group.paidCount}/${group.minGroupSize} members by the deadline — automatic refunds initiated`, now)],
      });
      let offerPatch = offer ? { ...offer } : null;
      orders.forEach((o, i) => {
        const payment = payments[i];
        if (payment) refundWrite(tx, { payment, order: o, amount: o.amountPaid, reason: 'GROUP_FAILED', now });
        tx.update(`orders/${o.id}`, { status: 'REFUNDED', timeline: [...(o.timeline || []), timelineEntry('REFUND_INITIATED', 'Group did not reach its target — full refund initiated', now)] });
        tx.update(`groups/${group.id}/members/${o.uid}`, { status: 'REFUNDED' });
        if (offerPatch) offerPatch = { ...offerPatch, ...adjustOfferCounters(offerPatch, o.optionId, { used: -o.quantity }) };
        notify(tx, store, { uid: o.uid, title: 'Group expired — refund on the way', body: `${group.offerTitle} did not reach ${group.minGroupSize} members in time. ₹${o.amountPaid} is being refunded to your original payment method.`, link: '/account/refunds', kind: 'warning', now });
      });
      if (offerPatch) tx.update(`offers/${offer.id}`, { options: offerPatch.options, used: offerPatch.used });
      audit(tx, store, { action: 'GROUP_EXPIRED_FAILED', entity: 'group', entityId: group.id, note: `${orders.length} refunds initiated`, now });
      summary.groupsFailed += 1;
    });
  }

  // 3. Extension consent windows that have closed — never assume acceptance.
  const consentDue = await store.runTransaction((tx) => tx.query('groups', [['consentProcessed', '==', false], ['consentDeadline', '<', iso]], { limit: 100 }));
  for (const g of consentDue) {
    summary.consentRefunds += await store.runTransaction(async (tx) => {
      const group = await tx.get(`groups/${g.id}`);
      if (!group || group.consentProcessed) return 0;
      const offer = await tx.get(`offers/${group.offerId}`);
      const orders = await tx.query('orders', [['groupId', '==', group.id], ['extensionConsent', '==', 'PENDING']]);
      const payments = await Promise.all(orders.map((o) => tx.get(`payments/${o.paymentId}`)));
      let offerPatch = offer ? { ...offer } : null;
      orders.forEach((o, i) => {
        if (payments[i]) refundWrite(tx, { payment: payments[i], order: o, amount: o.amountPaid, reason: 'EXTENSION_DECLINED', note: 'No consent received for extension', now });
        tx.update(`orders/${o.id}`, { status: 'REFUNDED', extensionConsent: 'NO_RESPONSE', timeline: [...(o.timeline || []), timelineEntry('REFUND_INITIATED', 'No opt-in received for the extension — full refund', now)] });
        tx.update(`groups/${group.id}/members/${o.uid}`, { status: 'REFUNDED' });
        if (offerPatch) offerPatch = { ...offerPatch, ...adjustOfferCounters(offerPatch, o.optionId, { used: -o.quantity }) };
      });
      tx.update(`groups/${group.id}`, { consentProcessed: true, paidCount: Math.max(0, (group.paidCount || 0) - orders.length) });
      if (offerPatch && orders.length) tx.update(`offers/${offer.id}`, { options: offerPatch.options, used: offerPatch.used });
      return orders.length;
    });
  }

  // 4. Confirmed groups past their deadline close; under ALL_MEMBERS pricing the best
  //    achieved tier is applied retroactively via price-drop refunds (never a surcharge).
  const closing = await store.runTransaction((tx) => tx.query('groups', [['state', '==', 'CONFIRMED'], ['deadline', '<', iso]], { limit: 100 }));
  for (const g of closing) {
    await store.runTransaction(async (tx) => {
      const group = await tx.get(`groups/${g.id}`);
      if (!group || group.state !== 'CONFIRMED') return;
      const orders = await tx.query('orders', [['groupId', '==', group.id]]);
      const live = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status));
      const payments = await Promise.all(live.map((o) => tx.get(`payments/${o.paymentId}`)));
      assertTransition(GROUP_STATES.CONFIRMED, GROUP_STATES.FULFILMENT_IN_PROGRESS);
      const finalTierPrice = priceAtCount({ mrp: group.mrp, tiers: group.tiers }, group.maxCountReached || group.paidCount);
      let refunds = 0;
      if (group.pricingRule === 'ALL_MEMBERS') {
        live.forEach((o, i) => {
          const optionDelta = round2((o.unitPrice || 0) - priceAtCount({ mrp: group.mrp, tiers: group.tiers }, o.memberPosition || 1));
          const finalUnit = finalTierPrice + optionDelta;
          const diffUnit = round2((o.unitPrice || 0) - finalUnit);
          if (diffUnit > 0 && payments[i]) {
            const gstRate = o.breakdown?.gstRate ?? 0;
            const amount = round2(diffUnit * (o.quantity || 1) * (1 + gstRate / 100));
            refundWrite(tx, { payment: payments[i], order: o, amount, reason: 'TIER_PRICE_DROP', note: `Final group price ₹${finalUnit} (you paid ₹${o.unitPrice})`, now });
            tx.update(`orders/${o.id}`, { priceDropRefund: amount, finalUnitPrice: finalUnit, timeline: [...(o.timeline || []), timelineEntry('PRICE_DROP_REFUND', `Better tier unlocked — ₹${amount} refunded`, now)] });
            notify(tx, store, { uid: o.uid, title: 'You saved even more 💰', body: `${group.offerTitle} unlocked a lower tier. ₹${amount} is being refunded to you.`, link: '/account/refunds', kind: 'success', now });
            refunds += 1;
          }
        });
      }
      tx.update(`groups/${group.id}`, {
        state: GROUP_STATES.FULFILMENT_IN_PROGRESS,
        closedAt: nowISO(now),
        finalTierPrice,
        stateHistory: [...(group.stateHistory || []), timelineEntry(GROUP_STATES.FULFILMENT_IN_PROGRESS, `Group closed with ${group.paidCount} members${refunds ? ` — ${refunds} price-drop refunds` : ''}`, now)],
      });
      summary.groupsClosed += 1;
    });
  }

  // 5. Groups whose every order has finished fulfilment.
  const inProgress = await store.runTransaction((tx) => tx.query('groups', [['state', '==', 'FULFILMENT_IN_PROGRESS']], { limit: 100 }));
  for (const g of inProgress) {
    await store.runTransaction(async (tx) => {
      const group = await tx.get(`groups/${g.id}`);
      if (!group || group.state !== 'FULFILMENT_IN_PROGRESS') return;
      const orders = await tx.query('orders', [['groupId', '==', group.id]]);
      if (orders.length && orders.every((o) => TERMINAL_ORDER.includes(o.status))) {
        tx.update(`groups/${group.id}`, {
          state: GROUP_STATES.COMPLETED,
          completedAt: nowISO(now),
          stateHistory: [...(group.stateHistory || []), timelineEntry(GROUP_STATES.COMPLETED, 'All fulfilment complete', now)],
        });
        summary.groupsCompleted += 1;
      }
    });
  }
  return summary;
}
