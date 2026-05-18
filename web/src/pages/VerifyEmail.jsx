import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import Brand from '../components/Brand.jsx';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/auth/verify/${token}`)
      .then(() => setStatus('ok'))
      .catch((e) => {
        setError(e.message);
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Brand />
        <p className="muted">E-posta doğrulama</p>
        {status === 'loading' && <p className="muted">Doğrulanıyor…</p>}
        {status === 'ok' && (
          <div className="badge">
            E-posta adresin doğrulandı. Teşekkürler!
          </div>
        )}
        {status === 'error' && <div className="error">{error}</div>}
        <p className="muted">
          <Link to="/login">Girişe dön</Link>
        </p>
      </div>
    </div>
  );
}
