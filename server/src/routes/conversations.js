import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { relatedUserIds } from '../visibility.js';
import { emitToUser } from '../realtime.js';
import { sendPush } from '../push.js';
import { getOrCreateDirect } from '../chat.js';

const router = Router();

function messageView(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    body: m.body,
    createdAt: m.createdAt,
    senderId: m.senderId,
    senderName: m.sender.displayName,
    senderAvatarColor: m.sender.avatarColor,
    senderAvatarPath: m.sender.avatarPath,
  };
}

function conversationView(conv, myId, membership, unread) {
  const last = conv.messages?.[0] || null;
  let title;
  let otherUser = null;
  if (conv.type === 'direct') {
    const other = conv.members.find((cm) => cm.userId !== myId)?.user;
    title = other?.displayName || 'Sohbet';
    otherUser = other
      ? { id: other.id, avatarColor: other.avatarColor, avatarPath: other.avatarPath }
      : null;
  } else {
    title = conv.name || (conv.type === 'family' ? 'Aile' : 'Grup');
  }
  return {
    id: conv.id,
    type: conv.type,
    title,
    otherUser,
    memberCount: conv.members.length,
    lastMessage: last
      ? { body: last.body, createdAt: last.createdAt, senderName: last.sender.displayName }
      : null,
    updatedAt: last ? last.createdAt : conv.createdAt,
    unread,
  };
}

// Kullanicinin sohbetleri
router.get('/', requireAuth, async (req, res) => {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: req.userId },
    include: {
      conversation: {
        include: {
          members: { include: { user: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: true },
          },
        },
      },
    },
  });

  const conversations = [];
  for (const m of memberships) {
    const unread = await prisma.message.count({
      where: {
        conversationId: m.conversationId,
        createdAt: { gt: m.lastReadAt },
        senderId: { not: req.userId },
      },
    });
    conversations.push(conversationView(m.conversation, req.userId, m, unread));
  }
  conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ conversations });
});

// Birebir sohbet aç (varsa getir)
router.post('/direct', requireAuth, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId zorunlu' });
  }
  if (userId === req.userId) {
    return res.status(400).json({ error: 'Kendinizle sohbet açamazsınız' });
  }
  const related = await relatedUserIds(req.userId);
  if (!related.has(userId)) {
    return res
      .status(403)
      .json({ error: 'Yalnızca arkadaşlarınız veya aile üyelerinizle mesajlaşabilirsiniz' });
  }
  const conv = await getOrCreateDirect(req.userId, userId);
  res.json({ conversationId: conv.id });
});

// Grup oluştur
router.post('/group', requireAuth, async (req, res) => {
  const { name, memberIds } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Grup adı zorunlu' });
  }
  const related = await relatedUserIds(req.userId);
  const ids = Array.isArray(memberIds) ? memberIds : [];
  const valid = ids.filter((id) => related.has(id) && id !== req.userId);
  const allMembers = [...new Set([req.userId, ...valid])];

  const conv = await prisma.conversation.create({
    data: {
      type: 'group',
      name: String(name).trim(),
      members: { create: allMembers.map((userId) => ({ userId })) },
    },
  });
  res.status(201).json({ conversationId: conv.id });
});

// Sohbet mesajları
router.get('/:id/messages', requireAuth, async (req, res) => {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: req.params.id, userId: req.userId } },
  });
  if (!membership) {
    return res.status(404).json({ error: 'Sohbet bulunamadı' });
  }
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { sender: true },
  });
  res.json({ messages: messages.reverse().map(messageView) });
});

// Mesaj gönder
router.post('/:id/messages', requireAuth, async (req, res) => {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: req.params.id, userId: req.userId } },
  });
  if (!membership) {
    return res.status(404).json({ error: 'Sohbet bulunamadı' });
  }
  const body = String(req.body?.body || '').trim();
  if (!body) {
    return res.status(400).json({ error: 'Mesaj boş olamaz' });
  }
  if (body.length > 4000) {
    return res.status(400).json({ error: 'Mesaj çok uzun' });
  }

  const message = await prisma.message.create({
    data: { conversationId: req.params.id, senderId: req.userId, body },
    include: { sender: true },
  });
  await prisma.conversationMember.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date() },
  });

  const view = messageView(message);
  const members = await prisma.conversationMember.findMany({
    where: { conversationId: req.params.id },
  });
  for (const mem of members) {
    emitToUser(mem.userId, 'message', { conversationId: req.params.id, message: view });
    if (mem.userId !== req.userId) {
      sendPush(mem.userId, message.sender.displayName, body).catch(() => {});
    }
  }
  res.status(201).json({ message: view });
});

// Sohbeti okundu işaretle
router.post('/:id/read', requireAuth, async (req, res) => {
  await prisma.conversationMember.updateMany({
    where: { conversationId: req.params.id, userId: req.userId },
    data: { lastReadAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
