/**
 * Firebase initialisation. When no Firebase config is provided the app runs in
 * zero-config demo mode (see services/demoBackend.js).
 */
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId) && env.VITE_DEMO_MODE !== 'true';
export const isDemoMode = !isFirebaseConfigured;

let services = null;

export function getFirebase() {
  if (!isFirebaseConfigured) return null;
  if (services) return services;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  auth.languageCode = 'en';
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  const functions = getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-south1');
  const storage = getStorage(app);
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  services = { app, auth, db, functions, storage, analytics: null };
  // Google Analytics (GA4) — only in real browsers that support it, never against emulators.
  if (firebaseConfig.measurementId && env.VITE_USE_EMULATORS !== 'true') {
    analyticsSupported()
      .then((ok) => {
        if (ok) services.analytics = getAnalytics(app);
      })
      .catch(() => {});
  }
  return services;
}
