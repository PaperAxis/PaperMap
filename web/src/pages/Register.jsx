import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Brand from '../components/Brand.jsx';
import Credit from '../components/Credit.jsx';
import SsoButtons from '../components/SsoButtons.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(displayName, username, email, password);
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
        <p className="muted">Yeni hesap oluştur</p>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Adın (ör. Mehmet)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Kullanıcı adı (arkadaşların seni bununla bulur)"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
            pattern="[a-z0-9_]{3,20}"
            title="3-20 karakter: küçük harf, rakam ve alt çizgi"
            required
          />
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            autoComplete="new-password"
            placeholder="Şifre (en az 8 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Oluşturuluyor…' : 'Kayıt Ol'}
          </button>
        </form>
        <SsoButtons />
        <p className="muted">
          Zaten hesabın var mı? <Link to="/login">Giriş yap</Link>
        </p>
      </div>
      <Credit />
    </div>
  );
}
