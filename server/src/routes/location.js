import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser } from '../auth.js';
import { relatedUserIds } from '../visibility.js';
import { broadcastSharingChange, handleLocationUpdate } from '../socket.js';

const router = Router();

const HISTORY_DAYS = 30;

// Konum guncellemesi (arka plan / HTTP — Socket.IO alternatifi)
router.post('/', requireAuth, async (req, res) => {
  const { lat, lng, accuracy, battery, charging } = req.body || {};
  await handleLocationUpdate(req.userId, lat, lng, accuracy, battery, charging);
  res.json({ ok: true });
});

// Konum gecmisi — son 30 gun. Kendi gecmisin ya da iliskili
// (arkadas / aile uyesi) bir kisinin gecmisi gorulebilir.
router.get('/history/:userId', requireAuth, async (req, res) => {
  const targetId = req.params.userId;
  if (targetId !== req.userId) {
    const related = await relatedUserIds(req.userId);
    if (!related.has(targetId)) {
      return res
        .status(403)
        .json({ error: 'Bu kullanıcının konum geçmişini göremezsiniz' });
    }
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target || !target.sharingEnabled) {
      return res.json({ points: [] });
    }
  }
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const points = await prisma.locationHistory.findMany({
    where: { userId: targetId, recordedAt: { gte: since } },
    orderBy: { recordedAt: 'asc' },
    select: { lat: true, lng: true, accuracy: true, recordedAt: true },
  });
  res.json({ points });
});

// Konum paylasimini ac/kapat. Istege bagli durationMinutes ile sureli acilir.
router.patch('/sharing', requireAuth, async (req, res) => {
  const { enabled, durationMinutes } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) zorunlu' });
  }
  const data = { sharingEnabled: enabled, sharingUntil: null };
  if (enabled && durationMinutes != null) {
    const mins = Number(durationMinutes);
    if (!Number.isFinite(mins) || mins <= 0 || mins > 7 * 24 * 60) {
      return res.status(400).json({ error: 'Geçersiz süre' });
    }
    data.sharingUntil = new Date(Date.now() + mins * 60 * 1000);
  }
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  await broadcastSharingChange(req.userId, enabled);
  res.json({ user: publicUser(user) });
});

export default router;
