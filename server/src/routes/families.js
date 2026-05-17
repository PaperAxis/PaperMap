import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyPeersChanged } from '../socket.js';

const router = Router();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomCode();
    const clash = await prisma.family.findUnique({ where: { inviteCode: code } });
    if (!clash) return code;
  }
  throw new Error('Davet kodu üretilemedi');
}

function memberView(m) {
  return {
    id: m.user.id,
    displayName: m.user.displayName,
    email: m.user.email,
    avatarColor: m.user.avatarColor,
    role: m.role,
    joinedAt: m.joinedAt,
  };
}

// Kullanicinin uye oldugu aileler
router.get('/', requireAuth, async (req, res) => {
  const memberships = await prisma.familyMember.findMany({
    where: { userId: req.userId },
    include: { family: { include: { _count: { select: { members: true } } } } },
  });
  res.json({
    families: memberships.map((m) => ({
      id: m.family.id,
      name: m.family.name,
      inviteCode: m.family.inviteCode,
      role: m.role,
      memberCount: m.family._count.members,
    })),
  });
});

// Aile detayi + uye listesi
router.get('/:id', requireAuth, async (req, res) => {
  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: req.params.id, userId: req.userId } },
  });
  if (!membership) {
    return res.status(404).json({ error: 'Aile bulunamadı' });
  }
  const family = await prisma.family.findUnique({
    where: { id: req.params.id },
    include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } },
  });
  res.json({
    id: family.id,
    name: family.name,
    inviteCode: family.inviteCode,
    ownerId: family.ownerId,
    members: family.members.map(memberView),
  });
});

// Aile olustur
router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Aile adı zorunlu' });
  }
  const inviteCode = await uniqueInviteCode();
  const family = await prisma.family.create({
    data: {
      name: String(name).trim(),
      ownerId: req.userId,
      inviteCode,
      members: { create: { userId: req.userId, role: 'owner' } },
    },
  });
  res.status(201).json({ id: family.id, name: family.name, inviteCode: family.inviteCode });
});

// Davet koduyla aileye katil
router.post('/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body || {};
  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode zorunlu' });
  }
  const family = await prisma.family.findUnique({
    where: { inviteCode: String(inviteCode).toUpperCase().trim() },
  });
  if (!family) {
    return res.status(404).json({ error: 'Geçersiz davet kodu' });
  }
  const existing = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: family.id, userId: req.userId } },
  });
  if (existing) {
    return res.status(409).json({ error: 'Bu ailenin zaten üyesisiniz' });
  }
  const before = await prisma.familyMember.findMany({
    where: { familyId: family.id },
    select: { userId: true },
  });
  await prisma.familyMember.create({
    data: { familyId: family.id, userId: req.userId, role: 'member' },
  });
  notifyPeersChanged([...before.map((m) => m.userId), req.userId]);
  res.status(201).json({ id: family.id, name: family.name });
});

// Aileden ayril
router.delete('/:id/leave', requireAuth, async (req, res) => {
  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: req.params.id, userId: req.userId } },
  });
  if (!membership) {
    return res.status(404).json({ error: 'Aile bulunamadı' });
  }
  const family = await prisma.family.findUnique({ where: { id: req.params.id } });
  const allMemberIds = (
    await prisma.familyMember.findMany({
      where: { familyId: family.id },
      select: { userId: true },
    })
  ).map((m) => m.userId);

  if (family.ownerId === req.userId) {
    const others = await prisma.familyMember.findMany({
      where: { familyId: family.id, userId: { not: req.userId } },
      orderBy: { joinedAt: 'asc' },
    });
    if (others.length === 0) {
      await prisma.family.delete({ where: { id: family.id } });
      notifyPeersChanged(allMemberIds);
      return res.json({ ok: true, familyDeleted: true });
    }
    await prisma.$transaction([
      prisma.family.update({ where: { id: family.id }, data: { ownerId: others[0].userId } }),
      prisma.familyMember.update({ where: { id: others[0].id }, data: { role: 'owner' } }),
      prisma.familyMember.delete({ where: { id: membership.id } }),
    ]);
    notifyPeersChanged(allMemberIds);
    return res.json({ ok: true, ownershipTransferred: true });
  }

  await prisma.familyMember.delete({ where: { id: membership.id } });
  notifyPeersChanged(allMemberIds);
  res.json({ ok: true });
});

export default router;
