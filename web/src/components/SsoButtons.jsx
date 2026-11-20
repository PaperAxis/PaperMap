import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { SSO_LABELS, ssoStartUrl } from '../lib/sso.js';

// "ya da" divider + one button per configured provider. Renders nothing
// when the server has no provider set up.
export default function SsoButtons() {
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    let alive = true;
    api('/api/auth/sso/providers')
      .then((d) => alive && setProviders(Array.isArray(d.providers) ? d.providers : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (providers.length === 0) return null;
  return (
    <div className="sso">
      <div className="sso-divider" role="separator">
        <span>ya da</span>
      </div>
      {providers.map((p) => (
        <button
          key={p}
          type="button"
          className="secondary"
          onClick={() => {
            window.location.href = ssoStartUrl(p);
          }}
        >
          {SSO_LABELS[p] || p} ile devam et
        </button>
      ))}
    </div>
  );
}
