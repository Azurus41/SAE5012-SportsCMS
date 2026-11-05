import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { notifyChange } from '../api/index.js';

const SessionContext = createContext({ user: null, ready: false, login: async () => {} });

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.session.current().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  const login = useCallback(async (userId) => {
    const u = await api.session.login(userId);
    setUser(u);
    notifyChange();
    return u;
  }, []);

  // Le bannissement de l'utilisateur courant doit être répercuté immédiatement.
  const refresh = useCallback(async () => setUser(await api.session.current()), []);

  return <SessionContext.Provider value={{ user, ready, login, refresh }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
