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
      avatarPath: w.user.avatarPath,
      inside: w.inside,
    })),
  };
}

function personView(u) {
  return {
    id: u.id,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
    avatarPath: u.avatarPath,
  };
}

// Alana izlenmek uzere eklenebilecek kisiler: arkadaslar + (varsa) aile uyeleri.
router.get('/candidates', requireAuth, async (req, res) => {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: req.userId }, { addresseeId: req.userId }],
    },
    include: { requester: true, addressee: true },
  });
  const friends = friendships.map((f) =>
    personView(f.requesterId === req.userId ? f.addressee : f.requester),
  );

  const membership = await prisma.familyMember.findFirst({
    where: { userId: req.userId },
    include: { family: { include: { members: { include: { user: true } } } } },
  });
  let family = null;
  if (membership) {
    family = {
      id: membership.family.id,
      name: membership.family.name,
      members: membership.family.members
        .filter((m) => m.userId !== req.userId)
        .map((m) => personView(m.user)),
    };
  }

  res.json({ friends, family });
});

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
  if (!Number.isFinite(r) || r < 50 || r > 5000) {
    return res.status(400).json({ error: 'Yarıçap 50–5000 metre arasında olmalı' });
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

// Alani duzenle (ad, merkez, yariçap, bildirim tercihleri)
router.patch('/:id', requireAuth, async (req, res) => {
  const g = await prisma.geofence.findUnique({ where: { id: req.params.id } });
  if (!g || g.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Alan bulunamadı' });
  }
  const { name, lat, lng, radius, notifyOnEnter, notifyOnExit } = req.body || {};
  const data = {};

  if (name !== undefined) {
    if (!String(name).trim()) {
      return res.status(400).json({ error: 'Alan adı zorunlu' });
    }
    data.name = String(name).trim();
  }
  if (lat !== undefined || lng !== undefined) {
    const la = Number(lat);
    const ln = Number(lng);
    if (
      !Number.isFinite(la) || !Number.isFinite(ln) ||
      la < -90 || la > 90 || ln < -180 || ln > 180
    ) {
      return res.status(400).json({ error: 'Geçersiz konum' });
    }
    data.lat = la;
    data.lng = ln;
  }
  if (radius !== undefined) {
    const r = Number(radius);
    if (!Number.isFinite(r) || r < 50 || r > 5000) {
      return res.status(400).json({ error: 'Yarıçap 50–5000 metre arasında olmalı' });
    }
    data.radius = r;
  }
  if (notifyOnEnter !== undefined) data.notifyOnEnter = notifyOnEnter !== false;
  if (notifyOnExit !== undefined) data.notifyOnExit = notifyOnExit !== false;

  const updated = await prisma.geofence.update({
    where: { id: g.id },
    data,
    include: { watches: { include: { user: true } } },
  });
  res.json({ geofence: geofenceView(updated) });
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

// Alana izlenecek kullanici(lar) ekle (yalnizca arkadas / aile uyesi).
// Birden fazla kisi ya da tum aile tek istekte eklenebilir.
router.post('/:id/watches', requireAuth, async (req, res) => {
  const g = await prisma.geofence.findUnique({ where: { id: req.params.id } });
  if (!g || g.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Alan bulunamadı' });
  }
  let { userIds } = req.body || {};
  if (!Array.isArray(userIds)) {
    userIds = userIds ? [userIds] : [];
  }
  userIds = [...new Set(userIds.filter((id) => typeof id === 'string' && id))];
  if (userIds.length === 0) {
    return res.status(400).json({ error: 'En az bir kişi seçin' });
  }
  const related = await relatedUserIds(req.userId);
  if (userIds.some((id) => !related.has(id))) {
    return res.status(403).json({
      error: 'Yalnızca arkadaşlarınızı veya aile üyelerinizi izleyebilirsiniz',
    });
  }
  await prisma.geofenceWatch.createMany({
    data: userIds.map((userId) => ({ geofenceId: g.id, userId })),
    skipDuplicates: true,
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
