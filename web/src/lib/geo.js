import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Native (APK) arka plan konum eklentisi — uygulama arka plandayken/kapaliyken
// de konum bildirir. Web'de bu eklenti yoktur; tarayici API'sine dusulur.
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Konum/uygulama ayarlar ekranini acar (arka plan izni "Her zaman izin ver"
// secilmesi ya da pil optimizasyonunun kapatilmasi icin).
export async function openLocationSettings() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundGeolocation.openSettings();
  } catch {
    /* ayarlar acilamadi */
  }
}

// Tek seferlik konum — sohbette yer paylasimi gibi anlik kullanim icin.
export async function getCurrentPosition() {
  try {
    await Geolocation.requestPermissions();
  } catch {
    /* web'de desteklenmeyebilir */
  }
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

// Konum izleme. onUpdate({lat,lng,accuracy}) cagrilir. Durdurma fonksiyonu doner.
export function watchPosition(onUpdate, onError) {
  if (Capacitor.isNativePlatform()) {
    return watchNative(onUpdate, onError);
  }
  return watchWeb(onUpdate, onError);
}

// --- Native: arka planda da calisir (kalici bildirim gosterir) ---
function watchNative(onUpdate, onError) {
  let watcherId = null;
  let stopped = false;

  BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'PaperMap',
      backgroundMessage: 'Konumun arka planda paylaşılıyor',
      requestPermissions: true,
      stale: false,
      distanceFilter: 15,
    },
    (location, error) => {
      if (error) {
        onError?.(error);
        return;
      }
      if (!location) return;
      onUpdate({
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy ?? null,
      });
    },
  )
    .then((id) => {
      if (stopped) BackgroundGeolocation.removeWatcher({ id });
      else watcherId = id;
    })
    .catch((err) => onError?.(err));

  return () => {
    stopped = true;
    if (watcherId) {
      BackgroundGeolocation.removeWatcher({ id: watcherId });
      watcherId = null;
    }
  };
}

// --- Web: yalnizca uygulama acikken ---
function watchWeb(onUpdate, onError) {
  let watchId = null;
  let cancelled = false;

  (async () => {
    try {
      try {
        await Geolocation.requestPermissions();
      } catch {
        /* web'de desteklenmeyebilir */
      }
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 20000 },
        (pos, err) => {
          if (err) {
            onError?.(err);
            return;
          }
          if (!pos) return;
          onUpdate({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
      );
      if (cancelled) Geolocation.clearWatch({ id });
      else watchId = id;
    } catch (err) {
      onError?.(err);
    }
  })();

  return () => {
    cancelled = true;
    if (watchId) {
      Geolocation.clearWatch({ id: watchId });
      watchId = null;
    }
  };
}
