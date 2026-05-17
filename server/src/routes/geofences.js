import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { relatedUserIds } from '../visibility.js';

const router = Router();

function geofenceView(g) {
  return {
    id: g.id,
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    radius: g.radius,
    notifyOnEnter: g.notifyOnEnter,
    notifyOnExit: g.notifyOnExit,
    watches: (g.watches || []).map((w) => ({
      userId: w.userId,
      displayName: w.user.displayName,
      avatarColor: w.user.avatarColor,
      inside: w.inside,
    })),
  };
}

// Kullanicinin olusturdugu alanlar
router.get('/', requireAuth, async (req, res) => {
  const geofences = await prisma.geofence.findMany({
    where: { ownerId: req.userId },
    include: { watches: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ geofences: geofences.map(geofenceView) });
});

// Alan olustur
router.post('/', requireAuth, async (req, res) => {
  const { name, lat, lng, radius, notifyOnEnter, notifyOnExit } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Alan adı zorunlu' });
  }
  const la = Number(lat);
  const ln = Number(lng);
  const r = Number(radius);
  if (
    !Number.isFinite(la) || !Number.isFinite(ln) ||
    la < -90 || la > 90 || ln < -180 || ln > 180
  ) {
    return res.status(400).json({ error: 'Geçersiz konum' });
  }
  if (!Number.isFinite(r) || r < 50 || r > 50000) {
    return res.status(400).json({ error: 'Yarıçap 50–50000 metre arasında olmalı' });
  }
  const g = await prisma.geofence.create({
    data: {
      ownerId: req.userId,
      name: String(name).trim(),
      lat: la,
      lng: ln,
      radius: r,
      notifyOnEnter: notifyOnEnter !== false,
      notifyOnExit: notifyOnExit !== false,
    },
    include: { watches: { include: { user: true } } },
  });
  res.status(201).json({ geofence: geofenceView(g) });
});

// Alan sil
router.delete('/:id', requireAuth, async (req, res) => {
  const g = await prisma.geofence.findUnique({ where: { id: req.params.id } });
  if (!g || g.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Alan bulunamadı' });
  }
  await prisma.geofence.delete({ where: { id: g.id } });
  res.json({ ok: true });
});

// Alana izlenecek kullanici ekle (yalnizca arkadas / aile uyesi)
router.post('/:id/watches', requireAuth, async (req, res) => {
  const g = await prisma.geofence.findUnique({ where: { id: req.params.id } });
  if (!g || g.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Alan bulunamadı' });
  }
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email zorunlu' });
  }
  const target = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  });
  if (!target) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  const related = await relatedUserIds(req.userId);
  if (!related.has(target.id)) {
    return res.status(403).json({
      error: 'Yalnızca arkadaşlarınızı veya aile üyelerinizi izleyebilirsiniz',
    });
  }
  const existing = await prisma.geofenceWatch.findUnique({
    where: { geofenceId_userId: { geofenceId: g.id, userId: target.id } },
  });
  if (existing) {
    return res.status(409).json({ error: 'Bu kullanıcı zaten izleniyor' });
  }
  await prisma.geofenceWatch.create({
    data: { geofenceId: g.id, userId: target.id },
  });
  res.status(201).json({ ok: true });
});

// İzlenen kullaniciyi çıkar
router.delete('/:id/watches/:userId', requireAuth, async (req, res) => {
  const g = await prisma.geofence.findUnique({ where: { id: req.params.id } });
  if (!g || g.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Alan bulunamadı' });
  }
  await prisma.geofenceWatch.deleteMany({
    where: { geofenceId: g.id, userId: req.params.userId },
  });
  res.json({ ok: true });
});

export default router;
