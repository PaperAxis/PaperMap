import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Brand from '../components/Brand.jsx';
import Credit from '../components/Credit.jsx';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Brand />
        <p className="muted">Şifre sıfırlama</p>
        {sent ? (
          <>
            <div className="badge">
              E-posta adresin kayıtlıysa şifre sıfırlama bağlantısı gönderildi.
              Gelen kutunu kontrol et.
            </div>
            <p className="muted">
              <Link to="/login">Girişe dön</Link>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={onSubmit}>
              <input
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <div className="error">{error}</div>}
              <button type="submit" disabled={busy}>
                {busy ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
              </button>
            </form>
            <p className="muted">
              <Link to="/login">Girişe dön</Link>
            </p>
          </>
        )}
      </div>
      <Credit />
    </div>
  );
}
