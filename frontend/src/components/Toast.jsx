import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const push = useCallback((message, kind = 'info') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`toast is-${t.kind}`}>
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// Exécute une action d'API et affiche le résultat ou l'erreur.
export function useAction() {
  const toast = useToast();
  return useCallback(
    async (promise, success) => {
      try {
        const res = await promise;
        if (success) toast(success, 'success');
        return res;
      } catch (e) {
        toast(e.message || 'Une erreur est survenue.', 'error');
        return undefined;
      }
    },
    [toast],
  );
}
