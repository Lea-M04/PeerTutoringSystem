import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.currentUser()
      .then((result) => { if (active) setUser(result.data); })
      .catch((error) => { if (active && error.status !== 401) console.error('Session check failed.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async updateProfile(values) { const result = await api.updateProfile(values); setUser(result.data); return result.data; },
    async login(values) { const result = await api.login(values); setUser(result.data); return result.data; },
    async register(values) { const result = await api.register(values); setUser(result.data); return result.data; },
    async logout() { await api.logout(); setUser(null); },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
