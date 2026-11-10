/**
 * Zero-config demo backend: runs the exact same business operations as Cloud Functions
 * against an in-browser store persisted to localStorage, plus a simulated auth provider.
 */
import { createMemoryStore } from '@shared/memoryStore.js';
import { operations, runScheduledJobs, PUBLIC_OPERATIONS } from '@shared/operations.js';
import { seedDemo } from '@shared/seed.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@shared/seedData.js';

const DB_KEY = 'jododeal.demo.db.v1';
const AUTH_KEY = 'jododeal.demo.auth.v1';
export const DEMO_OTP = '123456';

const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage full or blocked — demo continues in memory */
  }
};

let saveTimer = null;
const store = createMemoryStore(JSON.parse(safeGet(DB_KEY) || 'null') || {}, {
  onCommit: (data) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => safeSet(DB_KEY, JSON.stringify(data)), 150);
  },
});

let ready = null;
export function demoReady() {
  if (!ready) {
    ready = (async () => {
      const meta = await store.getDoc('meta/seed');
      if (!meta) await seedDemo(store, { now: new Date() });
      await runScheduledJobs(store);
      // Background scheduler — Cloud Scheduler equivalent.
      setInterval(() => runScheduledJobs(store).catch(() => {}), 30000);
    })();
  }
  return ready;
}

export async function resetDemo() {
  store.replace({});
  safeSet(DB_KEY, '{}');
  await seedDemo(store, { now: new Date() });
  await runScheduledJobs(store);
}

// ---------- simulated auth ----------
const authListeners = new Set();
const readAuth = () => JSON.parse(safeGet(AUTH_KEY) || 'null') || { accounts: [], currentUid: null };
const writeAuth = (a) => safeSet(AUTH_KEY, JSON.stringify(a));

function allAccounts() {
  const a = readAuth();
  return [...DEMO_ACCOUNTS.map((d) => ({ uid: d.uid, email: d.email, password: DEMO_PASSWORD, displayName: d.displayName, phone: d.phone })), ...a.accounts];
}

function emit() {
  const user = currentUser();
  authListeners.forEach((l) => l(user));
}

export function currentUser() {
  const { currentUid } = readAuth();
  if (!currentUid) return null;
  const acc = allAccounts().find((a) => a.uid === currentUid);
  return acc ? { uid: acc.uid, email: acc.email || null, phone: acc.phone || null, displayName: acc.displayName || null } : null;
}

export const demoAuth = {
  onChange(cb) {
    authListeners.add(cb);
    cb(currentUser());
    return () => authListeners.delete(cb);
  },
  async signIn(email, password) {
    const acc = allAccounts().find((a) => a.email && a.email.toLowerCase() === String(email).toLowerCase());
    if (!acc || acc.password !== password) throw new Error('Incorrect email or password.');
    writeAuth({ ...readAuth(), currentUid: acc.uid });
    emit();
  },
  async signUp(email, password, displayName) {
    if (allAccounts().some((a) => a.email && a.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    const uid = `user-${Math.random().toString(36).slice(2, 10)}`;
    const a = readAuth();
    a.accounts.push({ uid, email, password, displayName });
    a.currentUid = uid;
    writeAuth(a);
    emit();
  },
  async sendOtp(phone) {
    if (!/^\+91\d{10}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
    return { confirm: (code) => demoAuth.confirmOtp(phone, code) };
  },
  async confirmOtp(phone, code) {
    if (code !== DEMO_OTP) throw new Error('Incorrect OTP. (Demo OTP is 123456)');
    const a = readAuth();
    let acc = allAccounts().find((x) => x.phone === phone);
    if (!acc) {
      acc = { uid: `user-${Math.random().toString(36).slice(2, 10)}`, phone, displayName: null };
      a.accounts.push(acc);
    }
    a.currentUid = acc.uid;
    writeAuth(a);
    emit();
  },
  async signOut() {
    writeAuth({ ...readAuth(), currentUid: null });
    emit();
  },
  async resetPassword() {
    return true;
  },
};

// ---------- data API ----------
export const demoData = {
  async call(name, data) {
    await demoReady();
    const op = operations[name];
    if (!op) throw new Error(`Unknown operation ${name}`);
    const user = currentUser();
    if (!user && !PUBLIC_OPERATIONS.includes(name)) throw new Error('Please sign in to continue.');
    const ctx = user ? { uid: user.uid, email: user.email, phone: user.phone, displayName: user.displayName } : {};
    const res = await op(ctx, data || {}, store, { adminEmails: [] });
    return res;
  },
  async getDoc(path) {
    await demoReady();
    return store.getDoc(path);
  },
  async query(col, wheres = [], opts = {}) {
    await demoReady();
    return store.queryDocs(col, wheres, opts);
  },
  subscribeDoc(path, cb) {
    let active = true;
    const run = () => demoReady().then(() => store.getDoc(path)).then((d) => active && cb(d));
    run();
    const unsub = store.subscribe(run);
    return () => {
      active = false;
      unsub();
    };
  },
  subscribeQuery(col, wheres, opts, cb) {
    let active = true;
    const run = () => demoReady().then(() => store.queryDocs(col, wheres, opts)).then((d) => active && cb(d));
    run();
    const unsub = store.subscribe(run);
    return () => {
      active = false;
      unsub();
    };
  },
  async uploadFile(file) {
    if (file.size > 400 * 1024) throw new Error('In demo mode files must be under 400 KB.');
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  },
};
