import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { api, apiUpload, API_BASE } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { FONTS } from '../lib/fonts.js';
import Avatar from '../components/Avatar.jsx';
import ThemePicker from '../components/ThemePicker.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const fileRef = useRef(null);
  const avatarFileRef = useRef(null);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  function flash(msg) {
    setInfo(msg);
    setError('');
  }
  function fail(err) {
    setError(err.message || 'Bir hata oluştu');
    setInfo('');
  }

  async function patchProfile(patch) {
    const d = await api('/api/auth/profile', { method: 'PATCH', body: patch });
    setUser(d.user);
  }

  async function saveInfo(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await patchProfile({ displayName, avatarColor });
      flash('Profil bilgileri kaydedildi.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeAppearance(patch) {
    try {
      await patchProfile(patch);
      flash('Görünüm güncellendi.');
    } catch (err) {
      fail(err);
    }
  }

  async function onBannerSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('banner', file);
      const d = await apiUpload('/api/auth/profile/banner', fd);
      setUser(d.user);
      flash('Banner güncellendi.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner() {
    setBusy(true);
    try {
      const d = await api('/api/auth/profile/banner', { method: 'DELETE' });
      setUser(d.user);
      flash('Banner kaldırıldı.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const d = await apiUpload('/api/auth/profile/avatar', fd);
      setUser(d.user);
      flash('Profil fotoğrafı güncellendi.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try {
      const d = await api('/api/auth/profile/avatar', { method: 'DELETE' });
      setUser(d.user);
      flash('Profil fotoğrafı kaldırıldı.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      flash('Şifre değiştirildi.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const bannerUrl = user.bannerPath ? `${API_BASE}${user.bannerPath}` : null;

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Profil</span>
        <button type="button" className="link-btn" onClick={logout}>
          Çıkış yap
        </button>
      </div>

      {user.isAdmin && (
        <Link to="/admin" className="admin-link">
          <Wrench size={18} />
          Yönetim paneli
        </Link>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="profile-banner"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
        >
          <div className="profile-avatar">
            <Avatar
              name={user.displayName}
              color={user.avatarColor}
              avatarPath={user.avatarPath}
              size={72}
            />
          </div>
        </div>
        <div className="banner-actions">
          <button
            type="button"
            className="small secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Banner yükle
          </button>
          {user.bannerPath && (
            <button
              type="button"
              className="small secondary"
              disabled={busy}
              onClick={removeBanner}
            >
              Kaldır
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onBannerSelected}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {info && <div className="badge">{info}</div>}

      <form className="card" onSubmit={saveInfo}>
        <h3>Profil bilgileri</h3>
        <div className="field">
          <label>Profil fotoğrafı</label>
          <div className="color-row">
            <Avatar
              name={user.displayName}
              color={user.avatarColor}
              avatarPath={user.avatarPath}
              size={56}
            />
            <button
              type="button"
              className="small secondary"
              disabled={busy}
              onClick={() => avatarFileRef.current?.click()}
            >
              Fotoğraf yükle
            </button>
            {user.avatarPath && (
              <button
                type="button"
                className="small secondary"
                disabled={busy}
                onClick={removeAvatar}
              >
                Kaldır
              </button>
            )}
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarSelected}
            />
          </div>
        </div>
        <div className="field">
          <label>Görünen ad</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
        {!user.avatarPath && (
          <div className="field">
            <label>Avatar rengi</label>
            <div className="color-row">
              <input
                type="color"
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
              />
              <span className="muted">{avatarColor}</span>
              <Avatar name={displayName} color={avatarColor} size={36} />
            </div>
          </div>
        )}
        <button type="submit" disabled={busy}>
          Kaydet
        </button>
      </form>

      <div className="card">
        <h3>Görünüm</h3>
        <div className="field">
          <label>Tema</label>
          <ThemePicker
            value={user.theme}
            onSelect={(id) => changeAppearance({ theme: id })}
          />
        </div>
        <div className="field">
          <label>Yazı tipi</label>
          <div className="font-list">
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`font-option ${user.fontPref === f.id ? 'selected' : ''}`}
                style={{ fontFamily: f.stack }}
                onClick={() => changeAppearance({ fontPref: f.id })}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form className="card" onSubmit={changePassword}>
        <h3>Şifre değiştir</h3>
        <div className="field">
          <label>Mevcut şifre</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Yeni şifre (en az 6 karakter)</label>
          <input
            type="password"
            value={newPassword}
            minLength={6}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={busy}>
          Şifreyi değiştir
        </button>
      </form>
    </div>
  );
}
