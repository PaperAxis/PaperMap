// Tarayici konum API'si (navigator.geolocation). Konum yalniz sayfa acikken
// izlenir; arka planda paylasim native Android/iOS uygulamalarindadir.

const OPTIONS = { enableHighAccuracy: true, maximumAge: 5000 };

function toPos(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

function unsupported() {
  const err = new Error('Bu tarayıcı konum desteği sunmuyor.');
  err.code = 'UNSUPPORTED';
  return err;
}

// Tek seferlik konum — sohbette yer paylasimi gibi anlik kullanim icin.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(unsupported());
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toPos(pos)),
      reject,
      { ...OPTIONS, timeout: 15000 },
    );
  });
}

// Konum izleme. onUpdate({lat,lng,accuracy}) cagrilir. Durdurma fonksiyonu doner.
// Hata kodlari GeolocationPositionError ile aynidir (1 = izin reddedildi).
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.(unsupported());
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate(toPos(pos)),
    (err) => onError?.(err),
    { ...OPTIONS, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
