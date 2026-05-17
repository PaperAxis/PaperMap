import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Tüm admin uçları yönetici gerektirir
router.use(requireAuth, requireAdmin);

function adminUserView(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
    avatarPath: u.avatarPath,
    isAdmin: u.isAdmin,
    disabled: u.disabled,
    createdAt: u.createdAt,
  };
}

// İstatistikler
router.get('/stats', async (req, res) => {
  const [users, families, conversations, messages] = await Promise.all([
    prisma.user.count(),
    prisma.family.count(),
    prisma.conversation.count(),
    prisma.message.count(),
  ]);
  res.json({ stats: { users, families, conversations, messages } });
});

// Kullanıcılar (isteğe bağlı arama: ?q=)
router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ users: users.map(adminUserView) });
});

// Kullanıcı güncelle (devre dışı bırak / yönetici yap)
router.patch('/users/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    return res
      .status(400)
      .json({ error: 'Kendi hesabınızda bu işlemi yapamazsınız' });
  }
  const { disabled, isAdmin } = req.body || {};
  const data = {};
  if (typeof disabled === 'boolean') data.disabled = disabled;
  if (typeof isAdmin === 'boolean') data.isAdmin = isAdmin;
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ user: adminUserView(user) });
});

// Kullanıcı sil
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
