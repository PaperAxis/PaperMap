import { Geolocation } from '@capacitor/geolocation';

// Konum izleme. Capacitor Geolocation eklentisi mobilde native konumu,
// tarayicida ise navigator.geolocation'i kullanir.
export function watchPosition(onUpdate, onError) {
  let watchId = null;
  let cancelled = false;

  (async () => {
    try {
      try {
        await Geolocation.requestPermissions();
      } catch {
        // Web'de requestPermissions desteklenmeyebilir; izleme yine de denenir.
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
      if (cancelled) {
        Geolocation.clearWatch({ id });
      } else {
        watchId = id;
      }
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
