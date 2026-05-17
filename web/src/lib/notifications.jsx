import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken } from './api.js';
import { createSocket } from './socket.js';
import { useAuth } from './auth.jsx';

const NotificationContext = createContext(null);

function showBrowserNotification(n) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(n.title, { body: n.body });
    } catch {
      /* bazı tarayıcılar yalnızca service worker üzerinden izin verir */
    }
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      return undefined;
    }
    api('/api/notifications')
      .then((d) => {
        setNotifications(d.notifications);
        setUnread(d.unread);
      })
      .catch(() => {});

    const socket = createSocket(getToken());
    socket.on('notification', (n) => {
      setNotifications((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
      showBrowserNotification(n);
    });
    return () => socket.close();
  }, [user?.id]);

  async function markAllRead() {
    setUnread(0);
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    try {
      await api('/api/notifications/read', { method: 'POST' });
    } catch {
      /* yok say */
    }
  }

  return (
    <NotificationContext.Provider value={{ notifications, unread, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
