import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { api, getToken } from './api.js';
import { createSocket } from './socket.js';
import { registerPush } from './pushClient.js';
import { requestLocalNotifications, showLocalNotification } from './localNotify.js';
import { useAuth } from './auth.jsx';

const NotificationContext = createContext(null);

// Native'de OS yerel bildirimi, web'de tarayici Notification API'si.
function showOsNotification(n) {
  if (Capacitor.isNativePlatform()) {
    showLocalNotification(n.title, n.body);
    return;
  }
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
      showOsNotification(n);
    });

    // APK'da FCM push'a kaydol (uygulama kapaliyken bildirim icin)
    registerPush();
    // Native'de yerel bildirim izni — iOS'ta push olmadan bildirim gostermek icin
    requestLocalNotifications();

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
