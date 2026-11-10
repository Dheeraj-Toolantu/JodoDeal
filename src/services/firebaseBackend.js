/**
 * Firebase backend: reads via Firestore (guarded by security rules) and all state-changing
 * business operations via callable Cloud Functions (functions/src/index.js).
 */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit as qLimit, onSnapshot, orderBy as qOrderBy, query as fsQuery, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase.js';

const fb = () => getFirebase();

const toDoc = (snap) => (snap.exists() ? { ...snap.data(), id: snap.id } : null);

function buildQuery(col, wheres = [], opts = {}) {
  const parts = wheres.map(([f, op, v]) => where(f, op, v));
  if (opts.orderBy) parts.push(qOrderBy(opts.orderBy[0], opts.orderBy[1] || 'asc'));
  if (opts.limit) parts.push(qLimit(opts.limit));
  return fsQuery(collection(fb().db, col), ...parts);
}

const sortLocal = (docs, opts) => {
  if (!opts?.sort) return docs;
  const [field, dir = 'asc'] = opts.sort;
  const m = dir === 'desc' ? -1 : 1;
  return [...docs].sort((a, b) => (a[field] === b[field] ? 0 : a[field] > b[field] ? m : -m));
};

// Name typed on the signup form, used when the server profile is created (the Auth
// profile's displayName is only set after account creation, which races with sign-in).
let pendingDisplayName = null;
let recaptcha = null;

export const firebaseAuth = {
  takePendingName() {
    const n = pendingDisplayName;
    pendingDisplayName = null;
    return n;
  },
  onChange(cb) {
    return onAuthStateChanged(fb().auth, (u) => cb(u ? { uid: u.uid, email: u.email, phone: u.phoneNumber, displayName: u.displayName } : null));
  },
  async signIn(email, password) {
    await signInWithEmailAndPassword(fb().auth, email, password);
  },
  async signUp(email, password, displayName) {
    pendingDisplayName = displayName || null;
    const cred = await createUserWithEmailAndPassword(fb().auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
  },
  async sendOtp(phone, recaptchaContainerId = 'recaptcha-container') {
    // Re-create the invisible reCAPTCHA each time so "resend OTP" doesn't fail with
    // "reCAPTCHA has already been rendered in this element".
    try {
      recaptcha?.clear();
    } catch {
      /* already cleared */
    }
    recaptcha = new RecaptchaVerifier(fb().auth, recaptchaContainerId, { size: 'invisible' });
    try {
      const confirmation = await signInWithPhoneNumber(fb().auth, phone, recaptcha);
      return { confirm: (code) => confirmation.confirm(code) };
    } catch (e) {
      recaptcha.clear();
      recaptcha = null;
      throw e;
    }
  },
  async signOut() {
    await fbSignOut(fb().auth);
  },
  async resetPassword(email) {
    await sendPasswordResetEmail(fb().auth, email);
  },
};

export const firebaseData = {
  async call(name, data) {
    const fn = httpsCallable(fb().functions, name);
    const res = await fn(data || {});
    return res.data;
  },
  async getDoc(path) {
    return toDoc(await getDoc(doc(fb().db, path)));
  },
  async query(col, wheres, opts = {}) {
    const snap = await getDocs(buildQuery(col, wheres, opts));
    return sortLocal(snap.docs.map(toDoc), opts);
  },
  subscribeDoc(path, cb, onError) {
    return onSnapshot(doc(fb().db, path), (s) => cb(toDoc(s)), onError);
  },
  subscribeQuery(col, wheres, opts, cb, onError) {
    return onSnapshot(buildQuery(col, wheres, opts), (s) => cb(sortLocal(s.docs.map(toDoc), opts)), onError);
  },
  async uploadFile(file, folder = 'uploads') {
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') throw new Error('Please upload an image (JPG, PNG, WebP) or a PDF.');
    if (file.size > 5 * 1024 * 1024) throw new Error('File is too large — the maximum size is 5 MB.');
    const uid = fb().auth.currentUser?.uid || 'anon';
    const r = ref(fb().storage, `${folder}/${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`);
    await uploadBytes(r, file, { contentType: file.type });
    return getDownloadURL(r);
  },
};
