import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function linkView(l) {
  return {
    id: l.id,
    token: l.token,
    label: l.label,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
  };
}

// Kullanicinin etkin (suresi dolmamis) baglantilari
router.get('/', requireAuth, async (req, res) => {
  const links = await prisma.shareLink.findMany({
    where: { userId: req.userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ links: links.map(linkView) });
});

// Yeni gecici baglanti olustur
router.post('/', requireAuth, async (req, res) => {
  const { durationMinutes, label } = req.body || {};
  const mins = Number(durationMinutes);
  if (!Number.isFinite(mins) || mins <= 0 || mins > 7 * 24 * 60) {
    return res.status(400).json({ error: 'Geçersiz süre' });
  }
  const link = await prisma.shareLink.create({
    data: {
      token: crypto.randomBytes(18).toString('base64url'),
      userId: req.userId,
      label: label ? String(label).trim().slice(0, 60) : null,
      expiresAt: new Date(Date.now() + mins * 60 * 1000),
    },
  });
  res.status(201).json({ link: linkView(link) });
});

// Baglantiyi iptal et
router.delete('/:id', requireAuth, async (req, res) => {
  const link = await prisma.shareLink.findUnique({ where: { id: req.params.id } });
  if (!link || link.userId !== req.userId) {
    return res.status(404).json({ error: 'Bağlantı bulunamadı' });
  }
  await prisma.shareLink.delete({ where: { id: link.id } });
  res.json({ ok: true });
});

export default router;
