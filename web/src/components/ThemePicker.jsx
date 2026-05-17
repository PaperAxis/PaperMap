import { useState } from 'react';
import { THEME_CATEGORIES, resolveTheme } from '../lib/themes.js';

// Klasorlu (kategori bazli) tema secici
export default function ThemePicker({ value, onSelect }) {
  const current = resolveTheme(value);
  const [openCategory, setOpenCategory] = useState(current.categoryKey);

  return (
    <div className="theme-picker">
      {THEME_CATEGORIES.map((cat) => {
        const open = openCategory === cat.key;
        return (
          <div key={cat.key} className="theme-cat">
            <button
              type="button"
              className="theme-cat-head"
              onClick={() => setOpenCategory(open ? null : cat.key)}
            >
              <span className="theme-cat-name">
                <span className="theme-cat-icon">{cat.icon}</span>
                {cat.name}
              </span>
              <span className="theme-cat-toggle">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
              <div className="theme-grid">
                {cat.themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={t.name}
                    aria-label={t.name}
                    className={`theme-swatch ${t.id === current.id ? 'selected' : ''}`}
                    style={{ background: t.swatchBg }}
                    onClick={() => onSelect(t.id)}
                  >
                    <span
                      className="theme-swatch-dot"
                      style={{ background: t.accent }}
                    />
                    {t.id === current.id && (
                      <span className="theme-swatch-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
