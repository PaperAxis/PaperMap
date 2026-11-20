import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setRememberedLogin } from './api.js';
import { applyAppearance } from './appearance/index.js';

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

  // Kullanicinin tema/font/ikon tercihini uygula (cikis yapinca varsayilana doner)
  useEffect(() => {
    applyAppearance(user?.theme, user?.fontPref, user?.iconStyle);
  }, [user?.theme, user?.fontPref, user?.iconStyle]);

  async function login(loginId, password, remember = true) {
    const d = await api('/api/auth/login', {
      method: 'POST',
      body: { login: loginId, password },
    });
    setToken(d.token, remember);
    setRememberedLogin(remember ? loginId.trim() : '');
    setUser(d.user);
  }

  // Session from Google / PaperApp sign-in (persisted like "Beni hatırla").
  function loginWithToken(token, nextUser) {
    setToken(token, true);
    setUser(nextUser);
  }

  async function register(displayName, username, email, password) {
    const d = await api('/api/auth/register', {
      method: 'POST',
      body: { displayName, username, email, password },
    });
    setToken(d.token);
    setUser(d.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, loginWithToken, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
