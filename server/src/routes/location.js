import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser } from '../auth.js';
import { broadcastSharingChange, handleLocationUpdate } from '../socket.js';

const router = Router();

// Konum guncellemesi (arka plan / HTTP — Socket.IO alternatifi)
router.post('/', requireAuth, async (req, res) => {
  const { lat, lng, accuracy, battery, charging } = req.body || {};
  await handleLocationUpdate(req.userId, lat, lng, accuracy, battery, charging);
  res.json({ ok: true });
});

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
