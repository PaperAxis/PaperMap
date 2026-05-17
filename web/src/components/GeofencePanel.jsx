import { useState } from 'react';
import { api } from '../lib/api.js';

export default function GeofencePanel({ geofences, onClose, onStartPlacing, onChanged }) {
  const [expanded, setExpanded] = useState(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function act(fn) {
    setError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const deleteGeofence = (id) =>
    act(() => api(`/api/geofences/${id}`, { method: 'DELETE' }));
  const removeWatch = (gid, uid) =>
    act(() => api(`/api/geofences/${gid}/watches/${uid}`, { method: 'DELETE' }));

  function addWatch(gid) {
    if (!email.trim()) return;
    act(async () => {
      await api(`/api/geofences/${gid}/watches`, {
        method: 'POST',
        body: { email },
      });
      setEmail('');
    });
  }

  return (
    <div className="peer-panel">
      <div className="peer-panel-head">
        <strong>Alanlar</strong>
        <button type="button" className="link-btn" onClick={onClose}>
          Kapat
        </button>
      </div>

      <button type="button" onClick={onStartPlacing} style={{ marginBottom: 12 }}>
        + Yeni alan (haritada nokta seç)
      </button>

      {error && (
        <div className="error" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}

      {geofences.length === 0 ? (
        <p className="empty">
          Henüz alan yok. Yeni bir alan ekleyip seçtiğin kişiler girince/çıkınca
          bildirim al.
        </p>
      ) : (
        <div className="list">
          {geofences.map((g) => (
            <div key={g.id} className="family-card">
              <div className="list-item" style={{ border: 'none', padding: 0 }}>
                <div className="info">
                  <div className="name">{g.name}</div>
                  <div className="sub">
                    {Math.round(g.radius)} m · {g.watches.length} kişi izleniyor
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="small secondary"
                    onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  >
                    {expanded === g.id ? 'Gizle' : 'Kişiler'}
                  </button>
                  <button
                    className="small danger"
                    onClick={() => deleteGeofence(g.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>

              {expanded === g.id && (
                <div style={{ marginTop: 8 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <input
                      type="email"
                      placeholder="İzlenecek kişinin e-postası"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button
                      type="button"
                      className="small"
                      style={{ width: 'auto' }}
                      onClick={() => addWatch(g.id)}
                    >
                      Ekle
                    </button>
                  </div>
                  {g.watches.length === 0 ? (
                    <p className="empty">Kimse izlenmiyor.</p>
                  ) : (
                    <div className="list">
                      {g.watches.map((w) => (
                        <div key={w.userId} className="list-item">
                          <div className="info">
                            <div className="name">{w.displayName}</div>
                            <div className="sub">
                              {w.inside === true
                                ? 'içeride'
                                : w.inside === false
                                  ? 'dışarıda'
                                  : 'henüz bilinmiyor'}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="small secondary"
                            onClick={() => removeWatch(g.id, w.userId)}
                          >
                            Çıkar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
