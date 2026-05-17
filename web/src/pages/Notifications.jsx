import { useEffect } from 'react';
import { useNotifications } from '../lib/notifications.jsx';
import { timeAgo } from '../lib/time.js';

export default function Notifications() {
  const { notifications, markAllRead } = useNotifications();

  useEffect(() => {
    markAllRead();
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Bildirimler</span>
      </div>

      {notifications.length === 0 ? (
        <p className="empty">Henüz bildirim yok. Alan giriş/çıkışları burada görünür.</p>
      ) : (
        <div className="list">
          {notifications.map((n) => (
            <div key={n.id} className={`list-item notif-item ${n.readAt ? '' : 'unread'}`}>
              <div className="info">
                <div className="name">{n.title}</div>
                <div className="notif-body">{n.body}</div>
                <div className="sub">{timeAgo(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
