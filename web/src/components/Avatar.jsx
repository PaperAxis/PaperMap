import { API_BASE } from '../lib/api.js';

// Profil fotografi varsa onu, yoksa renkli bas harf rozetini gosterir.
export default function Avatar({ name, color, avatarPath, size = 40 }) {
  if (avatarPath) {
    return (
      <span
        className="avatar"
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${API_BASE}${avatarPath})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    );
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="avatar"
      style={{
        background: color || '#315bdb',
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </span>
  );
}
