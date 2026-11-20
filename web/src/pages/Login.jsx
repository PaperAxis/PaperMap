import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { getRememberedLogin } from '../lib/api.js';
import Brand from '../components/Brand.jsx';
import Credit from '../components/Credit.jsx';
import SsoButtons from '../components/SsoButtons.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState(getRememberedLogin);
  const [remember, setRemember] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(loginId, password, remember);
      navigate('/');
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
        <p className="muted">Hesabına giriş yap</p>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Kullanıcı adı veya e-posta"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
          <PasswordInput
            autoComplete="current-password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Beni hatırla</span>
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
        <SsoButtons />
        <p className="muted">
          Hesabın yok mu? <Link to="/register">Kayıt ol</Link>
        </p>
        <p className="muted">
          <Link to="/forgot">Şifreni mi unuttun?</Link>
        </p>
      </div>
      <Credit />
    </div>
  );
}
