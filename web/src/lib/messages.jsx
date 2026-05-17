import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, getToken } from './api.js';
import { createSocket } from './socket.js';
import { useAuth } from './auth.jsx';

const MessagesContext = createContext(null);

export function MessagesProvider({ children }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const listenersRef = useRef(new Set());

  function reload() {
    api('/api/conversations')
      .then((d) => setConversations(d.conversations))
      .catch(() => {});
  }

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return undefined;
    }
    reload();
    const socket = createSocket(getToken());
    socket.on('message', (payload) => {
      listenersRef.current.forEach((fn) => fn(payload));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) {
          reload();
          return prev;
        }
        const conv = prev[idx];
        const updated = {
          ...conv,
          lastMessage: {
            body: payload.message.body,
            createdAt: payload.message.createdAt,
            senderName: payload.message.senderName,
          },
          updatedAt: payload.message.createdAt,
          unread:
            payload.message.senderId === user.id ? conv.unread : (conv.unread || 0) + 1,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    });
    return () => socket.close();
  }, [user?.id]);

  // Acik sohbet ekranlari canli mesajlari buradan dinler
  function subscribe(fn) {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }

  async function markRead(conversationId) {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
    );
    try {
      await api(`/api/conversations/${conversationId}/read`, { method: 'POST' });
    } catch {
      /* yok say */
    }
  }

  const unreadTotal = conversations.reduce((n, c) => n + (c.unread || 0), 0);

  return (
    <MessagesContext.Provider
      value={{ conversations, unreadTotal, reload, subscribe, markRead }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  return useContext(MessagesContext);
}
