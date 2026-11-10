/**
 * Registry of callable business operations. The same map is exposed as Firebase
 * callable functions (functions/src/index.js) and executed locally in demo mode.
 */
import * as admin from './ops/admin.js';
import * as customer from './ops/customer.js';
import * as groups from './ops/groups.js';
import * as merchant from './ops/merchant.js';

export { runScheduledJobs } from './ops/jobs.js';
export { handlePaymentEvent } from './ops/groups.js';
export { validateOffer } from './ops/merchant.js';
export { OpError } from './ops/core.js';

export const operations = {
  // customer
  ensureProfile: customer.ensureProfile,
  updateProfile: customer.updateProfile,
  createGroup: groups.createGroup,
  startCheckout: groups.startCheckout,
  cancelPendingPayment: groups.cancelPendingPayment,
  confirmMockPayment: groups.confirmMockPayment,
  respondToExtension: customer.respondToExtension,
  requestCancellation: customer.requestCancellation,
  requestReturn: customer.requestReturn,
  rescheduleBooking: customer.rescheduleBooking,
  respondQuotation: customer.respondQuotation,
  addChangeRequest: customer.addChangeRequest,
  signOffProject: customer.signOffProject,
  addReview: customer.addReview,
  createTicket: customer.createTicket,
  replyTicket: customer.replyTicket,
  trackShare: customer.trackShare,
  trackView: customer.trackView,
  markNotificationsRead: customer.markNotificationsRead,
  // merchant
  registerMerchant: merchant.registerMerchant,
  updateMerchantProfile: merchant.updateMerchantProfile,
  saveOffer: merchant.saveOffer,
  submitOffer: merchant.submitOffer,
  setOfferPaused: merchant.setOfferPaused,
  fulfilOrder: merchant.fulfilOrder,
  redeemVoucher: merchant.redeemVoucher,
  bookingAction: merchant.bookingAction,
  updateMilestone: merchant.updateMilestone,
  issueQuotation: merchant.issueQuotation,
  resolveCase: merchant.resolveCase,
  // admin
  reviewMerchant: admin.reviewMerchant,
  reviewOffer: admin.reviewOffer,
  updateCategory: admin.updateCategory,
  processRefund: admin.processRefund,
  cancelGroup: admin.cancelGroup,
  setUserRole: admin.setUserRole,
  updateTicket: admin.updateTicket,
};

/** Operations that may be invoked without signing in. */
export const PUBLIC_OPERATIONS = ['trackShare', 'trackView'];
