import { Server } from 'socket.io';
import { verifyToken } from './auth.js';
import { isAllowedOrigin } from './config.js';
import { prisma } from './prisma.js';
import { relatedUserIds, hiddenByUser, peersWhoHidFrom } from './visibility.js';
import { setIo } from './realtime.js';
import { checkGeofences, distanceMeters } from './geofence.js';
import { createNotification } from './notify.js';

let io = null;

function room(userId) {
  return `user:${userId}`;
}

// Konum gecmisi kayit kisitlamasi — her konum guncellemesi degil,
// en az 2 dk gecince ya da 120 m hareket olunca yeni nokta yazilir.
const HISTORY_MIN_INTERVAL_MS = 2 * 60 * 1000;
const HISTORY_MIN_DISTANCE_M = 120;
const lastHistory = new Map();

// Dusuk pil bildirimi — esigin altina ilk inişte bir kez bildirilir
const LOW_BATTERY = 15;
const lastBattery = new Map();

async function notifyLowBattery(userId, name, battery) {
  try {
    const related = await relatedUserIds(userId);
    for (const peerId of related) {
      createNotification(
        peerId,
        'Düşük pil',
        `${name} adlı kişinin telefon pili %${battery}`,
      ).catch(() => {});
    }
  } catch (err) {
    console.error('düşük pil bildirimi:', err);
  }
}

// Yolculuk ETA'si icin hiz takibi (m/s) — son konumlardan yumusatilmis
const DEFAULT_SPEED = 8.3; // ~30 km/s
const lastFix = new Map();

function trackSpeed(userId, lat, lng) {
  const prev = lastFix.get(userId);
  const now = Date.now();
  let speed = prev?.speed ?? DEFAULT_SPEED;
  if (prev) {
    const dt = (now - prev.at) / 1000;
    if (dt >= 5) {
      const inst = distanceMeters(prev.lat, prev.lng, lat, lng) / dt;
      const clamped = Math.min(Math.max(inst, 1), 33);
      speed = prev.speed != null ? prev.speed * 0.5 + clamped * 0.5 : clamped;
    }
  }
  lastFix.set(userId, { lat, lng, at: now, speed });
  return speed;
}

// Etkin yolculugu iliskili (gizlenmemis) kisilere ve kullanicinin kendisine
// yayinlar; hedefe varilmissa yolculugu sonlandirir.
export async function broadcastTrip(userId) {
  if (!io) return;
  const trip = await prisma.trip.findUnique({ where: { userId } });
  if (!trip) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { location: true },
  });
  if (!user?.location) return;

  const related = await relatedUserIds(userId);
  const hidden = await hiddenByUser(userId);
  const recipients = [userId, ...[...related].filter((id) => !hidden.has(id))];
  const dist = distanceMeters(
    user.location.lat,
    user.location.lng,
    trip.destLat,
    trip.destLng,
  );

  if (dist <= 150) {
    await prisma.trip.delete({ where: { userId } }).catch(() => {});
    for (const id of recipients) io.to(room(id)).emit('trip:ended', { userId });
    return;
  }
  const speed = lastFix.get(userId)?.speed ?? DEFAULT_SPEED;
  const payload = {
    userId,
    displayName: user.displayName,
    destLat: trip.destLat,
    destLng: trip.destLng,
    destLabel: trip.destLabel,
    distanceMeters: Math.round(dist),
    etaMinutes: Math.max(1, Math.round(dist / speed / 60)),
  };
  for (const id of recipients) io.to(room(id)).emit('trip:update', payload);
}

export async function emitTripEnded(userId) {
  if (!io) return;
  const related = await relatedUserIds(userId);
  const hidden = await hiddenByUser(userId);
  const recipients = [userId, ...[...related].filter((id) => !hidden.has(id))];
  for (const id of recipients) io.to(room(id)).emit('trip:ended', { userId });
}

// Paylasim etkin mi — sureli paylasimda suresi gecmisse kapali sayilir
function sharingActive(user) {
  if (!user?.sharingEnabled) return false;
  if (user.sharingUntil && new Date(user.sharingUntil).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

function shouldRecordHistory(userId, lat, lng) {
  const prev = lastHistory.get(userId);
  if (!prev) return true;
  if (Date.now() - prev.at >= HISTORY_MIN_INTERVAL_MS) return true;
  return distanceMeters(prev.lat, prev.lng, lat, lng) >= HISTORY_MIN_DISTANCE_M;
}

// lastHistory Map'i sinirsiz buyumesin — 1 saatten eski girdileri temizle
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [userId, entry] of lastHistory) {
    if (entry.at < cutoff) lastHistory.delete(userId);
  }
}, 60 * 60 * 1000);

function peerPayload(user, loc) {
  return {
    userId: user.id,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    avatarPath: user.avatarPath,
    lat: loc.lat,
    lng: loc.lng,
    accuracy: loc.accuracy ?? null,
    battery: loc.battery ?? null,
    charging: loc.charging ?? null,
    updatedAt: loc.updatedAt,
  };
}

// Kullanicinin gorebilecegi peer'lerin son konumlari
async function snapshotFor(userId) {
  const related = await relatedUserIds(userId);
  if (related.size === 0) return [];
  const hiders = await peersWhoHidFrom(userId);
  const visible = [...related].filter((id) => !hiders.has(id));
  if (visible.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      id: { in: visible },
      sharingEnabled: true,
      OR: [{ sharingUntil: null }, { sharingUntil: { gt: new Date() } }],
    },
    include: { location: true },
  });
  return users.filter((u) => u.location).map((u) => peerPayload(u, u.location));
}

// Konum guncellemesini isler — hem Socket.IO hem HTTP (arka plan) icin.
export async function handleLocationUpdate(
  userId,
  rawLat,
  rawLng,
  rawAccuracy,
  rawBattery,
  rawCharging,
) {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
  const accuracy = Number.isFinite(Number(rawAccuracy)) ? Number(rawAccuracy) : null;

  let battery = null;
  if (rawBattery != null) {
    const b = Math.round(Number(rawBattery));
    if (Number.isFinite(b) && b >= 0 && b <= 100) battery = b;
  }
  const charging = typeof rawCharging === 'boolean' ? rawCharging : null;

  const loc = await prisma.location.upsert({
    where: { userId },
    create: { userId, lat, lng, accuracy, battery, charging },
    update: { lat, lng, accuracy, battery, charging },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!sharingActive(user)) return;

  // Pil esiğin altina ilk inince iliskili kisilere bildir
  if (battery != null) {
    const prev = lastBattery.get(userId);
    lastBattery.set(userId, battery);
    if (charging !== true && battery <= LOW_BATTERY && (prev == null || prev > LOW_BATTERY)) {
      notifyLowBattery(userId, user.displayName, battery);
    }
  }

  // Konum gecmisine kisitlamali kaydet (yalnizca paylasim acikken)
  if (shouldRecordHistory(userId, lat, lng)) {
    lastHistory.set(userId, { at: Date.now(), lat, lng });
    prisma.locationHistory
      .create({ data: { userId, lat, lng, accuracy } })
      .catch((err) => console.error('konum geçmişi kaydı:', err));
  }

  const payload = peerPayload(user, loc);
  const related = await relatedUserIds(userId);
  const hidden = await hiddenByUser(userId);
  for (const peerId of related) {
    if (!hidden.has(peerId)) io?.to(room(peerId)).emit('peer:location', payload);
  }

  trackSpeed(userId, lat, lng);
  broadcastTrip(userId).catch((err) => console.error('yolculuk yayını:', err));

  checkGeofences(userId, lat, lng, hidden).catch((err) =>
    console.error('geofence kontrolü:', err),
  );
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) },
  });
  setIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      socket.data.userId = verifyToken(token).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(room(userId));

    // Dinleyiciler senkron kaydedilir — baglanti sonrasi gelen ilk
    // location:update olayinin kaybolmamasi icin (await'ten once).
    socket.on('location:update', (data) => {
      handleLocationUpdate(
        userId,
        data?.lat,
        data?.lng,
        data?.accuracy,
        data?.battery,
        data?.charging,
      ).catch((err) => console.error('location:update:', err));
    });

    socket.on('refresh', () => {
      snapshotFor(userId)
        .then((snap) => socket.emit('peers:snapshot', snap))
        .catch((err) => console.error('refresh:', err));
    });

    snapshotFor(userId)
      .then((snap) => socket.emit('peers:snapshot', snap))
      .catch((err) => console.error('snapshot:', err));
  });

  return io;
}

// HTTP route'lari icin: paylasim acilip/kapaninca peer'lere bildir
export async function broadcastSharingChange(userId, enabled) {
  if (!io) return;
  const related = await relatedUserIds(userId);
  if (enabled) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { location: true },
    });
    if (user?.location) {
      const payload = peerPayload(user, user.location);
      const hidden = await hiddenByUser(userId);
      for (const peerId of related) {
        if (!hidden.has(peerId)) io.to(room(peerId)).emit('peer:location', payload);
      }
    }
  } else {
    for (const peerId of related) {
      io.to(room(peerId)).emit('peer:offline', { userId });
    }
  }
}

// Iliski degisince (arkadaslik/aile) ilgili kullanicilara snapshot tazele sinyali
export function notifyPeersChanged(userIds) {
  if (!io) return;
  for (const id of new Set(userIds)) {
    io.to(room(id)).emit('peers:changed');
  }
}
