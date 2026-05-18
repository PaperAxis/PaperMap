import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

export default function Family() {
  const [families, setFamilies] = useState([]);
  const [details, setDetails] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const d = await api('/api/families');
      setFamilies(d.families);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  // Bir kişi en fazla 1 ailede olabilir
  const family = families[0] || null;

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Aile</span>
      </div>

      {error && <div className="error">{error}</div>}
      {info && <div className="badge">{info}</div>}

      {loading ? (
        <p className="empty">Yükleniyor…</p>
      ) : family ? (
        <div className="card">
          <h3>Aileniz</h3>
          <div className="family-card">
            <div className="list-item flush">
              <div className="info">
                <div className="name">
                  {family.name}{' '}
                  {family.role === 'owner' && <span className="badge">Sahip</span>}
                </div>
                <div className="sub">{family.memberCount} üye</div>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="small secondary"
                  onClick={() => toggleMembers(family.id)}
                >
                  {expanded === family.id ? 'Gizle' : 'Üyeler'}
                </button>
                <button
                  type="button"
                  className="small danger"
                  onClick={() => leaveFamily(family.id)}
                >
                  Ayrıl
                </button>
              </div>
            </div>

            <div className="invite-code">
              Davet kodu: <strong>{family.inviteCode}</strong>
            </div>

            {expanded === family.id && details[family.id] && (
              <div className="list mt-1">
                {details[family.id].members.map((m) => (
                  <div key={m.id} className="list-item">
                    <Link to={`/users/${m.id}`} className="li-left">
                      <Avatar
                        name={m.displayName}
                        color={m.avatarColor}
                        avatarPath={m.avatarPath}
                        size={40}
                      />
                      <div className="info">
                        <div className="name">
                          {m.displayName}{' '}
                          {m.role === 'owner' && (
                            <span className="badge">Sahip</span>
                          )}
                        </div>
                        <div className="sub">@{m.username}</div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <p className="empty">
            Henüz bir ailen yok. Bir aile oluştur ya da davet koduyla katıl.
          </p>

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
              <button type="submit" className="btn-auto" disabled={busy}>
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
              <button type="submit" className="btn-auto" disabled={busy}>
                Katıl
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
