import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const HEX = /^#[0-9a-fA-F]{6}$/;

function placeView(p) {
  return { id: p.id, name: p.name, lat: p.lat, lng: p.lng, color: p.color };
}

// Geçerli koordinat / ad / renk dogrulamasi — gecerliyse temizlenmis data doner
function validatePlace(body, partial) {
  const data = {};
  const { name, lat, lng, color } = body || {};

  if (name !== undefined || !partial) {
    if (!name || !String(name).trim()) return { error: 'Yer adı zorunlu' };
    data.name = String(name).trim().slice(0, 80);
  }
  if (lat !== undefined || lng !== undefined || !partial) {
    const la = Number(lat);
    const ln = Number(lng);
    if (
      !Number.isFinite(la) || !Number.isFinite(ln) ||
      la < -90 || la > 90 || ln < -180 || ln > 180
    ) {
      return { error: 'Geçersiz konum' };
    }
    data.lat = la;
    data.lng = ln;
  }
  if (color !== undefined) {
    if (!HEX.test(String(color))) return { error: 'Geçersiz renk kodu' };
    data.color = String(color).toLowerCase();
  }
  return { data };
}

// Kullanicinin kayitli yerleri
router.get('/', requireAuth, async (req, res) => {
  const places = await prisma.savedPlace.findMany({
    where: { ownerId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ places: places.map(placeView) });
});

// Yer ekle
router.post('/', requireAuth, async (req, res) => {
  const { error, data } = validatePlace(req.body, false);
  if (error) return res.status(400).json({ error });
  const place = await prisma.savedPlace.create({
    data: { ownerId: req.userId, ...data },
  });
  res.status(201).json({ place: placeView(place) });
});

// Yer düzenle
router.patch('/:id', requireAuth, async (req, res) => {
  const existing = await prisma.savedPlace.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Yer bulunamadı' });
  }
  const { error, data } = validatePlace(req.body, true);
  if (error) return res.status(400).json({ error });
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }
  const place = await prisma.savedPlace.update({ where: { id: existing.id }, data });
  res.json({ place: placeView(place) });
});

// Yer sil
router.delete('/:id', requireAuth, async (req, res) => {
  const existing = await prisma.savedPlace.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Yer bulunamadı' });
  }
  await prisma.savedPlace.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;
