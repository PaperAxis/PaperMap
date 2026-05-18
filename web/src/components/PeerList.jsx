import { timeAgo } from '../lib/time.js';
import { batteryLabel } from '../lib/battery.js';
import Avatar from './Avatar.jsx';

export default function PeerList({ peers, trips = {}, onSelect, onHistory }) {
  if (peers.length === 0) {
    return (
      <p className="empty">
        Henüz haritada kimse yok. Arkadaş ekle veya bir aileye katıl; konum
        paylaşımı açık olan kişiler burada görünür.
      </p>
    );
  }
  return (
    <div className="list">
      {peers.map((p) => (
        <div key={p.userId} className="list-item peer-row">
          <button
            type="button"
            className="li-left peer-main"
            onClick={() => onSelect(p)}
          >
            <Avatar
              name={p.displayName}
              color={p.avatarColor}
              avatarPath={p.avatarPath}
              size={40}
            />
            <div className="info">
              <div className="name">{p.displayName}</div>
              {p.statusText && <div className="sub peer-status">{p.statusText}</div>}
              <div className="sub">
                {batteryLabel(p.battery, p.charging)
                  ? `${batteryLabel(p.battery, p.charging)} · `
                  : ''}
                {timeAgo(p.updatedAt)}
              </div>
              {trips[p.userId] && (
                <div className="sub trip-sub">
                  → {trips[p.userId].destLabel} · ~{trips[p.userId].etaMinutes} dk
                </div>
              )}
            </div>
          </button>
          <button
            type="button"
            className="small secondary"
            onClick={() => onHistory(p)}
          >
            Geçmiş
          </button>
        </div>
      ))}
    </div>
  );
}
