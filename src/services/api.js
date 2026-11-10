/**
 * Single entry point for data + auth. Chooses Firebase or the demo backend at startup.
 */
import { isDemoMode } from '@/lib/firebase.js';
import { demoAuth, demoData } from './demoBackend.js';
import { firebaseAuth, firebaseData } from './firebaseBackend.js';

export const auth = isDemoMode ? demoAuth : firebaseAuth;
export const data = isDemoMode ? demoData : firebaseData;

const FRIENDLY = {
  'functions/unauthenticated': 'Please sign in to continue.',
  'functions/permission-denied': 'You do not have permission to do that.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-verification-code': 'Incorrect OTP.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
};

export function errorMessage(err) {
  if (!err) return 'Something went wrong.';
  return FRIENDLY[err.code] || err.message?.replace(/^Firebase: /, '').replace(/\s*\(.*\)\.?$/, '') || 'Something went wrong.';
}

/** Calls a business operation (Cloud Function in production). */
export function call(name, payload) {
  return data.call(name, payload);
}
