import { useState } from 'react';
import { api } from '../lib/api.js';

export const PLACE_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#dc2626',
  '#ea580c',
  '#0891b2',
];

export default function PlacesPanel({
  places,
  onClose,
  onStartPlacing,
  onChanged,
  onFocus,
  onNavigate,
}) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
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

  const remove = (id) => act(() => api(`/api/places/${id}`, { method: 'DELETE' }));

  function startEdit(p) {
    if (editing === p.id) {
      setEditing(null);
      return;
    }
    setEditing(p.id);
    setForm({ name: p.name, color: p.color });
  }

  function save(id) {
    if (!form.name.trim()) {
      setError('Yer adı zorunlu');
      return;
    }
    act(async () => {
      await api(`/api/places/${id}`, {
        method: 'PATCH',
        body: { name: form.name.trim(), color: form.color },
      });
      setEditing(null);
    });
  }

  return (
    <div className="peer-panel">
      <div className="peer-panel-head">
        <strong>Kayıtlı yerler</strong>
        <button type="button" className="link-btn" onClick={onClose}>
          Kapat
        </button>
      </div>

      <button type="button" className="mb-2" onClick={onStartPlacing}>
        + Yeni yer (haritada nokta seç)
      </button>

      {error && (
        <div className="error mb-1">
          {error}
        </div>
      )}

      {places.length === 0 ? (
        <p className="empty">
          Henüz kayıtlı yer yok. Sık gittiğin yerleri haritaya işaretle.
        </p>
      ) : (
        <div className="list">
          {places.map((p) => (
            <div key={p.id} className="family-card">
              <div className="list-item flush">
                <button
                  type="button"
                  className="li-left peer-main"
                  onClick={() => onFocus(p)}
                >
                  <span className="place-dot" style={{ background: p.color }} />
                  <div className="info">
                    <div className="name">{p.name}</div>
                  </div>
                </button>
                <div className="actions">
                  <button
                    type="button"
                    className="small"
                    onClick={() => onNavigate(p)}
                  >
                    Yola çık
                  </button>
                  <button
                    type="button"
                    className="small secondary"
                    onClick={() => startEdit(p)}
                  >
                    {editing === p.id ? 'Vazgeç' : 'Düzenle'}
                  </button>
                  <button
                    type="button"
                    className="small danger"
                    onClick={() => remove(p.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>

              {editing === p.id && form && (
                <div className="geofence-edit">
                  <div className="field">
                    <label>Ad</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Renk</label>
                    <div className="color-choices">
                      {PLACE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Renk ${c}`}
                          className={`color-choice ${form.color === c ? 'selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => setForm({ ...form, color: c })}
                        />
                      ))}
                    </div>
                  </div>
                  <button type="button" className="small" onClick={() => save(p.id)}>
                    Kaydet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
