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
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, limit as qLimit, onSnapshot, orderBy as qOrderBy, query as fsQuery, where } from 'firebase/firestore';
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

// Errors that mean "the Cloud Function isn't deployed / reachable", as opposed to a
// business-rule error returned by a deployed function.
const UNAVAILABLE = ['functions/internal', 'functions/not-found', 'functions/unavailable', 'functions/deadline-exceeded'];
const isUnavailable = (e) => UNAVAILABLE.includes(e?.code) && (e.code !== 'functions/internal' || !e.details);

const PROFILE_FIELDS = ['displayName', 'phone', 'city', 'addresses', 'notificationPrefs', 'interests', 'onboardedAt'];
const clean = (v, max) => (v === undefined || v === null ? '' : String(v).replace(/[<>]/g, '').trim().slice(0, max));

/**
 * Profile fallbacks used while Cloud Functions are not deployed. Firestore rules only allow
 * creating your own profile as a plain customer and editing personal fields.
 */
async function ensureProfileDirect(data) {
  const u = fb().auth.currentUser;
  const ref = doc(fb().db, `users/${u.uid}`);
  const snap = await getDoc(ref);
  if (snap.exists()) return { profile: { ...snap.data(), id: u.uid }, created: false };
  const profile = {
    uid: u.uid,
    displayName: clean(data?.displayName || u.displayName || (u.email ? u.email.split('@')[0] : 'JodoDeal member'), 80),
    email: u.email || null,
    phone: u.phoneNumber || null,
    city: null,
    role: 'customer',
    merchantId: null,
    status: 'ACTIVE',
    referralCode: Math.random().toString(36).slice(2, 9).toUpperCase(),
    addresses: [],
    notificationPrefs: { inSite: true, email: true, sms: false, whatsapp: false, marketing: false },
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, profile);
  return { profile, created: true };
}

async function updateProfileDirect(data) {
  const u = fb().auth.currentUser;
  const patch = {};
  if (data.displayName !== undefined) patch.displayName = clean(data.displayName, 80);
  if (data.phone !== undefined) patch.phone = clean(data.phone, 15);
  if (data.city !== undefined) patch.city = clean(data.city, 40);
  if (Array.isArray(data.addresses)) patch.addresses = data.addresses.slice(0, 10).map((a, i) => ({ id: a.id || `addr${i}${Date.now() % 100000}`, label: clean(a.label, 30) || 'Home', name: clean(a.name, 80), line1: clean(a.line1, 160), line2: clean(a.line2, 160), city: clean(a.city, 60), state: clean(a.state, 60), pincode: clean(a.pincode, 6), phone: clean(a.phone, 15), kind: a.kind === 'SERVICE' ? 'SERVICE' : 'DELIVERY' }));
  if (data.notificationPrefs) {
    const p = data.notificationPrefs;
    patch.notificationPrefs = { inSite: true, email: !!p.email, sms: !!p.sms, whatsapp: !!p.whatsapp, marketing: !!p.marketing, consentAt: new Date().toISOString() };
  }
  if (Array.isArray(data.interests)) patch.interests = data.interests.map((x) => clean(x, 40)).filter(Boolean).slice(0, 14);
  if (data.onboarded) patch.onboardedAt = new Date().toISOString();
  Object.keys(patch).forEach((k) => PROFILE_FIELDS.includes(k) || delete patch[k]);
  await updateDoc(doc(fb().db, `users/${u.uid}`), patch);
  return { profile: patch };
}

const FALLBACKS = { ensureProfile: ensureProfileDirect, updateProfile: updateProfileDirect };

export const firebaseData = {
  async call(name, data) {
    try {
      const fn = httpsCallable(fb().functions, name);
      const res = await fn(data || {});
      return res.data;
    } catch (e) {
      if (isUnavailable(e)) {
        if (FALLBACKS[name] && fb().auth.currentUser) return FALLBACKS[name](data || {});
        const err = new Error('This feature is being set up and will be available very soon. Please try again later.');
        err.code = 'jododeal/unavailable';
        throw err;
      }
      throw e;
    }
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
