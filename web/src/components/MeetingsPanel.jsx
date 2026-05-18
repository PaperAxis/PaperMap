import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from './Avatar.jsx';

function etaText(m) {
  if (m.locationOff) return 'konum paylaşımı kapalı';
  if (m.etaMinutes == null) return 'konum bilinmiyor';
  if (m.arrived) return 'buluşma noktasında';
  const dist =
    m.distanceMeters >= 1000
      ? `${(m.distanceMeters / 1000).toFixed(1)} km`
      : `${m.distanceMeters} m`;
  return `~${m.etaMinutes} dk · ${dist}`;
}

export default function MeetingsPanel({
  meetings,
  onClose,
  onStartPlacing,
  onChanged,
  onFocus,
}) {
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!expanded) {
      setDetail(null);
      return undefined;
    }
    let active = true;
    function load() {
      api(`/api/meetings/${expanded}`)
        .then((d) => {
          if (active) setDetail(d);
        })
        .catch(() => {});
    }
    load();
    const t = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [expanded]);

  async function act(fn) {
    setError('');
    try {
      await fn();
      setExpanded(null);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const remove = (id) =>
    act(() => api(`/api/meetings/${id}`, { method: 'DELETE' }));
  const leave = (id) =>
    act(() => api(`/api/meetings/${id}/leave`, { method: 'POST' }));

  return (
    <div className="peer-panel">
      <div className="peer-panel-head">
        <strong>Buluşmalar</strong>
        <button type="button" className="link-btn" onClick={onClose}>
          Kapat
        </button>
      </div>

      <button type="button" onClick={onStartPlacing} style={{ marginBottom: 12 }}>
        + Yeni buluşma (haritada nokta seç)
      </button>

      {error && (
        <div className="error" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}

      {meetings.length === 0 ? (
        <p className="empty">
          Henüz buluşma yok. Bir nokta seçip kişileri davet et; herkesin oraya
          varış süresini birlikte görün.
        </p>
      ) : (
        <div className="list">
          {meetings.map((mt) => (
            <div key={mt.id} className="family-card">
              <div className="list-item" style={{ border: 'none', padding: 0 }}>
                <div className="info">
                  <div className="name">{mt.label}</div>
                  <div className="sub">
                    {mt.memberCount} kişi{mt.isOwner ? ' · sahibisin' : ''}
                  </div>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="small secondary"
                    onClick={() => onFocus(mt)}
                  >
                    Haritada gör
                  </button>
                  <button
                    type="button"
                    className="small secondary"
                    onClick={() => setExpanded(expanded === mt.id ? null : mt.id)}
                  >
                    {expanded === mt.id ? 'Gizle' : 'Detay'}
                  </button>
                  {mt.isOwner ? (
                    <button
                      type="button"
                      className="small danger"
                      onClick={() => remove(mt.id)}
                    >
                      Sil
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="small danger"
                      onClick={() => leave(mt.id)}
                    >
                      Ayrıl
                    </button>
                  )}
                </div>
              </div>

              {expanded === mt.id && (
                <div className="geofence-people">
                  {!detail ? (
                    <p className="empty">Yükleniyor…</p>
                  ) : (
                    <div className="list">
                      {detail.members.map((m) => (
                        <div key={m.userId} className="list-item">
                          <div className="li-left">
                            <Avatar
                              name={m.displayName}
                              color={m.avatarColor}
                              avatarPath={m.avatarPath}
                              size={36}
                            />
                            <div className="info">
                              <div className="name">
                                {m.displayName}
                                {m.isOwner ? ' (sahip)' : ''}
                              </div>
                              <div className="sub">{etaText(m)}</div>
                            </div>
                          </div>
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
