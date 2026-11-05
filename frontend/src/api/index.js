import { useCallback, useEffect, useRef, useState } from 'react';
import mockApi from './mockApi.js';
import httpApi from './httpApi.js';

const api = import.meta.env.VITE_API_URL ? httpApi : mockApi;
export default api;

// Abonnement global : toute écriture déclenche le rechargement des vues concernées.
const listeners = new Set();
export function notifyChange() {
  listeners.forEach((fn) => fn());
}

export async function mutate(promise) {
  const result = await promise;
  notifyChange();
  return result;
}

// Hook de lecture : useApi(() => api.articles.list(), []) -> { data, error, loading, reload }
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then(
        (data) => alive && setState({ data, error: null, loading: false }),
        (error) => alive && setState({ data: undefined, error, loading: false }),
      );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancel = load();
    const onChange = () => {
      cancel();
      cancel = load();
    };
    listeners.add(onChange);
    return () => {
      cancel();
      listeners.delete(onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load };
}
