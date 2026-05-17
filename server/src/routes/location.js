import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser } from '../auth.js';
import { broadcastSharingChange } from '../socket.js';

const router = Router();

// Konum paylasimini ac/kapat
router.patch('/sharing', requireAuth, async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) zorunlu' });
  }
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { sharingEnabled: enabled },
  });
  await broadcastSharingChange(req.userId, enabled);
  res.json({ user: publicUser(user) });
});

export default router;
