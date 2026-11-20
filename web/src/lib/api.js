export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4015';

const TOKEN_KEY = 'papermap_token';
const LOGIN_KEY = 'papermap_login';

// Storage can be unavailable (private mode, blocked site data).
function store(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

// "Beni hatirla" on: token in localStorage (survives closing the browser).
// Off: sessionStorage only, cleared when the tab/app closes.
export function getToken() {
  return store('local')?.getItem(TOKEN_KEY) || store('session')?.getItem(TOKEN_KEY) || null;
}

export function setToken(token, remember = true) {
  store('local')?.removeItem(TOKEN_KEY);
  store('session')?.removeItem(TOKEN_KEY);
  if (token) store(remember ? 'local' : 'session')?.setItem(TOKEN_KEY, token);
}

// Remembered login name (username or e-mail) to prefill the login form.
export function getRememberedLogin() {
  return store('local')?.getItem(LOGIN_KEY) || '';
}

export function setRememberedLogin(login) {
  if (login) store('local')?.setItem(LOGIN_KEY, login);
  else store('local')?.removeItem(LOGIN_KEY);
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'İstek başarısız oldu');
  }
  return data;
}

// Dosya yukleme (multipart). Content-Type'i tarayici belirler.
export async function apiUpload(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Yükleme başarısız oldu');
  }
  return data;
}
