/**
 * JodoDeal shared domain constants.
 * Used by the React web app, the demo/local backend and Firebase Cloud Functions,
 * so every layer speaks the same vocabulary (BRD §5.3, §6, §11).
 */

export const APP_NAME = 'JodoDeal';
export const TAGLINE = 'Saath Kharido, Sabse Sasta Paao!';
export const TERMS_VERSION = '2026-11-v1.1';
export const CURRENCY = 'INR';

export const ROLES = Object.freeze({
  GUEST: 'guest',
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
  ADMIN: 'admin',
  SUPPORT: 'support',
  OPERATIONS: 'operations',
});

export const STAFF_ROLES = [ROLES.ADMIN, ROLES.SUPPORT, ROLES.OPERATIONS];

/** Group states — BRD §5.3 */
export const GROUP_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  OPEN: 'OPEN',
  TARGET_REACHED: 'TARGET_REACHED',
  CONFIRMED: 'CONFIRMED',
  EXPIRED_FAILED: 'EXPIRED_FAILED',
  CANCELLED: 'CANCELLED',
  FULFILMENT_IN_PROGRESS: 'FULFILMENT_IN_PROGRESS',
  COMPLETED: 'COMPLETED',
});

export const GROUP_STATE_META = {
  DRAFT: { label: 'Draft', tone: 'slate', meaning: 'Offer/group is being configured and is not public.' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'amber', meaning: 'Awaiting JodoDeal review.' },
  OPEN: { label: 'Open', tone: 'blue', meaning: 'Eligible customers can join.' },
  TARGET_REACHED: { label: 'Target reached', tone: 'violet', meaning: 'Minimum target reached; confirmation checks are running.' },
  CONFIRMED: { label: 'Confirmed', tone: 'emerald', meaning: 'Group is successful and fulfilment can proceed.' },
  EXPIRED_FAILED: { label: 'Expired', tone: 'rose', meaning: 'Minimum target was not reached by deadline.' },
  CANCELLED: { label: 'Cancelled', tone: 'rose', meaning: 'Cancelled under an allowed policy or admin action.' },
  FULFILMENT_IN_PROGRESS: { label: 'Fulfilment in progress', tone: 'indigo', meaning: 'Orders are shipping or services are being scheduled/delivered.' },
  COMPLETED: { label: 'Completed', tone: 'emerald', meaning: 'All expected fulfilment steps are complete.' },
};

/** Allowed group state transitions (explicit status transitions — BRD §11.1) */
export const GROUP_TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['OPEN', 'DRAFT', 'CANCELLED'],
  OPEN: ['TARGET_REACHED', 'EXPIRED_FAILED', 'CANCELLED'],
  TARGET_REACHED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['FULFILMENT_IN_PROGRESS', 'CANCELLED'],
  EXPIRED_FAILED: [],
  CANCELLED: [],
  FULFILMENT_IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
};

export const JOINABLE_GROUP_STATES = ['OPEN', 'TARGET_REACHED', 'CONFIRMED'];

/** Offer moderation status */
export const OFFER_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
});

export const MERCHANT_STATUS = Object.freeze({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

/** Fulfilment models — each gets its own workflow (BRD §10.2, §15) */
export const FULFILMENT = Object.freeze({
  PRODUCT: 'PRODUCT',
  MEMBERSHIP: 'MEMBERSHIP',
  COURSE: 'COURSE',
  PROJECT: 'PROJECT',
  APPOINTMENT: 'APPOINTMENT',
  VOUCHER: 'VOUCHER',
});

export const FULFILMENT_META = {
  PRODUCT: { label: 'Product delivery', record: 'Order & shipment', optionLabel: 'Variant' },
  MEMBERSHIP: { label: 'Membership', record: 'Membership', optionLabel: 'Branch & plan' },
  COURSE: { label: 'Course enrolment', record: 'Course enrolment', optionLabel: 'Cohort / batch' },
  PROJECT: { label: 'Project / consultation', record: 'Project case', optionLabel: 'Package' },
  APPOINTMENT: { label: 'Appointment package', record: 'Booking', optionLabel: 'Package' },
  VOUCHER: { label: 'Voucher / experience', record: 'Voucher', optionLabel: 'Option' },
};

/** Group deal formats — BRD §4.2 */
export const DEAL_FORMATS = {
  NATIONAL_PRODUCT: { label: 'National product deal', description: 'Customers from different cities join the same group; each receives a separate parcel.' },
  CITY_SERVICE: { label: 'City / locality service deal', description: 'Customers in a supported service area join one offer from a local provider.' },
  SOCIETY: { label: 'Society / community deal', description: 'Residents join a deal, with optional common coordination or individual fulfilment.' },
  ONLINE_COHORT: { label: 'Online cohort deal', description: 'Customers anywhere in India join a scheduled online class or course batch.' },
  APPOINTMENT_PACKAGE: { label: 'Appointment package deal', description: 'Buy a discounted package and book your own service slots.' },
  PROJECT_CONSULTATION: { label: 'Project / consultation deal', description: 'Unlock a group rate for a defined consultation or standardised scope; custom work is quoted separately.' },
};

/** Pricing rule — BRD §5.2 */
export const PRICING_RULES = {
  ALL_MEMBERS: {
    label: 'Best tier for everyone',
    short: 'Achieved tier applies to all members',
    description:
      'You pay the price shown at checkout. If the group unlocks a lower tier before it closes, the difference is refunded to your original payment method. Your price never goes up.',
  },
  NEW_MEMBERS_ONLY: {
    label: 'Locked at checkout',
    short: 'Tier applies to members joining after it is crossed',
    description:
      'Your price is locked at checkout. Lower tiers unlocked later apply only to members who join after that tier is crossed.',
  },
};

/** Group failure outcome — BRD §8.2 */
export const FAILURE_POLICIES = {
  AUTO_REFUND: {
    label: 'Automatic full refund',
    description: 'If the minimum group size is not reached by the deadline, every member is refunded in full to the original payment method.',
  },
  EXTEND_WITH_CONSENT: {
    label: 'Extension only with your consent',
    description:
      'If the target is missed, the provider may extend the deadline once. You are asked to opt in; if you decline or do not respond within 24 hours you are refunded in full. We never assume you accepted.',
  },
};

/** Gym activation rules — BRD §6.1 */
export const ACTIVATION_RULES = {
  ON_PURCHASE: 'Validity starts on purchase',
  ON_GROUP_CONFIRMATION: 'Validity starts when the group is confirmed',
  ON_FIRST_VISIT: 'Validity starts on your first visit',
};

export const ORDER_STATUS = Object.freeze({
  AWAITING_GROUP: 'AWAITING_GROUP',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLATION_REQUESTED: 'CANCELLATION_REQUESTED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
});

export const ORDER_STATUS_META = {
  AWAITING_GROUP: { label: 'Waiting for group', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'emerald' },
  PROCESSING: { label: 'Processing', tone: 'blue' },
  SHIPPED: { label: 'Shipped', tone: 'indigo' },
  DELIVERED: { label: 'Delivered', tone: 'emerald' },
  ACTIVE: { label: 'Active', tone: 'emerald' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  CANCELLATION_REQUESTED: { label: 'Cancellation requested', tone: 'amber' },
  RETURN_REQUESTED: { label: 'Return requested', tone: 'amber' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
  REFUNDED: { label: 'Refunded', tone: 'slate' },
};

export const BOOKING_STATUS_META = {
  PENDING_GROUP: { label: 'Waiting for group', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'emerald' },
  SCHEDULED: { label: 'Scheduled', tone: 'blue' },
  ACTIVE: { label: 'Active', tone: 'emerald' },
  IN_PROGRESS: { label: 'In progress', tone: 'indigo' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  NO_SHOW: { label: 'No-show', tone: 'rose' },
  PROVIDER_CANCELLED: { label: 'Provider cancelled', tone: 'rose' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
};

export const REFUND_STATUS = Object.freeze({
  INITIATED: 'INITIATED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

export const REFUND_REASONS = {
  GROUP_FAILED: 'Group did not reach minimum target',
  EXTENSION_DECLINED: 'Customer declined group extension',
  TIER_PRICE_DROP: 'Lower group tier unlocked — price difference',
  CUSTOMER_CANCELLATION: 'Customer cancellation',
  PRODUCT_RETURN: 'Product return',
  PROVIDER_CANCELLATION: 'Provider cancelled / no-show',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  GROUP_CLOSED: 'Group closed before payment completed',
  CAPACITY_FULL: 'Capacity was full when payment completed',
  ADMIN: 'Admin-approved remedy',
};

export const CASE_TYPES = {
  CANCELLATION: 'Cancellation',
  RETURN: 'Return / replacement',
  RESCHEDULE: 'Reschedule',
  SERVICE_ISSUE: 'Service issue',
};

export const TICKET_CATEGORIES = {
  PAYMENT: 'Payment or refund',
  ORDER: 'Order / delivery',
  BOOKING: 'Booking / membership',
  PROVIDER: 'Provider quality',
  ACCOUNT: 'Account & login',
  OTHER: 'Something else',
};

export const PROJECT_MILESTONES = [
  { key: 'CONSULTATION', label: 'Consultation / site visit scheduled' },
  { key: 'SITE_SURVEY', label: 'Site survey & measurement' },
  { key: 'QUOTATION', label: 'Itemised quotation issued' },
  { key: 'SCOPE_ACCEPTED', label: 'Scope & quote accepted' },
  { key: 'DESIGN_APPROVAL', label: 'Design approval' },
  { key: 'MATERIAL_SELECTION', label: 'Material selection' },
  { key: 'WORK_START', label: 'Work started' },
  { key: 'INSTALLATION', label: 'Installation' },
  { key: 'HANDOVER', label: 'Handover & customer sign-off' },
];

export const SHIPMENT_EVENTS = ['LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RTO_INITIATED'];

export const PILOT_CITIES = ['Pune', 'Bengaluru', 'Mumbai', 'Hyderabad', 'Delhi NCR', 'Online (All India)'];

/** Payment holds expire after this window (seat/slot reservation — BRD §6.2) */
export const RESERVATION_MINUTES = 15;
export const EXTENSION_CONSENT_HOURS = 24;
export const SUPPORT = {
  email: 'support@jododeal.in',
  phone: '+91 80000 00000',
  grievanceOfficer: 'Grievance Officer, JodoDeal',
  grievanceEmail: 'grievance@jododeal.in',
  hours: 'Mon–Sat, 9:00 AM – 8:00 PM IST',
};
