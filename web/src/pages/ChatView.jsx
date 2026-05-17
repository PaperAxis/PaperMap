import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useMessages } from '../lib/messages.jsx';
import { timeAgo } from '../lib/time.js';

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribe, markRead } = useMessages();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    api(`/api/conversations/${id}/messages`)
      .then((d) => {
        setConversation(d.conversation);
        setMessages(d.messages);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    markRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Canli mesajlar
  useEffect(() => {
    return subscribe((payload) => {
      if (payload.conversationId !== id) return;
      setMessages((prev) => [...prev, payload.message]);
      markRead(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    setError('');
    try {
      // Mesaj Socket.IO ile geri gelir (gonderen dahil) — burada eklemeye gerek yok
      await api(`/api/conversations/${id}/messages`, { method: 'POST', body: { body } });
    } catch (err) {
      setError(err.message);
      setText(body);
    }
  }

  const isGroup = conversation && conversation.type !== 'direct';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button
          type="button"
          className="link-btn"
          aria-label="Geri"
          onClick={() => navigate('/messages')}
        >
          ←
        </button>
        <span className="chat-title">{conversation?.title || 'Sohbet'}</span>
      </div>

      <div className="chat-messages">
        {loading && (
          <p className="empty" style={{ textAlign: 'center' }}>
            Yükleniyor…
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p className="empty" style={{ textAlign: 'center' }}>
            Henüz mesaj yok. İlk mesajı sen gönder.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.senderId === user.id ? 'mine' : ''}`}>
            {isGroup && m.senderId !== user.id && (
              <div className="msg-sender">{m.senderName}</div>
            )}
            <div className="msg-bubble">{m.body}</div>
            <div className="msg-time">{timeAgo(m.createdAt)}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <div className="error">{error}</div>}

      <form className="chat-input" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mesaj yaz…"
        />
        <button type="submit">Gönder</button>
      </form>
    </div>
  );
}
