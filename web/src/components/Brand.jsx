import { API_BASE } from '../lib/api.js';
import { useSettings } from '../lib/settings.jsx';

// Uygulama logosu (ayarlandiysa) ya da uygulama adi
export default function Brand() {
  const { appName, logoPath } = useSettings();
  if (logoPath) {
    return (
      <img className="brand-logo" src={`${API_BASE}${logoPath}`} alt={appName} />
    );
  }
  return <h1 className="brand">{appName}</h1>;
}
