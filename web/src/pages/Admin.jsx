import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, apiUpload, API_BASE } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSettings } from '../lib/settings.jsx';
import Avatar from '../components/Avatar.jsx';

export default function Admin() {
  const { user } = useAuth();
  const { appName, logoPath, reload: reloadSettings } = useSettings();
  const logoRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [name, setName] = useState(appName);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  function loadUsers(query) {
    api(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!user?.isAdmin) return;
    api('/api/admin/stats')
      .then((d) => setStats(d.stats))
      .catch(() => {});
    loadUsers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setName(appName);
  }, [appName]);

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  function flash(m) {
    setInfo(m);
    setError('');
  }
  function fail(e) {
    setError(e.message || 'Bir hata oluştu');
    setInfo('');
  }
  async function act(fn, msg) {
    try {
      await fn();
      if (msg) flash(msg);
    } catch (e) {
      fail(e);
    }
  }

  const patchUser = (id, body) =>
    act(async () => {
      const d = await api(`/api/admin/users/${id}`, { method: 'PATCH', body });
      setUsers((us) => us.map((u) => (u.id === id ? d.user : u)));
    });

  function deleteUser(id, displayName) {
    if (!window.confirm(`${displayName} silinsin mi? Bu işlem geri alınamaz.`)) return;
    act(async () => {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      setUsers((us) => us.filter((u) => u.id !== id));
    }, 'Kullanıcı silindi.');
  }

  const saveName = () =>
    act(async () => {
      await api('/api/settings', { method: 'PATCH', body: { appName: name } });
      reloadSettings();
    }, 'Uygulama adı kaydedildi.');

  async function onLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await act(async () => {
      const fd = new FormData();
      fd.append('logo', file);
      await apiUpload('/api/settings/logo', fd);
      reloadSettings();
    }, 'Logo güncellendi.');
  }

  const removeLogo = () =>
    act(async () => {
      await api('/api/settings/logo', { method: 'DELETE' });
      reloadSettings();
    }, 'Logo kaldırıldı.');

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Yönetim</span>
      </div>

      {error && <div className="error">{error}</div>}
      {info && <div className="badge">{info}</div>}

      {stats && (
        <div className="card">
          <h3>İstatistik</h3>
          <div className="stat-grid">
            <div className="stat">
              <b>{stats.users}</b> kullanıcı
            </div>
            <div className="stat">
              <b>{stats.families}</b> aile
            </div>
            <div className="stat">
              <b>{stats.conversations}</b> sohbet
            </div>
            <div className="stat">
              <b>{stats.messages}</b> mesaj
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Uygulama ayarları</h3>
        <div className="field">
          <label>Uygulama adı</label>
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" style={{ width: 'auto' }} onClick={saveName}>
              Kaydet
            </button>
          </div>
        </div>
        <div className="field">
          <label>Logo</label>
          <div className="color-row">
            {logoPath ? (
              <img
                className="brand-logo"
                style={{ maxHeight: 40, margin: 0 }}
                src={`${API_BASE}${logoPath}`}
                alt="logo"
              />
            ) : (
              <span className="muted">Logo yok</span>
            )}
            <button
              type="button"
              className="small secondary"
              onClick={() => logoRef.current?.click()}
            >
              Yükle
            </button>
            {logoPath && (
              <button type="button" className="small secondary" onClick={removeLogo}>
                Kaldır
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogo} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Kullanıcılar ({users.length})</h3>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            loadUsers(q);
          }}
        >
          <input
            placeholder="Ad, kullanıcı adı veya e-posta ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" style={{ width: 'auto' }}>
            Ara
          </button>
        </form>
        <div className="list" style={{ marginTop: 10 }}>
          {users.map((u) => (
            <div key={u.id} className="family-card">
              <div className="li-left">
                <Avatar
                  name={u.displayName}
                  color={u.avatarColor}
                  avatarPath={u.avatarPath}
                  size={40}
                />
                <div className="info">
                  <div className="name">
                    {u.displayName}{' '}
                    {u.isAdmin && <span className="badge">Yönetici</span>}{' '}
                    {u.disabled && (
                      <span className="badge badge-danger">Devre dışı</span>
                    )}
                  </div>
                  <div className="sub">@{u.username} · {u.email}</div>
                </div>
              </div>
              {u.id !== user.id && (
                <div className="actions" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="small secondary"
                    onClick={() => patchUser(u.id, { disabled: !u.disabled })}
                  >
                    {u.disabled ? 'Aktifleştir' : 'Devre dışı'}
                  </button>
                  <button
                    type="button"
                    className="small secondary"
                    onClick={() => patchUser(u.id, { isAdmin: !u.isAdmin })}
                  >
                    {u.isAdmin ? 'Yöneticiliği al' : 'Yönetici yap'}
                  </button>
                  <button
                    type="button"
                    className="small danger"
                    onClick={() => deleteUser(u.id, u.displayName)}
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
