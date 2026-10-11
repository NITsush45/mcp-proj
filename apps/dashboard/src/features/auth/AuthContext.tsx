import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../../types/index.js';
import { api } from '../../api/client.js';

interface Ctx { user: User | null; loading: boolean; login(email: string, pw: string): Promise<void>; logout(): void; }
const C = createContext<Ctx>({ user: null, loading: true, login: async () => undefined, logout: () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem('urumi_token')) { setLoading(false); return; }
    api.me().then((d) => setUser(d.user)).catch(() => localStorage.removeItem('urumi_token')).finally(() => setLoading(false));
  }, []);
  const login = useCallback(async (email: string, password: string) => {
    const d = await api.login(email, password);
    localStorage.setItem('urumi_token', d.token);
    setUser(d.user);
  }, []);
  const logout = useCallback(() => { localStorage.removeItem('urumi_token'); setUser(null); }, []);
  return <C.Provider value={{ user, loading, login, logout }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);
