import { prisma } from './prisma.js';
import { createNotification } from './notify.js';

// İki konum arasi mesafe (metre) — haversine
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Bir kullanicinin konumu guncellenince, izlendigi geofence'lerde
// giris/cikis gecisi olup olmadigini kontrol eder ve sahibine bildirim olusturur.
export async function checkGeofences(userId, lat, lng) {
  const watches = await prisma.geofenceWatch.findMany({
    where: { userId },
    include: { geofence: true, user: true },
  });

  for (const watch of watches) {
    const g = watch.geofence;
    const inside = distanceMeters(lat, lng, g.lat, g.lng) <= g.radius;
    if (watch.inside === inside) continue;

    const firstObservation = watch.inside === null;
    await prisma.geofenceWatch.update({
      where: { id: watch.id },
      data: { inside },
    });
    if (firstObservation) continue; // ilk gozlemde bildirim gonderilmez

    if (inside && g.notifyOnEnter) {
      await createNotification(
        g.ownerId,
        'Alan bildirimi',
        `${watch.user.displayName}, "${g.name}" alanına girdi`,
      );
    } else if (!inside && g.notifyOnExit) {
      await createNotification(
        g.ownerId,
        'Alan bildirimi',
        `${watch.user.displayName}, "${g.name}" alanından çıktı`,
      );
    }
  }
}
