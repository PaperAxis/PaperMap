import { prisma } from './prisma.js';
import { emitToUser } from './realtime.js';
import { sendPush } from './push.js';

// Bildirim olusturur: veritabanina yazar, Socket.IO ile anlik iletir,
// ve (yapilandirilmissa) FCM push gonderir.
export async function createNotification(userId, title, body) {
  const notification = await prisma.notification.create({
    data: { userId, title, body },
  });

  emitToUser(userId, 'notification', {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt,
  });

  sendPush(userId, title, body).catch((err) =>
    console.error('push gönderilemedi:', err),
  );

  return notification;
}
