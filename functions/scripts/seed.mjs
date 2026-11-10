/**
 * Seeds the Firebase emulator (or a dev project) with demo data using the real operations.
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   GCLOUD_PROJECT=demo-jododeal node scripts/seed.mjs
 * Refuses to run against a real project unless SEED_ALLOW_PROD=yes.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createAdminStore } from '../src/adminStore.js';
import { seedDemo } from '../src/shared/seed.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/shared/seedData.js';

if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.SEED_ALLOW_PROD !== 'yes') {
  console.error('Refusing to seed a non-emulator project. Set SEED_ALLOW_PROD=yes to override.');
  process.exit(1);
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-jododeal' });
for (const a of DEMO_ACCOUNTS) {
  await getAuth().createUser({ uid: a.uid, email: a.email, password: DEMO_PASSWORD, displayName: a.displayName }).catch((e) => console.log(`auth ${a.email}: ${e.code}`));
}
await seedDemo(createAdminStore(), { log: (m) => console.log('seed:', m) });
console.log('Seed complete. Demo password:', DEMO_PASSWORD);
