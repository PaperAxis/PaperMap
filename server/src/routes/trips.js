import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastTrip, emitTripEnded } from '../socket.js';

const router = Router();

function tripView(t) {
  return t
    ? {
        destLat: t.destLat,
        destLng: t.destLng,
        destLabel: t.destLabel,
        startedAt: t.startedAt,
      }
    : null;
}

// Etkin yolculugum
router.get('/mine', requireAuth, async (req, res) => {
  const trip = await prisma.trip.findUnique({ where: { userId: req.userId } });
  res.json({ trip: tripView(trip) });
});

// Yolculuk baslat / hedefi degistir
router.post('/', requireAuth, async (req, res) => {
  const { destLat, destLng, destLabel } = req.body || {};
  const la = Number(destLat);
  const ln = Number(destLng);
  if (
    !Number.isFinite(la) || !Number.isFinite(ln) ||
    la < -90 || la > 90 || ln < -180 || ln > 180
  ) {
    return res.status(400).json({ error: 'Geçersiz hedef konum' });
  }
  if (!destLabel || !String(destLabel).trim()) {
    return res.status(400).json({ error: 'Hedef adı zorunlu' });
  }
  const label = String(destLabel).trim().slice(0, 80);
  const trip = await prisma.trip.upsert({
    where: { userId: req.userId },
    create: { userId: req.userId, destLat: la, destLng: ln, destLabel: label },
    update: { destLat: la, destLng: ln, destLabel: label, startedAt: new Date() },
  });
  broadcastTrip(req.userId).catch(() => {});
  res.status(201).json({ trip: tripView(trip) });
});

// Yolculugu bitir
router.delete('/', requireAuth, async (req, res) => {
  await prisma.trip.deleteMany({ where: { userId: req.userId } });
  emitTripEnded(req.userId).catch(() => {});
  res.json({ ok: true });
});

export default router;
