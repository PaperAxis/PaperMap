import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { relatedUserIds } from '../visibility.js';

const router = Router();

// Bir kullanicinin herkese acik profili — yalnizca arkadas / aile uyesi gorulebilir
router.get('/:id', requireAuth, async (req, res) => {
  const targetId = req.params.id;
  if (targetId !== req.userId) {
    const related = await relatedUserIds(req.userId);
    if (!related.has(targetId)) {
      return res.status(403).json({ error: 'Bu profili görüntüleme yetkiniz yok' });
    }
  }
  const u = await prisma.user.findUnique({ where: { id: targetId } });
  if (!u) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  res.json({
    user: {
      id: u.id,
      displayName: u.displayName,
      username: u.username,
      avatarColor: u.avatarColor,
      avatarPath: u.avatarPath,
      bannerPath: u.bannerPath,
    },
  });
});

export default router;
