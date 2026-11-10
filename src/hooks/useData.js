import { useEffect, useMemo, useState } from 'react';
import { data } from '@/services/api.js';

/** Realtime document subscription. Pass null path to skip. */
export function useDoc(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return data.subscribeDoc(
      path,
      (d) => setState({ data: d, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);
  return state;
}

/** Realtime query subscription. `wheres` = [[field, op, value]]; opts.sort = [field, dir]. */
export function useQuery(col, wheres, opts, enabled = true) {
  const key = JSON.stringify([col, wheres, opts, enabled]);
  const [state, setState] = useState({ data: [], loading: enabled, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const args = useMemo(() => ({ col, wheres, opts }), [key]);
  useEffect(() => {
    if (!enabled || !args.col) {
      setState({ data: [], loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return data.subscribeQuery(
      args.col,
      args.wheres || [],
      args.opts || {},
      (d) => setState({ data: d, loading: false, error: null }),
      (error) => {
        console.error(error);
        setState({ data: [], loading: false, error });
      },
    );
  }, [args, enabled]);
  return state;
}

/** Ticks every second (for countdowns). */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
