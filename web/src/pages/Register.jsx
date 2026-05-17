import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(email, displayName, password);
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
        <h1 className="brand">PaperMap</h1>
        <p className="muted">Yeni hesap oluştur</p>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Adın"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Şifre (en az 6 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Oluşturuluyor…' : 'Kayıt Ol'}
          </button>
        </form>
        <p className="muted">
          Zaten hesabın var mı? <Link to="/login">Giriş yap</Link>
        </p>
      </div>
    </div>
  );
}
