import { Link } from 'react-router-dom';
import { Home, Users } from 'lucide-react';
import { useMessages } from '../lib/messages.jsx';
import { timeAgo } from '../lib/time.js';
import Avatar from '../components/Avatar.jsx';

export default function Messages() {
  const { conversations, loading, loadError, reload } = useMessages();

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Sohbetler</span>
        <Link to="/messages/new-group" className="link-btn">
          + Grup
        </Link>
      </div>

      {loading ? (
        <p className="empty">Yükleniyor…</p>
      ) : loadError ? (
        <div className="error">
          Sohbetler yüklenemedi.{' '}
          <button type="button" className="link-btn" onClick={reload}>
            Yeniden dene
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <p className="empty">
          Henüz sohbet yok. Bir arkadaşının profilinden mesaj gönder ya da grup kur.
        </p>
      ) : (
        <div className="list">
          {conversations.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className="list-item">
              <div className="li-left">
                {c.type === 'direct' ? (
                  <Avatar
                    name={c.title}
                    color={c.otherUser?.avatarColor}
                    avatarPath={c.otherUser?.avatarPath}
                    size={44}
                  />
                ) : (
                  <span className="conv-icon">
                    {c.type === 'family' ? <Home size={22} /> : <Users size={22} />}
                  </span>
                )}
                <div className="info">
                  <div className="name">{c.title}</div>
                  <div className="sub">
                    {c.lastMessage
                      ? `${c.lastMessage.senderName}: ${c.lastMessage.body}`
                      : 'Henüz mesaj yok'}
                  </div>
                </div>
              </div>
              <div className="conv-meta">
                {c.lastMessage && (
                  <div className="conv-time">{timeAgo(c.lastMessage.createdAt)}</div>
                )}
                {c.unread > 0 && <span className="conv-unread">{c.unread}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
