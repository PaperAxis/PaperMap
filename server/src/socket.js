import { Server } from 'socket.io';
import { verifyToken } from './auth.js';
import { prisma } from './prisma.js';
import { relatedUserIds } from './visibility.js';

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

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

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

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(room(userId));
    socket.emit('peers:snapshot', await snapshotFor(userId));

    socket.on('location:update', async (data) => {
      const lat = Number(data?.lat);
      const lng = Number(data?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
      const accuracy = Number.isFinite(Number(data?.accuracy)) ? Number(data.accuracy) : null;

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
        io.to(room(peerId)).emit('peer:location', payload);
      }
    });

    socket.on('refresh', async () => {
      socket.emit('peers:snapshot', await snapshotFor(userId));
    });
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
