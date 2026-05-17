import { Router } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, verifyPassword, signToken, publicUser } from '../auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, displayName, password } = req.body || {};
  if (!email || !displayName || !password) {
    return res.status(400).json({ error: 'email, displayName ve password zorunlu' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
  }
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      displayName: String(displayName).trim(),
      passwordHash: await hashPassword(password),
    },
  });
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email ve password zorunlu' });
  }
  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  res.json({ user: publicUser(user) });
});

export default router;
