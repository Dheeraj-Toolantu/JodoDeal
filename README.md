# JodoDeal — *Saath Kharido, Sabse Sasta Paao!*

India-first **social group-buying marketplace** for products and services: gym & yoga memberships, online class cohorts, interior/home-improvement packages and everyday products. Built from the *JodoDeal BRD + SRS v1.1*.

**Stack:** React 18 + Vite + Tailwind CSS (responsive PWA) · Firebase Auth · Cloud Firestore · Cloud Storage · Cloud Functions (Node.js 20) · ESLint · Vitest · lucide icons.

---

## Quick start (zero config — demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without Firebase config the app runs in **demo mode**: the *same* business engine that powers Cloud Functions runs in your browser against a local store, seeded with a Pune pilot catalogue. Payments use a simulated gateway.

| Demo account | Email | Role |
|---|---|---|
| Priya Sharma | `priya@demo.jododeal.in` | Customer (has a gym membership QR, course, interior project with quote, shipped earbuds) |
| Rahul Deshmukh | `rahul@demo.jododeal.in` | Merchant (IronCore Fitness) |
| Anita Rao | `admin@demo.jododeal.in` | Admin |
| Vikram Support | `support@demo.jododeal.in` | Customer support |

Password for all: `Demo@1234`. Mobile OTP login works with any 10-digit number; demo OTP is `123456`. The login page has one-click buttons for each account.

## Run with Firebase (project `jododeal-b845b`)

The web config for project **jododeal-b845b** is already in `.env`, so `npm run dev` and `npm run build` use Firebase, including Google Analytics (`G-FQZ9R9BH8Z`). To use the in-browser demo instead, create `.env.local` containing `VITE_DEMO_MODE=true`.

**One-time setup in the [Firebase console](https://console.firebase.google.com/project/jododeal-b845b):**

1. **Upgrade to the Blaze plan.** Cloud Functions and the 5-minute scheduler require it.
2. **Authentication → Get started:**
   - Enable the **Email/Password** and **Phone** sign-in providers.
   - Under *Settings → Authorized domains*, add the domains you will serve from (`localhost` is already listed).
3. **Firestore Database → Create database** in production mode. `asia-south1 (Mumbai)` is recommended because it matches the Functions region. The rules in this repo get deployed in step 5.
4. **Storage → Get started** (same location).
5. **Deploy from your machine:**
   ```bash
   npm install && (cd functions && npm install)
   npx firebase-tools login
   cp functions/.env.example functions/.env    # put your admin email(s) in ADMIN_EMAILS
   npx firebase-tools functions:secrets:set PAYMENT_WEBHOOK_SECRET
   npm run deploy                               # rules, indexes, functions, hosting
   ```
6. Sign in on the site with an email listed in `ADMIN_EMAILS`; that account becomes the admin. Merchants register via **Sell on JodoDeal**, and you verify them and approve their offers in the Admin console.
7. **Optional, for pilot testing only:** load the sample catalogue into the live project. This also creates the demo accounts with the shared demo password, so delete them before a public launch.
   ```bash
   cd functions && SEED_ALLOW_PROD=yes GOOGLE_CLOUD_PROJECT=jododeal-b845b npm run seed
   ```
   This needs `gcloud auth application-default login`, or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account key.

Keep `ENABLE_MOCK_GATEWAY=true` until a real payment gateway is integrated, then set it to `false`.

### Local emulators

```bash
npm run emulators                       # auth, firestore, functions, storage
cd functions && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  GCLOUD_PROJECT=demo-jododeal npm run seed
```

Then set `VITE_USE_EMULATORS=true` plus `VITE_FIREBASE_PROJECT_ID=demo-jododeal` and any non-empty `VITE_FIREBASE_API_KEY`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server / production build / preview |
| `npm run lint` | ESLint (web, shared engine, functions, service worker) |
| `npm test` | Vitest engine tests mapped to acceptance criteria |
| `npm run sync-shared` | Copies `shared/` into `functions/src/shared` (runs automatically on deploy) |

## Architecture

```
shared/            ← single source of truth for business rules (browser + Cloud Functions)
  constants.js       group states, pricing rules, failure policies, statuses
  categories.js      14 categories with fulfilment model, GST, commission, fees
  pricing.js         tier engine, price breakdown, capacity, cancellation refunds
  ops/               transactional operations (groups, customer, merchant, admin, jobs)
  memoryStore.js     in-browser store (demo mode + tests), enforces Firestore tx rules
functions/src/     ← callables for every operation, signed payment webhook,
                     5-minute scheduler, notification fan-out, Admin-SDK store
src/               ← React app (pages: public, account, merchant portal, admin console)
firestore.rules    ← clients read-only; all writes go through Functions
```

**Important architecture rule (BRD §10.2):** a *group* is only a pricing campaign. Groups, members, payments, orders, bookings/memberships/enrolments/projects, vouchers, shipments and refunds are separate collections, so one customer's cancellation never affects another's records.

## What's implemented (BRD → feature)

- **Group engine (§5):** tiers, minimum size, deadline, max members, the full state machine with history, both pricing rules (*best tier for everyone*, with automatic price-drop refunds, or *locked at checkout*), and both failure policies (auto refund, or extension only with consent, where no response means a refund).
- **Checkout & payments (§8.1):** 15-minute seat/slot reservation, idempotency keys, deterministic event IDs, an HMAC-signed webhook, rejection with auto-refund for duplicate, late or over-capacity payments, the full disclosed breakdown (GST, delivery, visit and platform fees), and a stored snapshot of the accepted terms version.
- **Service deals (§6):**
  - **Gym:** branches, plans, activation rules, a QR membership code, and single-use redemption.
  - **Courses:** cohorts, schedule, seat capacity, syllabus and instructor, access instructions, attendance.
  - **Interior:** PIN-code service area, scope, site visit, itemised quotations (included, optional, material, additional), milestones, change requests, customer sign-off.
  - **Appointments and vouchers:** multi-session codes and slot requests/rescheduling.
  - **Provider cancellation:** triggers a full refund plus a support case.
- **Products (§7.3):** variants and stock, address capture, consolidated demand view, AWB shipments with tracking events, and returns.
- **Customer (§7.1–7.2):**
  - Search by keyword, category, city, PIN, provider, price, deal type or format.
  - Deal pages with tier ladder, live countdown and truthful progress.
  - WhatsApp, copy-link and native sharing with tracked shares and referral attribution.
  - Orders, vouchers, refunds tracked to completion, support tickets, notification consent preferences, and saved addresses.
- **Merchant portal (§7.5):**
  - Registration with KYC and document upload.
  - Offer builder with live validation and preview, then submit for moderation.
  - Analytics: views, shares, conversion, completion, cancellations, repeat customers.
  - Fulfilment, code redemption (manual entry or camera QR), request handling, and settlement reports with CSV export.
- **Admin (§7.6, §2.3 KPIs):**
  - All 8 pilot KPIs, plus groups at risk, low capacity, unfulfilled orders, overdue bookings and complaints.
  - Fraud and anomaly monitor.
  - Merchant verification and offer moderation; group cancellation with mass refund.
  - Refund processing, disputes with remedy override, tickets.
  - Category commission and fee settings, user roles and suspension, and the audit log.
- **Non-functional (§12):** mobile-first PWA (manifest and service worker), code-split routes, accessible components (keyboard, ARIA, focus rings, reduced motion), role-based security rules, audit logging, and timestamps stored in UTC and shown in local time.

## Notes before launch (BRD §8.4, §17)

The **payment gateway** and **WhatsApp/SMS/email providers** are integration points. The mock gateway and `deliverNotification` stub mark where the real ones plug in. The policies pages are product copy and still need India-qualified legal, tax and payments review.
