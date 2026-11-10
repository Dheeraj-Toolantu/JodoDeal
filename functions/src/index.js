/**
 * JodoDeal Cloud Functions (Node.js 20, Firebase Functions v2).
 *
 *  - Every business operation in shared/operations.js is exposed as an HTTPS callable
 *    (state changes never happen directly from the client — Firestore rules deny them).
 *  - paymentWebhook: signed, idempotent gateway webhook (AC-14).
 *  - scheduledJobs: group expiry, failure refunds, hold release, price-drop refunds.
 *  - deliverNotification: consent-aware WhatsApp/SMS/email fan-out hook (BRD §7.7).
 */
import crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createAdminStore } from './adminStore.js';
import { handlePaymentEvent, operations, OpError, PUBLIC_OPERATIONS, runScheduledJobs } from './shared/operations.js';

initializeApp();
setGlobalOptions({ region: 'asia-south1', maxInstances: 20 });

const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '' });
const ENABLE_MOCK_GATEWAY = defineString('ENABLE_MOCK_GATEWAY', { default: 'true' });
const PAYMENT_WEBHOOK_SECRET = defineSecret('PAYMENT_WEBHOOK_SECRET');

const store = createAdminStore();

const KNOWN_CODES = new Set(['invalid-argument', 'failed-precondition', 'not-found', 'already-exists', 'permission-denied', 'unauthenticated', 'resource-exhausted']);

function wrap(name, fn) {
  return onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth && !PUBLIC_OPERATIONS.includes(name)) throw new HttpsError('unauthenticated', 'Please sign in to continue.');
    if (name === 'confirmMockPayment' && ENABLE_MOCK_GATEWAY.value() !== 'true') throw new HttpsError('failed-precondition', 'Mock gateway disabled.');
    const token = request.auth?.token || {};
    const ctx = request.auth ? { uid: request.auth.uid, email: token.email || null, phone: token.phone_number || null, displayName: token.name || null } : {};
    try {
      return await fn(ctx, request.data || {}, store, { adminEmails: ADMIN_EMAILS.value().split(',').map((s) => s.trim()).filter(Boolean) });
    } catch (e) {
      if (e instanceof OpError || KNOWN_CODES.has(e.code)) throw new HttpsError(KNOWN_CODES.has(e.code) ? e.code : 'failed-precondition', e.message);
      logger.error(`${name} failed`, e);
      throw new HttpsError('internal', 'Something went wrong. Please try again.');
    }
  });
}

const api = {};
for (const [name, fn] of Object.entries(operations)) {
  // Each operation becomes its own callable: ensureProfile, startCheckout, ...
  api[name] = wrap(name, fn);
}
export const {
  ensureProfile, updateProfile, createGroup, startCheckout, cancelPendingPayment, confirmMockPayment, respondToExtension,
  requestCancellation, requestReturn, rescheduleBooking, respondQuotation, addChangeRequest, signOffProject, addReview,
  createTicket, replyTicket, trackShare, trackView, markNotificationsRead, registerMerchant, updateMerchantProfile, saveOffer,
  submitOffer, setOfferPaused, fulfilOrder, redeemVoucher, bookingAction, updateMilestone, issueQuotation, resolveCase,
  reviewMerchant, reviewOffer, updateCategory, processRefund, cancelGroup, setUserRole, updateTicket,
} = api;

/**
 * Payment gateway webhook. Verifies an HMAC-SHA256 signature of the raw body using
 * PAYMENT_WEBHOOK_SECRET and processes events idempotently by event id.
 * Adapt `parseEvent` to the chosen Indian payment gateway's payload format.
 */
export const paymentWebhook = onRequest({ secrets: [PAYMENT_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const signature = req.get('x-signature') || '';
  const expected = crypto.createHmac('sha256', PAYMENT_WEBHOOK_SECRET.value()).update(req.rawBody).digest('hex');
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    logger.warn('Rejected webhook with invalid signature');
    return res.status(401).send('Invalid signature');
  }
  const body = req.body || {};
  const event = { eventId: String(body.id), paymentId: String(body.payment_id || body.reference_id), status: body.status === 'captured' || body.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED', amount: Number(body.amount) / (body.amount_in_paise ? 100 : 1), gatewayRef: body.gateway_ref || body.id, method: body.method };
  try {
    const result = await handlePaymentEvent(event, store);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    logger.error('webhook processing failed', e);
    return res.status(500).send('Retry later'); // gateway will retry; idempotency keeps it safe
  }
});

export const scheduledJobs = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' }, async () => {
  const summary = await runScheduledJobs(store);
  logger.info('scheduled jobs', summary);
});

/**
 * Notification fan-out. In-site notifications are written by operations; here we look up
 * the user's consented channels and hand off to approved providers (WhatsApp Business API,
 * SMS, email). Provider calls are intentionally left as integration points.
 */
export const deliverNotification = onDocumentCreated('notifications/{id}', async (event) => {
  const n = event.data?.data();
  if (!n) return;
  const user = (await getFirestore().doc(`users/${n.uid}`).get()).data();
  const prefs = user?.notificationPrefs || {};
  const channels = ['email', 'whatsapp', 'sms'].filter((c) => prefs[c]);
  // TODO(integration): send via approved provider per channel.
  await event.data.ref.update({ delivery: channels.length ? 'QUEUED' : 'IN_SITE_ONLY', channels });
});
