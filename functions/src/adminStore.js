/**
 * Firestore Admin SDK implementation of the transactional store interface used by
 * shared/ops/*. All business rules run inside real Firestore transactions.
 */
import { getFirestore } from 'firebase-admin/firestore';

const strip = (v) => JSON.parse(JSON.stringify(v ?? null));

export function createAdminStore(db = getFirestore()) {
  const toDoc = (snap) => (snap.exists ? { ...snap.data(), id: snap.id } : null);
  const buildQuery = (col, wheres = [], opts = {}) => {
    let q = db.collection(col);
    for (const [f, op, v] of wheres) q = q.where(f, op, v);
    if (opts.orderBy) q = q.orderBy(opts.orderBy[0], opts.orderBy[1] || 'asc');
    if (opts.limit) q = q.limit(opts.limit);
    return q;
  };
  return {
    newId(prefix = 'id') {
      return `${prefix}_${db.collection('_').doc().id}`;
    },
    async runTransaction(fn) {
      return db.runTransaction(async (t) => {
        const tx = {
          get: async (path) => toDoc(await t.get(db.doc(path))),
          query: async (col, wheres, opts) => (await t.get(buildQuery(col, wheres, opts))).docs.map(toDoc),
          set: (path, data) => t.set(db.doc(path), strip(data)),
          update: (path, patch) => t.update(db.doc(path), strip(patch)),
          delete: (path) => t.delete(db.doc(path)),
        };
        return strip(await fn(tx));
      });
    },
  };
}
