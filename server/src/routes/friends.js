import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyPeersChanged } from '../socket.js';

const router = Router();

function friendView(u) {
  return {
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    avatarColor: u.avatarColor,
    avatarPath: u.avatarPath,
  };
}

// Arkadaslar + gelen/giden bekleyen istekler
router.get('/', requireAuth, async (req, res) => {
  const rows = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: req.userId }, { addresseeId: req.userId }],
    },
    include: { requester: true, addressee: true },
  });

  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const f of rows) {
    const other = f.requesterId === req.userId ? f.addressee : f.requester;
    const entry = { friendshipId: f.id, user: friendView(other) };
    if (f.status === 'accepted') {
      friends.push(entry);
    } else if (f.addresseeId === req.userId) {
      incoming.push(entry);
    } else {
      outgoing.push(entry);
    }
  }

  res.json({ friends, incoming, outgoing });
});

// E-posta ile arkadaslik istegi gonder
router.post('/', requireAuth, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email zorunlu' });
  }
  const target = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  });
  if (!target) {
    return res.status(404).json({ error: 'Bu e-postayla kullanıcı bulunamadı' });
  }
  if (target.id === req.userId) {
    return res.status(400).json({ error: 'Kendinize arkadaşlık isteği gönderemezsiniz' });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: req.userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: req.userId },
      ],
    },
  });
  if (existing) {
    return res.status(409).json({
      error:
        existing.status === 'accepted'
          ? 'Zaten arkadaşsınız'
          : 'Bekleyen bir arkadaşlık isteği zaten var',
    });
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: req.userId, addresseeId: target.id },
  });
  res.status(201).json({ friendshipId: friendship.id, user: friendView(target) });
});

// Gelen istegi kabul et
router.post('/:id/accept', requireAuth, async (req, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!friendship || friendship.addresseeId !== req.userId) {
    return res.status(404).json({ error: 'İstek bulunamadı' });
  }
  if (friendship.status === 'accepted') {
    return res.status(409).json({ error: 'İstek zaten kabul edilmiş' });
  }
  await prisma.friendship.update({
    where: { id: friendship.id },
    data: { status: 'accepted' },
  });
  notifyPeersChanged([friendship.requesterId, friendship.addresseeId]);
  res.json({ ok: true });
});

// Arkadasligi sil / istegi reddet veya iptal et
router.delete('/:id', requireAuth, async (req, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (
    !friendship ||
    (friendship.requesterId !== req.userId && friendship.addresseeId !== req.userId)
  ) {
    return res.status(404).json({ error: 'Arkadaşlık bulunamadı' });
  }
  await prisma.friendship.delete({ where: { id: friendship.id } });
  notifyPeersChanged([friendship.requesterId, friendship.addresseeId]);
  res.json({ ok: true });
});

export default router;
