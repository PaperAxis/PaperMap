import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

// Herkese acik (kimlik dogrulamasiz) — gecici baglantiyla konum gosterimi.
// Yalnizca ad, avatar rengi ve son konum doner; e-posta vb. sizdirilmaz.
router.get('/share/:token', async (req, res) => {
  const link = await prisma.shareLink.findUnique({
    where: { token: req.params.token },
    include: { user: { include: { location: true } } },
  });
  if (!link || link.expiresAt <= new Date()) {
    return res
      .status(404)
      .json({ error: 'Bağlantı geçersiz ya da süresi dolmuş' });
  }
  const u = link.user;
  const loc = u.location;
  res.json({
    displayName: u.displayName,
    avatarColor: u.avatarColor,
    expiresAt: link.expiresAt,
    location: loc
      ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt }
      : null,
  });
});

export default router;
