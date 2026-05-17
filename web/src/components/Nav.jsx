import { NavLink } from 'react-router-dom';
import { Map, Users, Home, MessageCircle, Bell, User } from 'lucide-react';
import { useNotifications } from '../lib/notifications.jsx';
import { useMessages } from '../lib/messages.jsx';

const items = [
  { to: '/', label: 'Harita', Icon: Map, end: true },
  { to: '/friends', label: 'Arkadaş', Icon: Users, end: false },
  { to: '/family', label: 'Aile', Icon: Home, end: false },
  { to: '/messages', label: 'Sohbet', Icon: MessageCircle, end: false },
  { to: '/notifications', label: 'Bildirim', Icon: Bell, end: false },
  { to: '/profile', label: 'Profil', Icon: User, end: false },
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
      {items.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="nav-item">
          <span className="nav-icon">
            <Icon size={22} strokeWidth={2} />
            {to === '/notifications' && badge(unread)}
            {to === '/messages' && badge(unreadTotal)}
          </span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
