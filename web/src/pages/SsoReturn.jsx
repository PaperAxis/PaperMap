import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { SSO_LABELS, ssoErrorMessage } from '../lib/sso.js';
import Brand from '../components/Brand.jsx';
import Credit from '../components/Credit.jsx';

// Return page after Google / PaperApp: trades the one-time code for a session
// (login) or confirms a newly linked account (link).
export default function SsoReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loginWithToken, setUser } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const provider = params.get('provider') || '';
    const code = params.get('code');
    const err = params.get('error');
    if (err || !code) {
      setError(ssoErrorMessage(err || 'provider_error', provider));
      return;
    }
    api('/api/auth/sso/exchange', { method: 'POST', body: { code } })
      .then((d) => {
        if (d.linked) {
          if (d.user) setUser(d.user);
          navigate(`/profile?linked=${encodeURIComponent(d.provider)}`, { replace: true });
        } else {
          loginWithToken(d.token, d.user);
          navigate('/', { replace: true });
        }
      })
      .catch((e) => setError(e.message || ssoErrorMessage('provider_error', provider)));
  }, [params, navigate, loginWithToken, setUser]);

  const provider = params.get('provider') || '';
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Brand />
        {error ? (
          <>
            <div className="error" role="alert">{error}</div>
            <p className="muted">
              <Link to={user ? '/profile' : '/login'}>{user ? 'Profile dön' : 'Girişe dön'}</Link>
            </p>
          </>
        ) : (
          <p className="muted" role="status">
            {SSO_LABELS[provider] || 'Hesap'} ile giriş yapılıyor…
          </p>
        )}
      </div>
      <Credit />
    </div>
  );
}
