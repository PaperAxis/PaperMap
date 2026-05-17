import { NavLink } from 'react-router-dom';
import { useNotifications } from '../lib/notifications.jsx';
import { useMessages } from '../lib/messages.jsx';

const items = [
  { to: '/', label: 'Harita', icon: '🗺️', end: true },
  { to: '/friends', label: 'Arkadaş', icon: '👥', end: false },
  { to: '/family', label: 'Aile', icon: '🏠', end: false },
  { to: '/messages', label: 'Sohbet', icon: '💬', end: false },
  { to: '/notifications', label: 'Bildirim', icon: '🔔', end: false },
  { to: '/profile', label: 'Profil', icon: '👤', end: false },
];

function badge(n) {
  if (!n) return null;
  return <span className="nav-badge">{n > 9 ? '9+' : n}</span>;
}

export default function Nav() {
  const { unread } = useNotifications();
  const { unreadTotal } = useMessages();
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="nav-item">
          <span className="nav-icon">
            {it.icon}
            {it.to === '/notifications' && badge(unread)}
            {it.to === '/messages' && badge(unreadTotal)}
          </span>
          <span className="nav-label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
