import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { applyAppearance, watchSystemTheme } from './appearance.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Kullanicinin tema/font tercihini uygula (cikis yapinca varsayilana doner)
  useEffect(() => {
    applyAppearance(user?.theme, user?.fontPref);
    return watchSystemTheme(user?.theme, () =>
      applyAppearance(user?.theme, user?.fontPref),
    );
  }, [user?.theme, user?.fontPref]);

  async function login(email, password) {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(d.token);
    setUser(d.user);
  }

  async function register(email, displayName, password) {
    const d = await api('/api/auth/register', {
      method: 'POST',
      body: { email, displayName, password },
    });
    setToken(d.token);
    setUser(d.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
