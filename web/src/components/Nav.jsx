import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Harita', icon: '🗺️', end: true },
  { to: '/friends', label: 'Arkadaşlar', icon: '👥', end: false },
  { to: '/family', label: 'Aile', icon: '🏠', end: false },
];

export default function Nav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="nav-item">
          <span className="nav-icon">{it.icon}</span>
          <span className="nav-label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
