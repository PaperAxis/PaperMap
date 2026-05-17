import { Server } from 'socket.io';
import { verifyToken } from './auth.js';
import { prisma } from './prisma.js';
import { relatedUserIds } from './visibility.js';
import { setIo } from './realtime.js';
import { checkGeofences } from './geofence.js';

let io = null;

function room(userId) {
  return `user:${userId}`;
}

function peerPayload(user, loc) {
  return {
    userId: user.id,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    lat: loc.lat,
    lng: loc.lng,
    accuracy: loc.accuracy ?? null,
    updatedAt: loc.updatedAt,
  };
}

// Kullanicinin gorebilecegi peer'lerin son konumlari
async function snapshotFor(userId) {
  const related = await relatedUserIds(userId);
  if (related.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...related] }, sharingEnabled: true },
    include: { location: true },
  });
  return users.filter((u) => u.location).map((u) => peerPayload(u, u.location));
}

// Konum guncellemesini isler — hem Socket.IO hem HTTP (arka plan) icin.
export async function handleLocationUpdate(userId, rawLat, rawLng, rawAccuracy) {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
  const accuracy = Number.isFinite(Number(rawAccuracy)) ? Number(rawAccuracy) : null;

  const loc = await prisma.location.upsert({
    where: { userId },
    create: { userId, lat, lng, accuracy },
    update: { lat, lng, accuracy },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.sharingEnabled) return;

  const payload = peerPayload(user, loc);
  const related = await relatedUserIds(userId);
  for (const peerId of related) {
    io?.to(room(peerId)).emit('peer:location', payload);
  }

  checkGeofences(userId, lat, lng).catch((err) =>
    console.error('geofence kontrolü:', err),
  );
}

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
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
      handleLocationUpdate(userId, data?.lat, data?.lng, data?.accuracy).catch(
        (err) => console.error('location:update:', err),
      );
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
      for (const peerId of related) io.to(room(peerId)).emit('peer:location', payload);
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
