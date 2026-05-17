import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { relatedUserIds } from '../visibility.js';
import { emitToUser } from '../realtime.js';

const router = Router();

// İliskili kisiler + her biri icin "konumum gizli mi" bilgisi
router.get('/people', requireAuth, async (req, res) => {
  const relatedSet = await relatedUserIds(req.userId);
  if (relatedSet.size === 0) return res.json({ people: [] });

  const users = await prisma.user.findMany({
    where: { id: { in: [...relatedSet] } },
    select: { id: true, displayName: true, avatarColor: true, avatarPath: true },
  });
  const hiddenRows = await prisma.hiddenPeer.findMany({
    where: { userId: req.userId },
    select: { hiddenId: true },
  });
  const hidden = new Set(hiddenRows.map((r) => r.hiddenId));

  const people = users
    .map((u) => ({ ...u, hidden: hidden.has(u.id) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
  res.json({ people });
});

// Bir kisiden konumu gizle / gizlemeyi kaldir
router.put('/hidden/:userId', requireAuth, async (req, res) => {
  const targetId = req.params.userId;
  const hide = req.body?.hidden === true;
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'Kendinizi gizleyemezsiniz' });
  }
  const related = await relatedUserIds(req.userId);
  if (!related.has(targetId)) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  if (hide) {
    await prisma.hiddenPeer.upsert({
      where: { userId_hiddenId: { userId: req.userId, hiddenId: targetId } },
      create: { userId: req.userId, hiddenId: targetId },
      update: {},
    });
    // Hedef artik bizi gormesin — anlik cevrimdisi bildir
    emitToUser(targetId, 'peer:offline', { userId: req.userId });
  } else {
    await prisma.hiddenPeer.deleteMany({
      where: { userId: req.userId, hiddenId: targetId },
    });
    // Hedef tekrar gorebilsin — snapshot tazelesin
    emitToUser(targetId, 'peers:changed');
  }
  res.json({ ok: true, hidden: hide });
});

export default router;
