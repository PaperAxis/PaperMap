// Product imprint: "© 2026 PaperAxis · PaperMap v0.1.0". The version comes
// from package.json (vite.config.js), the end year from the clock.
const START_YEAR = 2026;

export default function Credit() {
  const year = new Date().getFullYear();
  const years = year > START_YEAR ? `${START_YEAR}–${year}` : `${START_YEAR}`;
  return (
    <p className="credit">
      © {years} PaperAxis · PaperMap v{__APP_VERSION__}
    </p>
  );
}
