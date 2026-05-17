import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

export default function Friends() {
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await api('/api/friends'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function sendRequest(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await api('/api/friends', { method: 'POST', body: { email } });
      setInfo('Arkadaşlık isteği gönderildi.');
      setEmail('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(fn) {
    setError('');
    setInfo('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const accept = (id) =>
    act(() => api(`/api/friends/${id}/accept`, { method: 'POST' }));
  const remove = (id) =>
    act(() => api(`/api/friends/${id}`, { method: 'DELETE' }));

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Arkadaşlar</span>
      </div>

      <div className="card">
        <h3>Arkadaş ekle</h3>
        <form className="row" onSubmit={sendRequest}>
          <input
            type="email"
            placeholder="Arkadaşının e-postası"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={busy} style={{ width: 'auto' }}>
            Gönder
          </button>
        </form>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        {info && <div className="badge" style={{ marginTop: 10 }}>{info}</div>}
      </div>

      {data.incoming.length > 0 && (
        <div className="card">
          <h3>Gelen istekler</h3>
          <div className="list">
            {data.incoming.map((f) => (
              <div key={f.friendshipId} className="list-item">
                <div className="li-left">
                  <Avatar
                    name={f.user.displayName}
                    color={f.user.avatarColor}
                    avatarPath={f.user.avatarPath}
                    size={40}
                  />
                  <div className="info">
                    <div className="name">{f.user.displayName}</div>
                    <div className="sub">{f.user.email}</div>
                  </div>
                </div>
                <div className="actions">
                  <button className="small" onClick={() => accept(f.friendshipId)}>
                    Kabul
                  </button>
                  <button
                    className="small secondary"
                    onClick={() => remove(f.friendshipId)}
                  >
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.outgoing.length > 0 && (
        <div className="card">
          <h3>Gönderilen istekler</h3>
          <div className="list">
            {data.outgoing.map((f) => (
              <div key={f.friendshipId} className="list-item">
                <div className="li-left">
                  <Avatar
                    name={f.user.displayName}
                    color={f.user.avatarColor}
                    avatarPath={f.user.avatarPath}
                    size={40}
                  />
                  <div className="info">
                    <div className="name">{f.user.displayName}</div>
                    <div className="sub">{f.user.email}</div>
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="small secondary"
                    onClick={() => remove(f.friendshipId)}
                  >
                    İptal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Arkadaşların ({data.friends.length})</h3>
        {data.friends.length === 0 ? (
          <p className="empty">Henüz arkadaşın yok. Yukarıdan e-posta ile ekle.</p>
        ) : (
          <div className="list">
            {data.friends.map((f) => (
              <div key={f.friendshipId} className="list-item">
                <div className="li-left">
                  <Avatar
                    name={f.user.displayName}
                    color={f.user.avatarColor}
                    avatarPath={f.user.avatarPath}
                    size={40}
                  />
                  <div className="info">
                    <div className="name">{f.user.displayName}</div>
                    <div className="sub">{f.user.email}</div>
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="small secondary"
                    onClick={() => remove(f.friendshipId)}
                  >
                    Çıkar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
