// Usage: node scripts/set-admin.mjs <uid> [role]   — promotes an existing user (default role: admin).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const [uid, role = 'admin'] = process.argv.slice(2);
if (!uid) {
  console.error('Usage: node scripts/set-admin.mjs <uid> [admin|support|operations]');
  process.exit(1);
}
initializeApp();
await getFirestore().doc(`users/${uid}`).set({ role }, { merge: true });
console.log(`users/${uid} role → ${role}`);
