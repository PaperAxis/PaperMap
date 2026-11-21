import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Bildirim gecmisi + okunmamis sayisi
router.get('/', requireAuth, async (req, res) => {
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: req.userId, readAt: null } }),
  ]);
  res.json({ notifications, unread });
});

// Tüm bildirimleri okundu işaretle
router.post('/read', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

const PLATFORMS = new Set(['android', 'ios', 'web']);

// FCM cihaz token'i kaydet (push bildirimleri icin)
router.post('/token', requireAuth, async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token zorunlu' });
  }
  await prisma.deviceToken.upsert({
    where: { token },
    create: { token, platform: PLATFORMS.has(platform) ? platform : 'android', userId: req.userId },
    update: { userId: req.userId, ...(PLATFORMS.has(platform) ? { platform } : {}) },
  });
  res.json({ ok: true });
});

export default router;
