import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import Brand from '../components/Brand.jsx';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/reset', {
        method: 'POST',
        body: { token, newPassword },
      });
      setDone(true);
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
        <p className="muted">Yeni şifre belirle</p>
        {done ? (
          <>
            <div className="badge">
              Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin.
            </div>
            <button type="button" onClick={() => navigate('/login')}>
              Girişe git
            </button>
          </>
        ) : (
          <>
            <form onSubmit={onSubmit}>
              <input
                type="password"
                placeholder="Yeni şifre (en az 8 karakter)"
                value={newPassword}
                minLength={8}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              {error && <div className="error">{error}</div>}
              <button type="submit" disabled={busy}>
                {busy ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
              </button>
            </form>
            <p className="muted">
              <Link to="/login">Girişe dön</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
