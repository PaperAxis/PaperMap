import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function GeofencePanel({ geofences, onClose, onStartPlacing, onChanged }) {
  const [expanded, setExpanded] = useState(null); // kişiler görünür olan alan
  const [editing, setEditing] = useState(null); // düzenlenen alan
  const [editForm, setEditForm] = useState(null);
  const [candidates, setCandidates] = useState({ friends: [], family: null });
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/geofences/candidates')
      .then((d) => setCandidates({ friends: d.friends || [], family: d.family || null }))
      .catch(() => {});
  }, []);

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

  function openPeople(g) {
    setEditing(null);
    setSelected(new Set());
    setExpanded(expanded === g.id ? null : g.id);
  }

  function startEdit(g) {
    setExpanded(null);
    if (editing === g.id) {
      setEditing(null);
      return;
    }
    setEditing(g.id);
    setEditForm({
      name: g.name,
      radius: Math.round(g.radius),
      notifyOnEnter: g.notifyOnEnter,
      notifyOnExit: g.notifyOnExit,
    });
  }

  function saveEdit(gid) {
    if (!editForm.name.trim()) {
      setError('Alan adı zorunlu');
      return;
    }
    act(async () => {
      await api(`/api/geofences/${gid}`, {
        method: 'PATCH',
        body: {
          name: editForm.name.trim(),
          radius: Number(editForm.radius),
          notifyOnEnter: editForm.notifyOnEnter,
          notifyOnExit: editForm.notifyOnExit,
        },
      });
      setEditing(null);
    });
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected(gid) {
    if (selected.size === 0) return;
    act(async () => {
      await api(`/api/geofences/${gid}/watches`, {
        method: 'POST',
        body: { userIds: [...selected] },
      });
      setSelected(new Set());
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
          {geofences.map((g) => {
            const watched = new Set(g.watches.map((w) => w.userId));
            const famMembers = (candidates.family?.members || []).filter(
              (m) => !watched.has(m.id),
            );
            const famIds = new Set((candidates.family?.members || []).map((m) => m.id));
            const friendOpts = candidates.friends.filter(
              (f) => !watched.has(f.id) && !famIds.has(f.id),
            );

            return (
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
                      type="button"
                      className="small secondary"
                      onClick={() => startEdit(g)}
                    >
                      {editing === g.id ? 'Vazgeç' : 'Düzenle'}
                    </button>
                    <button
                      type="button"
                      className="small secondary"
                      onClick={() => openPeople(g)}
                    >
                      {expanded === g.id ? 'Gizle' : 'Kişiler'}
                    </button>
                    <button
                      type="button"
                      className="small danger"
                      onClick={() => deleteGeofence(g.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>

                {editing === g.id && editForm && (
                  <div className="geofence-edit">
                    <div className="field">
                      <label>Alan adı</label>
                      <input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Yarıçap: {editForm.radius} m</label>
                      <input
                        type="range"
                        min="50"
                        max="5000"
                        step="50"
                        value={editForm.radius}
                        onChange={(e) =>
                          setEditForm({ ...editForm, radius: e.target.value })
                        }
                      />
                    </div>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={editForm.notifyOnEnter}
                        onChange={(e) =>
                          setEditForm({ ...editForm, notifyOnEnter: e.target.checked })
                        }
                      />
                      <span>Girişte bildir</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={editForm.notifyOnExit}
                        onChange={(e) =>
                          setEditForm({ ...editForm, notifyOnExit: e.target.checked })
                        }
                      />
                      <span>Çıkışta bildir</span>
                    </label>
                    <div className="row" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="small secondary"
                        onClick={() => setEditing(null)}
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        className="small"
                        onClick={() => saveEdit(g.id)}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                )}

                {expanded === g.id && (
                  <div className="geofence-people">
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

                    {famMembers.length === 0 && friendOpts.length === 0 ? (
                      <p className="empty" style={{ marginTop: 8 }}>
                        Eklenebilecek kişi yok.
                      </p>
                    ) : (
                      <div className="geofence-add">
                        <div className="add-head">Kişi ekle</div>
                        {famMembers.length > 0 && (
                          <div className="add-group">
                            <div className="add-group-head">
                              <span>{candidates.family.name} (aile)</span>
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() =>
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    const allIn = famMembers.every((m) =>
                                      next.has(m.id),
                                    );
                                    for (const m of famMembers) {
                                      if (allIn) next.delete(m.id);
                                      else next.add(m.id);
                                    }
                                    return next;
                                  })
                                }
                              >
                                {famMembers.every((m) => selected.has(m.id))
                                  ? 'Kaldır'
                                  : 'Tümünü seç'}
                              </button>
                            </div>
                            {famMembers.map((m) => (
                              <label key={m.id} className="check-row">
                                <input
                                  type="checkbox"
                                  checked={selected.has(m.id)}
                                  onChange={() => toggle(m.id)}
                                />
                                <span>{m.displayName}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {friendOpts.length > 0 && (
                          <div className="add-group">
                            <div className="add-group-head">
                              <span>Arkadaşlar</span>
                            </div>
                            {friendOpts.map((f) => (
                              <label key={f.id} className="check-row">
                                <input
                                  type="checkbox"
                                  checked={selected.has(f.id)}
                                  onChange={() => toggle(f.id)}
                                />
                                <span>{f.displayName}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="small"
                          disabled={selected.size === 0}
                          onClick={() => addSelected(g.id)}
                        >
                          Seçilenleri ekle ({selected.size})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
