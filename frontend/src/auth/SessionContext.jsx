import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { notifyChange } from '../api/index.js';

const SessionContext = createContext({ user: null, ready: false, login: async () => {}, logout: async () => {} });

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.session.current().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  // Lève une erreur (401 / 403) si les identifiants sont refusés : la page de connexion l'affiche.
  const login = useCallback(async (email, password) => {
    const u = await api.session.login(email, password);
    setUser(u);
    notifyChange();
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.session.logout();
    setUser(null);
    notifyChange();
  }, []);

  const refresh = useCallback(async () => setUser(await api.session.current()), []);

  return <SessionContext.Provider value={{ user, ready, login, logout, refresh }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
