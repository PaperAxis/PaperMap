import { API_BASE } from './api.js';

export const SSO_LABELS = { google: 'Google', paperapp: 'PaperApp' };

export function ssoStartUrl(provider, { mode = 'login', ticket } = {}) {
  const url = new URL(`${API_BASE}/api/sso/${provider}/start`);
  url.searchParams.set('client', 'web');
  url.searchParams.set('mode', mode);
  if (ticket) url.searchParams.set('ticket', ticket);
  return url.toString();
}

// Error codes from docs/SSO.md, in the user's words.
export function ssoErrorMessage(code, provider) {
  const name = SSO_LABELS[provider] || 'Bu hesap';
  switch (code) {
    case 'access_denied':
      return 'Giriş iptal edildi.';
    case 'email_in_use':
      return "Bu e-postayla bir PaperMap hesabı var. Şifrenle giriş yapıp Profil > Bağlı hesaplar'dan bağla.";
    case 'identity_in_use':
      return `Bu ${name} hesabı başka bir PaperMap hesabına bağlı.`;
    case 'email_missing':
      return `${name} hesabından e-posta adresi alınamadı.`;
    case 'account_disabled':
      return 'Hesabınız devre dışı bırakıldı.';
    case 'not_configured':
      return `${name} ile giriş şu an kullanılamıyor.`;
    case 'invalid_state':
      return 'Giriş bağlantısının süresi doldu. Yeniden deneyin.';
    default:
      return `${name} ile giriş tamamlanamadı. Yeniden deneyin.`;
  }
}
