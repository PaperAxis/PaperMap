// Konum izleme yardimcisi.
// Adim 10'da Capacitor Geolocation eklentisiyle degistirilecek
// (eklenti web'de de tarayici API'sine fallback yapar).
export function watchPosition(onUpdate, onError) {
  if (!('geolocation' in navigator)) {
    onError?.(new Error('Bu cihaz konum desteği sunmuyor'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
