export default function Avatar({ name, color, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="avatar"
      style={{
        background: color || '#10b981',
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </span>
  );
}
