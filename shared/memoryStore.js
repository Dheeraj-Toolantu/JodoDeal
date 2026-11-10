/**
 * In-memory implementation of the transactional store interface used by business
 * operations. Powers the zero-config demo mode (persisted to localStorage) and tests.
 * Enforces Firestore's "all reads before writes" rule so code behaves identically in
 * Cloud Functions.
 */

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function splitPath(path) {
  const parts = path.split('/');
  if (parts.length % 2 !== 0) throw new Error(`Invalid document path ${path}`);
  return { col: parts.slice(0, -1).join('/'), id: parts[parts.length - 1] };
}

function getField(obj, field) {
  return field.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function matches(doc, wheres = []) {
  return wheres.every(([field, op, value]) => {
    const v = getField(doc, field);
    switch (op) {
      case '==':
        return v === value;
      case '!=':
        return v !== value;
      case '<':
        return v !== undefined && v !== null && v < value;
      case '<=':
        return v !== undefined && v !== null && v <= value;
      case '>':
        return v !== undefined && v !== null && v > value;
      case '>=':
        return v !== undefined && v !== null && v >= value;
      case 'in':
        return value.includes(v);
      case 'array-contains':
        return Array.isArray(v) && v.includes(value);
      default:
        throw new Error(`Unsupported operator ${op}`);
    }
  });
}

export function sortDocs(docs, orderBy) {
  if (!orderBy) return docs;
  const [field, dir = 'asc'] = orderBy;
  const m = dir === 'desc' ? -1 : 1;
  return [...docs].sort((a, b) => {
    const x = getField(a, field);
    const y = getField(b, field);
    if (x === y) return 0;
    if (x === undefined || x === null) return 1;
    if (y === undefined || y === null) return -1;
    return x > y ? m : -m;
  });
}

export function createMemoryStore(initial = {}, { onCommit } = {}) {
  /** data: { [collectionPath]: { [id]: doc } } */
  let data = clone(initial) || {};
  let counter = 0;
  const listeners = new Set();

  const readDoc = (path) => {
    const { col, id } = splitPath(path);
    const d = data[col]?.[id];
    return d ? { ...clone(d), id } : null;
  };

  const readQuery = (col, wheres = [], opts = {}) => {
    let docs = Object.entries(data[col] || {}).map(([id, d]) => ({ ...clone(d), id }));
    docs = docs.filter((d) => matches(d, wheres));
    docs = sortDocs(docs, opts.orderBy || opts.sort);
    if (opts.limit) docs = docs.slice(0, opts.limit);
    return docs;
  };

  const store = {
    newId(prefix = 'id') {
      counter += 1;
      const rand = Math.random().toString(36).slice(2, 8);
      return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
    },

    async runTransaction(fn) {
      const writes = [];
      let wrote = false;
      const guard = () => {
        if (wrote) throw new Error('Transactions require all reads to be executed before all writes.');
      };
      const tx = {
        async get(path) {
          guard();
          return readDoc(path);
        },
        async query(col, wheres, opts) {
          guard();
          return readQuery(col, wheres, opts);
        },
        set(path, value) {
          wrote = true;
          writes.push({ type: 'set', path, value: clone(value) });
        },
        update(path, patch) {
          wrote = true;
          writes.push({ type: 'update', path, value: clone(patch) });
        },
        delete(path) {
          wrote = true;
          writes.push({ type: 'delete', path });
        },
      };
      const result = await fn(tx);
      if (writes.length) {
        for (const w of writes) {
          const { col, id } = splitPath(w.path);
          data[col] = data[col] || {};
          if (w.type === 'set') data[col][id] = { ...w.value, id };
          else if (w.type === 'update') {
            if (!data[col][id]) throw new Error(`No document to update: ${w.path}`);
            data[col][id] = { ...data[col][id], ...w.value };
          } else delete data[col][id];
        }
        onCommit?.(data);
        listeners.forEach((l) => l());
      }
      return clone(result);
    },

    // Non-transactional reads (client listing pages)
    async getDoc(path) {
      return readDoc(path);
    },
    async queryDocs(col, wheres, opts) {
      return readQuery(col, wheres, opts);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dump() {
      return clone(data);
    },
    replace(next) {
      data = clone(next) || {};
      onCommit?.(data);
      listeners.forEach((l) => l());
    },
  };
  return store;
}
