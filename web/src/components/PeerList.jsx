import { timeAgo } from '../lib/time.js';
import { batteryLabel } from '../lib/battery.js';
import Avatar from './Avatar.jsx';

export default function PeerList({ peers, onSelect }) {
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
        <button
          key={p.userId}
          type="button"
          className="list-item peer-row"
          onClick={() => onSelect(p)}
        >
          <div className="li-left">
            <Avatar
              name={p.displayName}
              color={p.avatarColor}
              avatarPath={p.avatarPath}
              size={40}
            />
            <div className="info">
              <div className="name">{p.displayName}</div>
              <div className="sub">
                {batteryLabel(p.battery, p.charging)
                  ? `${batteryLabel(p.battery, p.charging)} · `
                  : ''}
                {timeAgo(p.updatedAt)}
              </div>
            </div>
          </div>
          <span className="peer-go">→</span>
        </button>
      ))}
    </div>
  );
}
