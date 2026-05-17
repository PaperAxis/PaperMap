import { NavLink } from 'react-router-dom';
import { useNotifications } from '../lib/notifications.jsx';

const items = [
  { to: '/', label: 'Harita', icon: '🗺️', end: true },
  { to: '/friends', label: 'Arkadaş', icon: '👥', end: false },
  { to: '/family', label: 'Aile', icon: '🏠', end: false },
  { to: '/notifications', label: 'Bildirim', icon: '🔔', end: false },
  { to: '/profile', label: 'Profil', icon: '👤', end: false },
];

export default function Nav() {
  const { unread } = useNotifications();
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="nav-item">
          <span className="nav-icon">
            {it.icon}
            {it.to === '/notifications' && unread > 0 && (
              <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>
            )}
          </span>
          <span className="nav-label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
