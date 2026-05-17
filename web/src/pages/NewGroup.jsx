import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useMessages } from '../lib/messages.jsx';
import Avatar from '../components/Avatar.jsx';

export default function NewGroup() {
  const navigate = useNavigate();
  const { reload } = useMessages();
  const [friends, setFriends] = useState([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/friends')
      .then((d) => setFriends(d.friends))
      .catch(() => {});
  }, []);

  function toggle(uid) {
    setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));
  }

  async function create(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d = await api('/api/conversations/group', {
        method: 'POST',
        body: { name, memberIds: selected },
      });
      reload();
      navigate(`/messages/${d.conversationId}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button type="button" className="link-btn" onClick={() => navigate('/messages')}>
          ← Geri
        </button>
        <span className="page-title">Yeni grup</span>
      </div>

      <form className="card" onSubmit={create}>
        <div className="field">
          <label>Grup adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Üyeler ({selected.length} seçili)</label>
          {friends.length === 0 ? (
            <p className="empty">Önce arkadaş eklemelisin.</p>
          ) : (
            <div className="list">
              {friends.map((f) => (
                <button
                  type="button"
                  key={f.user.id}
                  className={`list-item ${selected.includes(f.user.id) ? 'row-selected' : ''}`}
                  onClick={() => toggle(f.user.id)}
                >
                  <div className="li-left">
                    <Avatar
                      name={f.user.displayName}
                      color={f.user.avatarColor}
                      avatarPath={f.user.avatarPath}
                      size={40}
                    />
                    <div className="info">
                      <div className="name">{f.user.displayName}</div>
                    </div>
                  </div>
                  <span className="peer-go">
                    {selected.includes(f.user.id) ? '✓' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          Grup oluştur
        </button>
      </form>
    </div>
  );
}
