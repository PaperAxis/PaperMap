import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import { getCurrentPosition } from '../lib/geo.js';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [places, setPlaces] = useState([]);
  const [pickerBusy, setPickerBusy] = useState(false);
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

  async function sendPlace(place) {
    setError('');
    try {
      await api(`/api/conversations/${id}/messages`, {
        method: 'POST',
        body: { placeLat: place.lat, placeLng: place.lng, placeLabel: place.name },
      });
      setPickerOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  function openPicker() {
    setPickerOpen(true);
    api('/api/places')
      .then((d) => setPlaces(d.places))
      .catch(() => {});
  }

  async function sendCurrentLocation() {
    setPickerBusy(true);
    setError('');
    try {
      const pos = await getCurrentPosition();
      await sendPlace({ lat: pos.lat, lng: pos.lng, name: 'Şu anki konumum' });
    } catch {
      setError('Konum alınamadı. Konum izni verildiğinden emin olun.');
    } finally {
      setPickerBusy(false);
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
          <ArrowLeft size={20} />
        </button>
        <span className="chat-title">{conversation?.title || 'Sohbet'}</span>
      </div>

      <div className="chat-messages">
        {loading && (
          <p className="empty center-text">
            Yükleniyor…
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p className="empty center-text">
            Henüz mesaj yok. İlk mesajı sen gönder.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.senderId === user.id ? 'mine' : ''}`}>
            {isGroup && m.senderId !== user.id && (
              <div className="msg-sender">{m.senderName}</div>
            )}
            {m.placeLat != null ? (
              <button
                type="button"
                className="msg-bubble msg-place"
                onClick={() => navigate(`/?focus=${m.placeLat},${m.placeLng}`)}
              >
                <MapPin size={18} />
                <span className="msg-place-label">{m.placeLabel || 'Konum'}</span>
                <span className="msg-place-go">Haritada göster</span>
              </button>
            ) : (
              <div className="msg-bubble">{m.body}</div>
            )}
            <div className="msg-time">{timeAgo(m.createdAt)}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <div className="error">{error}</div>}

      <form className="chat-input" onSubmit={send}>
        <button
          type="button"
          className="chat-place-btn"
          aria-label="Konum paylaş"
          onClick={openPicker}
        >
          <MapPin size={20} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mesaj yaz…"
        />
        <button type="submit">Gönder</button>
      </form>

      {pickerOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Konum paylaş</h3>
            <button
              type="button"
              className="mb-1"
              disabled={pickerBusy}
              onClick={sendCurrentLocation}
            >
              {pickerBusy ? 'Konum alınıyor…' : 'Şu anki konumum'}
            </button>
            {places.length > 0 && (
              <div className="list">
                {places.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="list-item link-row"
                    onClick={() => sendPlace(p)}
                  >
                    <div className="li-left">
                      <span
                        className="place-dot"
                        style={{ background: p.color }}
                        aria-hidden="true"
                      />
                      <div className="info">
                        <div className="name">{p.name}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {places.length === 0 && (
              <p className="empty">Kayıtlı yerin yok. Haritadan yer ekleyebilirsin.</p>
            )}
            <button
              type="button"
              className="secondary mt-1"
              onClick={() => setPickerOpen(false)}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
