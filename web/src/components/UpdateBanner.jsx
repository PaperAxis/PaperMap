import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

// PaperUpdates istemcisi (yalnizca Android APK).
// Acilista gunde en fazla bir kez updates.paperaxis.com/papermap-android/releases.android.json
// okunur; versionCode bu derlemeninkinden buyukse ust kisimda bir bant gosterilir.
// Indirme ve kurulum kullanicinin onayiyla, sistem tarayicisi + Android paket
// yukleyicisi uzerinden yapilir.
const FEED = 'https://updates.paperaxis.com/papermap-android/';
const BUILD = Number(import.meta.env.VITE_APP_BUILD || 0);
const CHECKED_KEY = 'papermap.update.checkedAt';
const DISMISSED_KEY = 'papermap.update.dismissed';
const DAY = 24 * 60 * 60 * 1000;

function store(fn) {
  try {
    return fn(window.localStorage);
  } catch {
    return null;
  }
}

// package yalniz urun klasorune goreli bir APK adi olabilir.
function safePackage(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+\.apk$/.test(name) ? name : null;
}

export default function UpdateBanner() {
  const [release, setRelease] = useState(null);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || !BUILD) return;
    const last = Number(store((s) => s.getItem(CHECKED_KEY)) || 0);
    if (Date.now() - last < DAY) {
      const cached = store((s) => JSON.parse(s.getItem('papermap.update.release') || 'null'));
      if (cached && cached.versionCode > BUILD) setRelease(cached);
      return;
    }

    const ctrl = new AbortController();
    fetch(`${FEED}releases.android.json`, { cache: 'no-store', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((rel) => {
        store((s) => s.setItem(CHECKED_KEY, String(Date.now())));
        const pkg = safePackage(rel?.package);
        if (!pkg || !Number.isInteger(rel.versionCode)) return;
        const info = { version: String(rel.version || ''), versionCode: rel.versionCode, package: pkg };
        store((s) => s.setItem('papermap.update.release', JSON.stringify(info)));
        if (info.versionCode > BUILD) setRelease(info);
      })
      .catch(() => {
        /* cevrimdisi ya da sunucuya ulasilamadi — sessizce gec */
      });
    return () => ctrl.abort();
  }, []);

  if (!release) return null;
  if (Number(store((s) => s.getItem(DISMISSED_KEY))) === release.versionCode) return null;

  const download = () => {
    window.open(FEED + release.package, '_system');
  };
  const dismiss = () => {
    store((s) => s.setItem(DISMISSED_KEY, String(release.versionCode)));
    setRelease(null);
  };

  return (
    <div className="update-banner" role="status">
      <span>PaperMap {release.version} hazır.</span>
      <button type="button" className="update-banner-action" onClick={download}>
        İndir ve kur
      </button>
      <button type="button" className="update-banner-close" onClick={dismiss} aria-label="Sonra">
        Sonra
      </button>
    </div>
  );
}
