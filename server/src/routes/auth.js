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

// Profil güncelleme (ad, avatar rengi, tema, font)
router.patch('/profile', requireAuth, async (req, res) => {
  const { displayName, avatarColor, theme, fontPref } = req.body || {};
  const data = {};

  if (displayName !== undefined) {
    const name = String(displayName).trim();
    if (!name) return res.status(400).json({ error: 'Görünen ad boş olamaz' });
    data.displayName = name;
  }
  if (avatarColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(avatarColor))) {
      return res.status(400).json({ error: 'Geçersiz renk kodu' });
    }
    data.avatarColor = String(avatarColor).toLowerCase();
  }
  if (theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ error: 'Geçersiz tema' });
    }
    data.theme = theme;
  }
  if (fontPref !== undefined) {
    if (!['default', 'atkinson', 'opendyslexic'].includes(fontPref)) {
      return res.status(400).json({ error: 'Geçersiz font' });
    }
    data.fontPref = fontPref;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: publicUser(user) });
});

// Şifre değiştirme
router.post('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword ve newPassword zorunlu' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: 'Mevcut şifre hatalı' });
  }
  await prisma.user.update({
    where: { id: req.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  res.json({ ok: true });
});

export default router;
