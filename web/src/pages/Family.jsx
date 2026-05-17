import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Family() {
  const [families, setFamilies] = useState([]);
  const [details, setDetails] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api('/api/families');
      setFamilies(d.families);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createFamily(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await api('/api/families', { method: 'POST', body: { name } });
      setName('');
      setInfo('Aile oluşturuldu.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinFamily(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await api('/api/families/join', { method: 'POST', body: { inviteCode: code } });
      setCode('');
      setInfo('Aileye katıldın.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMembers(id) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      try {
        const d = await api(`/api/families/${id}`);
        setDetails((prev) => ({ ...prev, [id]: d }));
      } catch (err) {
        setError(err.message);
      }
    }
  }

  async function leaveFamily(id) {
    setError('');
    setInfo('');
    try {
      await api(`/api/families/${id}/leave`, { method: 'DELETE' });
      setDetails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpanded(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Aile</span>
      </div>

      <div className="card">
        <h3>Aile oluştur</h3>
        <form className="row" onSubmit={createFamily}>
          <input
            type="text"
            placeholder="Aile adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" disabled={busy} style={{ width: 'auto' }}>
            Oluştur
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Davet koduyla katıl</h3>
        <form className="row" onSubmit={joinFamily}>
          <input
            type="text"
            placeholder="Davet kodu"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <button type="submit" disabled={busy} style={{ width: 'auto' }}>
            Katıl
          </button>
        </form>
      </div>

      {error && <div className="error">{error}</div>}
      {info && <div className="badge">{info}</div>}

      <div className="card">
        <h3>Ailelerin ({families.length})</h3>
        {families.length === 0 ? (
          <p className="empty">
            Henüz bir ailen yok. Aile oluştur ve davet kodunu paylaş.
          </p>
        ) : (
          <div className="list">
            {families.map((fam) => (
              <div key={fam.id} className="family-card">
                <div className="list-item" style={{ border: 'none', padding: 0 }}>
                  <div className="info">
                    <div className="name">
                      {fam.name}{' '}
                      {fam.role === 'owner' && <span className="badge">Sahip</span>}
                    </div>
                    <div className="sub">{fam.memberCount} üye</div>
                  </div>
                  <div className="actions">
                    <button
                      className="small secondary"
                      onClick={() => toggleMembers(fam.id)}
                    >
                      {expanded === fam.id ? 'Gizle' : 'Üyeler'}
                    </button>
                    <button
                      className="small danger"
                      onClick={() => leaveFamily(fam.id)}
                    >
                      Ayrıl
                    </button>
                  </div>
                </div>

                <div className="invite-code">
                  Davet kodu: <strong>{fam.inviteCode}</strong>
                </div>

                {expanded === fam.id && details[fam.id] && (
                  <div className="list" style={{ marginTop: 8 }}>
                    {details[fam.id].members.map((m) => (
                      <div key={m.id} className="list-item">
                        <div className="info">
                          <div className="name">
                            {m.displayName}{' '}
                            {m.role === 'owner' && (
                              <span className="badge">Sahip</span>
                            )}
                          </div>
                          <div className="sub">{m.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
