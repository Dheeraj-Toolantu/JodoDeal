import { beforeEach, describe, expect, it } from 'vitest';
import { TERMS_VERSION } from '../shared/constants.js';
import { createMemoryStore } from '../shared/memoryStore.js';
import { handlePaymentEvent, operations, runScheduledJobs, validateOffer } from '../shared/operations.js';
import { joinUnitPrice, priceAtCount, priceBreakdown, tierIndexForCount } from '../shared/pricing.js';
import { buildOffers } from '../shared/seedData.js';

const now = new Date('2026-11-10T06:00:00Z');
const env = { now };
let store;
const run = (name, uid, data, e = env) => operations[name]({ uid }, data, store, e);

async function setup(offerIndex = 2, overrides = {}) {
  store = createMemoryStore();
  await store.runTransaction(async (tx) => {
    tx.set('users/admin', { uid: 'admin', role: 'admin', displayName: 'Admin' });
    tx.set('users/owner', { uid: 'owner', role: 'customer', displayName: 'Owner' });
    for (let i = 0; i < 12; i += 1) tx.set(`users/u${i}`, { uid: `u${i}`, role: 'customer', displayName: `User ${i}`, referralCode: `R${i}` });
  });
  const { merchantId } = await run('registerMerchant', 'owner', { businessName: 'Test Studio', categoryIds: ['yoga-wellness'], city: 'Pune', acceptAgreement: true });
  await run('reviewMerchant', 'admin', { merchantId, decision: 'VERIFY' });
  const def = { ...buildOffers(now)[offerIndex], ...overrides };
  const { offerId, errors } = await run('saveOffer', 'owner', def);
  expect(errors).toEqual([]);
  await run('submitOffer', 'owner', { offerId });
  await run('reviewOffer', 'admin', { offerId, decision: 'APPROVE' });
  const [group] = await store.queryDocs('groups', [['offerId', '==', offerId]]);
  const offer = await store.getDoc(`offers/${offerId}`);
  return { offerId, groupId: group.id, offer };
}

async function join(uid, groupId, offer, key = `key-${uid}-000`) {
  const { paymentId } = await run('startCheckout', uid, { groupId, optionId: offer.options[0].id, acceptedTerms: true, acceptedTermsVersion: TERMS_VERSION, idempotencyKey: key, fulfilmentDetails: {} });
  return { paymentId, ...(await run('confirmMockPayment', uid, { paymentId })) };
}

describe('pricing engine', () => {
  const offer = { mrp: 1000, tiers: [{ minMembers: 1, price: 900 }, { minMembers: 5, price: 800 }, { minMembers: 10, price: 700 }] };
  it('picks the best unlocked tier', () => {
    expect(tierIndexForCount(offer.tiers, 0)).toBe(-1);
    expect(priceAtCount(offer, 4)).toBe(900);
    expect(priceAtCount(offer, 5)).toBe(800);
    expect(priceAtCount(offer, 50)).toBe(700);
  });
  it('prices the next joiner by position', () => {
    expect(joinUnitPrice(offer, { paidCount: 4 })).toBe(800);
  });
  it('discloses taxes and fees in the breakdown (AC-15)', () => {
    const b = priceBreakdown({ ...offer, gstRate: 18, platformFee: 9, deliveryFee: 49 }, 800);
    expect(b).toMatchObject({ subtotal: 800, gst: 144, total: 1002, savings: 200 });
  });
  it('rejects misleading "starting from" pricing', () => {
    const errs = validateOffer({ ...buildOffers(now)[2], categoryId: 'yoga-wellness', fulfilment: 'MEMBERSHIP', title: 'Yoga starting from ₹99' });
    expect(errs.join(' ')).toMatch(/starting from/);
  });
});

describe('group lifecycle', () => {
  beforeEach(() => {});

  it('counts only paid members and confirms at target (AC-02, AC-03)', async () => {
    const { groupId, offer } = await setup();
    await run('startCheckout', 'u9', { groupId, optionId: offer.options[0].id, acceptedTerms: true, acceptedTermsVersion: TERMS_VERSION, idempotencyKey: 'unpaid-hold-1' });
    let g = await store.getDoc(`groups/${groupId}`);
    expect(g.paidCount).toBe(0);
    expect(g.heldCount).toBe(1);
    for (let i = 0; i < 4; i += 1) await join(`u${i}`, groupId, offer);
    g = await store.getDoc(`groups/${groupId}`);
    expect(g.paidCount).toBe(4);
    expect(g.state).toBe('CONFIRMED');
    const bookings = await store.queryDocs('bookings', [['groupId', '==', groupId]]);
    expect(bookings).toHaveLength(4); // one record per customer
  });

  it('ignores duplicate webhooks and blocks double membership (AC-14)', async () => {
    const { groupId, offer } = await setup();
    const first = await join('u1', groupId, offer);
    const again = await handlePaymentEvent({ eventId: `evt_mock_${first.paymentId}_SUCCESS`, paymentId: first.paymentId, status: 'SUCCESS' }, store, env);
    expect(again.duplicate).toBe(true);
    expect(await store.queryDocs('orders', [['uid', '==', 'u1']])).toHaveLength(1);
    await expect(join('u1', groupId, offer, 'second-key-1')).rejects.toThrow(/already a member/);
  });

  it('reuses the payment for the same idempotency key', async () => {
    const { groupId, offer } = await setup();
    const a = await run('startCheckout', 'u2', { groupId, optionId: offer.options[0].id, acceptedTerms: true, acceptedTermsVersion: TERMS_VERSION, idempotencyKey: 'same-key-123' });
    const b = await run('startCheckout', 'u2', { groupId, optionId: offer.options[0].id, acceptedTerms: true, acceptedTermsVersion: TERMS_VERSION, idempotencyKey: 'same-key-123' });
    expect(b.paymentId).toBe(a.paymentId);
    expect(b.reused).toBe(true);
  });

  it('refunds everyone automatically when a group fails (AC-05)', async () => {
    const { groupId, offer } = await setup();
    await join('u1', groupId, offer);
    await join('u2', groupId, offer);
    await runScheduledJobs(store, { now: new Date(now.getTime() + 30 * 864e5) });
    const g = await store.getDoc(`groups/${groupId}`);
    expect(g.state).toBe('EXPIRED_FAILED');
    const refunds = await store.queryDocs('refunds', [['groupId', '==', groupId]]);
    expect(refunds.map((r) => r.reason)).toEqual(['GROUP_FAILED', 'GROUP_FAILED']);
    // re-running the job never duplicates refunds
    await runScheduledJobs(store, { now: new Date(now.getTime() + 31 * 864e5) });
    expect(await store.queryDocs('refunds', [['groupId', '==', groupId]])).toHaveLength(2);
  });

  it('preserves the accepted price and refunds tier drops under ALL_MEMBERS (AC-04)', async () => {
    const { groupId, offer } = await setup();
    const r1 = await join('u0', groupId, offer);
    const firstOrder = await store.getDoc(`orders/${r1.orderId}`);
    for (let i = 1; i < 8; i += 1) await join(`u${i}`, groupId, offer);
    expect((await store.getDoc(`orders/${r1.orderId}`)).unitPrice).toBe(firstOrder.unitPrice);
    await runScheduledJobs(store, { now: new Date(now.getTime() + 30 * 864e5) });
    const drop = await store.queryDocs('refunds', [['orderId', '==', r1.orderId]]);
    expect(drop[0].reason).toBe('TIER_PRICE_DROP');
    expect(drop[0].amount).toBeGreaterThan(0);
  });

  it('never sells beyond configured capacity (AC-10)', async () => {
    const def = buildOffers(now)[2];
    const { groupId, offer } = await setup(2, { capacity: 4, options: [{ ...def.options[0], capacity: 4 }], minGroupSize: 4, maxGroupSize: 15, tiers: [{ minMembers: 1, price: 6500 }, { minMembers: 4, price: 5600 }] });
    for (let i = 0; i < 4; i += 1) await join(`u${i}`, groupId, offer);
    await expect(join('u5', groupId, offer)).rejects.toThrow(/capacity|sold out/i);
  });

  it("one customer's cancellation does not change others' orders (AC-11)", async () => {
    const { groupId, offer } = await setup();
    const a = await join('u0', groupId, offer);
    const b = await join('u1', groupId, offer);
    const before = await store.getDoc(`orders/${b.orderId}`);
    const res = await run('requestCancellation', 'u0', { orderId: a.orderId, reason: 'Schedule clash' });
    expect(res.instant).toBe(true);
    const after = await store.getDoc(`orders/${b.orderId}`);
    expect(after.unitPrice).toBe(before.unitPrice);
    expect(after.status).toBe(before.status);
  });

  it('keeps member PII out of the public group document (AC-13)', async () => {
    const { groupId, offer } = await setup();
    await join('u3', groupId, offer);
    const g = JSON.stringify(await store.getDoc(`groups/${groupId}`));
    expect(g).not.toMatch(/u3|User 3/);
  });

  it('blocks duplicate voucher redemption', async () => {
    const def = buildOffers(now)[0];
    store = null;
    const { groupId, offer } = await setup(2, { ...def, categoryId: 'yoga-wellness' });
    for (let i = 0; i < 5; i += 1) await join(`u${i}`, groupId, offer);
    const [v] = await store.queryDocs('vouchers', [['uid', '==', 'u0']]);
    await run('redeemVoucher', 'owner', { code: v.code });
    await expect(run('redeemVoucher', 'owner', { code: v.code })).rejects.toThrow(/Duplicate use blocked/);
  });
});
