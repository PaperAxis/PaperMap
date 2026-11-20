import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { SSO_LABELS, ssoStartUrl } from '../lib/sso.js';

// Profile card: link or unlink Google / PaperApp. Only configured providers
// are offered for linking; already linked ones are always listed.
export default function LinkedAccounts({ onError, onInfo }) {
  const [providers, setProviders] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api('/api/auth/sso/providers')
      .then((d) => setProviders(d.providers || []))
      .catch(() => {});
    api('/api/auth/identities')
      .then((d) => setIdentities(d.identities || []))
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function link(provider) {
    setBusy(provider);
    try {
      const { ticket } = await api('/api/auth/sso/link-ticket', {
        method: 'POST',
        body: { provider },
      });
      window.location.href = ssoStartUrl(provider, { mode: 'link', ticket });
    } catch (err) {
      onError(err);
      setBusy('');
    }
  }

  async function unlink(provider) {
    setBusy(provider);
    try {
      await api(`/api/auth/identities/${provider}`, { method: 'DELETE' });
      onInfo(`${SSO_LABELS[provider]} bağlantısı kaldırıldı.`);
      load();
    } catch (err) {
      onError(err);
    } finally {
      setBusy('');
    }
  }

  const linked = new Map(identities.map((i) => [i.provider, i]));
  const rows = ['google', 'paperapp'].filter((p) => linked.has(p) || providers.includes(p));
  if (rows.length === 0) return null;

  return (
    <div className="card">
      <h3>Bağlı hesaplar</h3>
      <p className="muted">Bağladığın hesapla şifre girmeden giriş yapabilirsin.</p>
      <div className="list">
        {rows.map((p) => {
          const identity = linked.get(p);
          return (
            <div key={p} className="linked-row">
              <div className="linked-text">
                <strong>{SSO_LABELS[p]}</strong>
                <span className="muted">
                  {identity ? identity.email || 'Bağlı' : 'Bağlı değil'}
                </span>
              </div>
              {identity ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy === p}
                  onClick={() => unlink(p)}
                >
                  Bağlantıyı kaldır
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy === p}
                  onClick={() => link(p)}
                >
                  Bağla
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
