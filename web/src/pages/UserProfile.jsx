import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { api, API_BASE } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Avatar from '../components/Avatar.jsx';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  async function startChat() {
    try {
      const d = await api('/api/conversations/direct', {
        method: 'POST',
        body: { userId: id },
      });
      navigate(`/messages/${d.conversationId}`);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    setUser(null);
    setError('');
    api(`/api/users/${id}`)
      .then((d) => setUser(d.user))
      .catch((e) => setError(e.message));
  }, [id]);

  const bannerUrl = user?.bannerPath ? `${API_BASE}${user.bannerPath}` : null;

  return (
    <div className="page">
      <div className="page-header">
        <button type="button" className="link-btn" onClick={() => navigate(-1)}>
          ← Geri
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {!error && !user && <p className="empty">Yükleniyor…</p>}

      {user && (
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
          <div style={{ padding: '38px 16px 16px' }}>
            <div className="page-title">{user.displayName}</div>
            <div className="muted">{user.email}</div>
          </div>
        </div>
      )}

      {user && me?.id !== user.id && (
        <button type="button" onClick={startChat}>
          <MessageCircle size={18} />
          Mesaj gönder
        </button>
      )}
    </div>
  );
}
