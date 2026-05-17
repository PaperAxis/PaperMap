import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { relatedUserIds } from '../visibility.js';
import { createNotification } from '../notify.js';
import { emitToUser } from '../realtime.js';

const router = Router();

// Acil durum cagrisi — iliskili tum kisilere (arkadas + aile) bildirim ve
// anlik 'sos' olayi gonderir; gonderenin son konumu da iletilir.
router.post('/', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { location: true },
  });
  const related = await relatedUserIds(req.userId);
  if (related.size === 0) {
    return res
      .status(400)
      .json({ error: 'Bildirilecek arkadaş ya da aile üyeniz yok' });
  }

  const note = String(req.body?.message || '').trim().slice(0, 200);
  const loc = me.location;
  const payload = {
    userId: me.id,
    displayName: me.displayName,
    avatarColor: me.avatarColor,
    avatarPath: me.avatarPath,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    message: note,
    at: new Date().toISOString(),
  };
  const body = note
    ? `${me.displayName} acil durum bildirdi: ${note}`
    : `${me.displayName} acil durum bildirdi.`;

  for (const peerId of related) {
    createNotification(peerId, 'Acil durum çağrısı', body).catch(() => {});
    emitToUser(peerId, 'sos', payload);
  }
  res.json({ ok: true, notified: related.size });
});

export default router;
