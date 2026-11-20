import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import {
  CATEGORY_LABELS,
  getTheme,
  resolveThemeId,
  themeHex,
  themesByCategory,
} from '../lib/appearance/themes.js';

const GROUPS = Object.entries(themesByCategory());

// Category folders; PaperAxis brand themes first, same catalog as PaperApp.
export default function ThemePicker({ value, onSelect }) {
  const current = getTheme(resolveThemeId(value));
  const [openCategory, setOpenCategory] = useState(current.category);

  return (
    <div className="theme-picker">
      <p className="theme-current">
        <span className="pa-label">Seçili</span> {current.label}
      </p>
      {GROUPS.map(([key, themes]) => {
        const open = openCategory === key;
        const Toggle = open ? ChevronDown : ChevronRight;
        return (
          <div key={key} className="theme-cat">
            <button
              type="button"
              className="theme-cat-head"
              aria-expanded={open}
              onClick={() => setOpenCategory(open ? null : key)}
            >
              <span>{CATEGORY_LABELS[key]}</span>
              <span className="theme-cat-meta">
                <span className="theme-cat-count">{themes.length}</span>
                <Toggle size={18} aria-hidden="true" />
              </span>
            </button>
            {open && (
              <div className={`theme-grid ${key === 'paperaxis' ? 'theme-grid-wide' : ''}`}>
                {themes.map((t) => {
                  const selected = t.id === current.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      title={t.label}
                      aria-label={t.label}
                      aria-pressed={selected}
                      className={`theme-swatch ${selected ? 'selected' : ''}`}
                      style={{ background: t.appBg }}
                      onClick={() => onSelect(t.id)}
                    >
                      <span
                        className="theme-swatch-card"
                        style={{ background: themeHex(t.vars.surface) }}
                      >
                        <span
                          className="theme-swatch-dot"
                          style={{ background: themeHex(t.vars.brand) }}
                        />
                      </span>
                      {key === 'paperaxis' && (
                        <span className="theme-swatch-name" style={{ color: themeHex(t.vars.fg) }}>
                          {t.label}
                        </span>
                      )}
                      {selected && (
                        <span className="theme-swatch-check">
                          <Check size={12} strokeWidth={3} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
