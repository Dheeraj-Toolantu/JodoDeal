/**
 * Seeds demo data by running the real business operations (so every count, order and
 * refund is consistent with the engine's rules). Used by the browser demo mode and by
 * functions/scripts/seed.mjs against the Firebase emulator.
 */
import { CATEGORIES } from './categories.js';
import { operations } from './operations.js';
import { randomCode } from './pricing.js';
import { DEMO_ACCOUNTS, MERCHANTS, buildOffers } from './seedData.js';
import { TERMS_VERSION } from './constants.js';

const FIRST = ['Aarav', 'Diya', 'Kabir', 'Ananya', 'Vihaan', 'Isha', 'Reyansh', 'Meera', 'Arjun', 'Saanvi', 'Rohan', 'Tara', 'Aditya', 'Kiara', 'Ishaan', 'Pooja', 'Nikhil', 'Sneha', 'Yash', 'Riya', 'Karan', 'Neha', 'Siddharth', 'Aditi', 'Varun', 'Kavya', 'Manish', 'Shreya', 'Harsh', 'Zoya', 'Dev', 'Nisha', 'Om', 'Lavanya', 'Tanmay', 'Ira', 'Rahul', 'Gauri', 'Sameer', 'Anjali'];
const LAST = ['Patil', 'Kulkarni', 'Joshi', 'Iyer', 'Reddy', 'Gupta', 'Singh', 'Nair', 'Shah', 'Mehta', 'Kapoor', 'Das'];

export async function seedDemo(store, { now = new Date(), log = () => {} } = {}) {
  const env = { now };
  const run = (name, ctx, data) => operations[name](ctx, data, store, env);

  // 1. Categories & users
  await store.runTransaction(async (tx) => {
    CATEGORIES.forEach((c) => tx.set(`categories/${c.id}`, c));
    DEMO_ACCOUNTS.forEach((a) =>
      tx.set(`users/${a.uid}`, {
        uid: a.uid,
        displayName: a.displayName,
        email: a.email,
        phone: a.phone,
        city: a.city,
        role: a.role === 'merchant' ? 'customer' : a.role,
        merchantId: null,
        status: 'ACTIVE',
        referralCode: randomCode(7),
        addresses:
          a.uid === 'demo-customer'
            ? [{ id: 'addr-home', label: 'Home', name: 'Priya Sharma', line1: 'B-704, Green Valley Society', line2: 'Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045', phone: '+919800000001', kind: 'DELIVERY' }]
            : [],
        notificationPrefs: { inSite: true, email: true, sms: false, whatsapp: a.uid === 'demo-customer', marketing: false },
        createdAt: now.toISOString(),
        demo: true,
      }),
    );
    for (let i = 0; i < 40; i += 1) {
      tx.set(`users/demo-member-${i}`, {
        uid: `demo-member-${i}`,
        displayName: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
        email: null,
        phone: null,
        city: 'Pune',
        role: 'customer',
        status: 'ACTIVE',
        referralCode: randomCode(7),
        addresses: [],
        notificationPrefs: { inSite: true, email: false, sms: false, whatsapp: false },
        createdAt: now.toISOString(),
        demo: true,
        synthetic: true,
      });
    }
  });
  log('users ready');

  const admin = { uid: 'demo-admin', email: 'admin@demo.jododeal.in' };

  // 2. Merchants (registered through the real flow, then verified by admin)
  const merchantIds = {};
  for (const m of MERCHANTS) {
    const ownerUid = m.key === 'ironcore' ? 'demo-merchant' : `demo-owner-${m.key}`;
    if (ownerUid !== 'demo-merchant') {
      await store.runTransaction(async (tx) =>
        tx.set(`users/${ownerUid}`, { uid: ownerUid, displayName: `${m.name} Owner`, email: null, role: 'customer', status: 'ACTIVE', referralCode: randomCode(7), addresses: [], notificationPrefs: { inSite: true }, createdAt: now.toISOString(), demo: true }),
      );
    }
    const { merchantId } = await run('registerMerchant', { uid: ownerUid }, {
      businessName: m.name,
      tagline: m.tagline,
      description: m.description,
      categoryIds: m.categoryIds,
      city: m.city,
      address: m.address,
      serviceAreas: m.serviceAreas,
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      bankAccountName: m.name,
      bankAccountNumber: '000123456789',
      ifsc: 'HDFC0001234',
      documents: [{ name: 'GST certificate.pdf', url: '', type: 'GST' }, { name: 'Shop & establishment licence.pdf', url: '', type: 'LICENCE' }],
      acceptAgreement: true,
    });
    merchantIds[m.key] = { merchantId, ownerUid };
    if (!m.pending) await run('reviewMerchant', admin, { merchantId, decision: 'VERIFY', note: 'Documents and premises verified' });
  }
  log('merchants ready');

  // 3. Offers: save → submit → approve (approval opens the first group)
  const offers = buildOffers(now);
  const offerIds = [];
  for (const o of offers) {
    const { merchantId, ownerUid } = merchantIds[o.merchant];
    const { offerId, errors } = await run('saveOffer', { uid: ownerUid }, { ...o, merchant: undefined });
    if (errors.length) throw new Error(`Seed offer invalid (${o.title}): ${errors.join(' ')}`);
    await run('submitOffer', { uid: ownerUid }, { offerId });
    await run('reviewOffer', admin, { offerId, decision: 'APPROVE', note: '' });
    offerIds.push({ offerId, merchantId, ownerUid, def: o });
  }
  // One more offer left pending to demonstrate moderation.
  {
    const { ownerUid } = merchantIds.prana;
    const { offerId } = await run('saveOffer', { uid: ownerUid }, {
      ...buildOffers(now)[2],
      title: 'Prenatal Yoga — 8-Week Programme',
      summary: 'Gentle, doctor-approved prenatal yoga in small batches.',
      mrp: 6000,
      tiers: [{ minMembers: 1, price: 5200 }, { minMembers: 4, price: 4500 }],
      options: [{ label: 'Weekend mornings · 9:00 AM', capacity: 10, durationDays: 56 }],
      capacity: 10,
      maxGroupSize: 10,
    });
    await run('submitOffer', { uid: ownerUid }, { offerId });
  }
  log('offers ready');

  // 4. Group activity — joins by demo members through checkout + payment events.
  let memberIdx = 0;
  const nextMember = () => `demo-member-${memberIdx++ % 40}`;
  const joinGroup = async (uid, groupId, offer, optionIndex = 0) => {
    const option = offer.options?.[optionIndex % (offer.options?.length || 1)];
    const details = {};
    if (offer.fulfilment === 'PRODUCT') details.address = { name: 'Demo Member', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', phone: '9800000000' };
    if (offer.fulfilment === 'PROJECT') details.pincode = '411045';
    const { paymentId } = await run('startCheckout', { uid }, { groupId, optionId: option?.id, quantity: 1, fulfilmentDetails: details, acceptedTerms: true, acceptedTermsVersion: TERMS_VERSION, idempotencyKey: randomCode(16) });
    return run('confirmMockPayment', { uid }, { paymentId });
  };

  // Desired paid members per offer's first group (+ optional second group)
  const plan = [
    [7, 3], // gym: confirmed + second group forming
    [2], // PT
    [3], // yoga
    [8], // full-stack
    [6], // spoken english confirmed
    [5], // gen AI
    [3], // interior consultation confirmed
    [3], // modular kitchen
    [1], // painting
    [12, 4], // earbuds
    [9], // cookware
    [2], // spa
    [6], // trek
  ];
  const groupsByOffer = {};
  for (let i = 0; i < offerIds.length; i += 1) {
    const { offerId } = offerIds[i];
    const offer = await store.runTransaction((tx) => tx.get(`offers/${offerId}`));
    const existing = await store.runTransaction((tx) => tx.query('groups', [['offerId', '==', offerId]]));
    const groupIds = [existing[0].id];
    for (let g = 1; g < (plan[i] || [0]).length; g += 1) {
      const host = nextMember();
      const { groupId } = await run('createGroup', { uid: host }, { offerId });
      groupIds.push(groupId);
    }
    groupsByOffer[offerId] = groupIds;
    for (let g = 0; g < groupIds.length; g += 1) {
      const count = plan[i]?.[g] || 0;
      for (let k = 0; k < count; k += 1) await joinGroup(nextMember(), groupIds[g], offer, k);
    }
  }
  log('groups ready');

  // 5. Showcase account for Priya (demo-customer)
  const priya = { uid: 'demo-customer' };
  const off = (idx) => offerIds[idx].offerId;
  const getOffer = (idx) => store.runTransaction((tx) => tx.get(`offers/${off(idx)}`));
  // Gym (group already confirmed → membership + QR code)
  await joinGroup(priya.uid, groupsByOffer[off(0)][0], await getOffer(0), 0);
  // Full-stack cohort (awaiting group)
  await joinGroup(priya.uid, groupsByOffer[off(3)][0], await getOffer(3), 0);
  // Interior consultation (confirmed → project with quotation)
  const interior = await joinGroup(priya.uid, groupsByOffer[off(6)][0], await getOffer(6), 0);
  // Earbuds (confirmed → shipped)
  const earbuds = await joinGroup(priya.uid, groupsByOffer[off(9)][0], await getOffer(9), 1);

  const nestOwner = { uid: merchantIds.nestnook.ownerUid };
  await run('bookingAction', nestOwner, { bookingId: interior.orderId, action: 'CONFIRM_SLOT', slot: new Date(now.getTime() + 2 * 864e5 + 3 * 36e5).toISOString() });
  await run('updateMilestone', nestOwner, { bookingId: interior.orderId, key: 'SITE_SURVEY', status: 'DONE', note: 'Measurements captured; 2BHK, 980 sq ft' });
  await run('issueQuotation', nestOwner, {
    bookingId: interior.orderId,
    items: [
      { description: 'Living room TV unit (laminate finish, 8 ft)', type: 'INCLUDED', amount: 38000 },
      { description: 'Master bedroom wardrobe (sliding, 7 ft)', type: 'INCLUDED', amount: 62000 },
      { description: 'Plywood upgrade BWR → BWP', type: 'OPTIONAL', amount: 9500 },
      { description: 'Hardware (Hettich soft-close)', type: 'MATERIAL', amount: 8400 },
      { description: 'Transport & installation', type: 'ADDITIONAL', amount: 4500 },
    ],
    notes: 'Execution timeline 25 working days after design approval. 3 milestone payments: 40% / 40% / 20%.',
  });
  const sw = { uid: merchantIds.soundwave.ownerUid };
  await run('fulfilOrder', sw, { orderId: earbuds.orderId, action: 'PROCESS' });
  await run('fulfilOrder', sw, { orderId: earbuds.orderId, action: 'SHIP', carrier: 'Delhivery', awb: '1489' + randomCode(8).replace(/\D/g, '1').slice(0, 8) });
  await run('fulfilOrder', sw, { orderId: earbuds.orderId, action: 'EVENT', event: 'IN_TRANSIT', note: 'Reached Pune hub' });

  await run('createTicket', priya, { category: 'BOOKING', subject: 'Can I switch from Baner to Kothrud branch later?', message: 'I might move next month. Is a branch transfer possible on the gym membership?' });
  await run('replyTicket', { uid: 'demo-support' }, { ticketId: (await store.runTransaction((tx) => tx.query('tickets', [['uid', '==', 'demo-customer']])))[0].id, message: 'Hi Priya! IronCore allows one free branch transfer — just show your membership QR at the new branch. 😊' });

  // A refund for history: a member cancels before confirmation
  const pendingGroup = groupsByOffer[off(5)][0];
  const aiOrders = await store.runTransaction((tx) => tx.query('orders', [['groupId', '==', pendingGroup]]));
  if (aiOrders[0]) await run('requestCancellation', { uid: aiOrders[0].uid }, { orderId: aiOrders[0].id, reason: 'Schedule clash' });

  // Reviews from confirmed members
  const reviewable = await store.runTransaction((tx) => tx.query('orders', [['status', '==', 'CONFIRMED']]));
  const comments = ['Great value — the group price was genuinely lower and the provider was professional.', 'Smooth experience. Loved that my booking was separate from others.', 'Joined with neighbours; the deal unlocked in a day!', 'Good service, clear terms, no hidden charges.', 'Would join again. Support answered quickly.'];
  for (let i = 0; i < reviewable.length; i += 3) {
    const o = reviewable[i];
    if (o.uid === 'demo-customer') continue;
    await run('addReview', { uid: o.uid }, { orderId: o.id, rating: 4 + (i % 2), comment: comments[i % comments.length] });
  }

  await store.runTransaction(async (tx) => tx.set('meta/seed', { id: 'seed', seededAt: now.toISOString(), version: 1 }));
  log('done');
  return { merchantIds, offerIds: offerIds.map((o) => o.offerId) };
}
