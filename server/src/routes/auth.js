import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../prisma.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
  isValidUsername,
} from '../auth.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadSingle, deleteUpload } from '../upload.js';
import { config } from '../config.js';
import { broadcastPeerUpdate } from '../socket.js';
import { sendMail, smtpConfigured } from '../mailer.js';

const router = Router();

const RESET_TTL_MS = 60 * 60 * 1000; // 1 saat
const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gun

// Tek kullanimlik token uretir ve kaydeder.
async function createAuthToken(userId, type, ttlMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.authToken.create({
    data: { token, userId, type, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

// E-posta dogrulama bağlantısı gonderir (onceki verify token'larini siler).
async function sendVerifyEmail(user) {
  await prisma.authToken.deleteMany({
    where: { userId: user.id, type: 'verify' },
  });
  const token = await createAuthToken(user.id, 'verify', VERIFY_TTL_MS);
  const link = `${config.appUrl}/verify/${token}`;
  return sendMail({
    to: user.email,
    subject: 'PaperMap — E-posta doğrulama',
    text:
      `Merhaba ${user.displayName},\n\n` +
      `E-posta adresini doğrulamak için aşağıdaki bağlantıya tıkla:\n` +
      `${link}\n\n` +
      `Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.`,
    link,
  });
}

// ADMIN_EMAILS listesindeki kullanicilari otomatik yonetici yapar
async function applyAdminEmail(user) {
  if (config.adminEmails.includes(user.email) && !user.isAdmin) {
    return prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }
  return user;
}

router.post('/register', async (req, res) => {
  const { email, username, displayName, password } = req.body || {};
  if (!email || !username || !displayName || !password) {
    return res
      .status(400)
      .json({ error: 'email, username, displayName ve password zorunlu' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı' });
  }
  const normalizedUsername = String(username).toLowerCase().trim();
  if (!isValidUsername(normalizedUsername)) {
    return res.status(400).json({
      error: 'Kullanıcı adı 3-20 karakter olmalı; küçük harf, rakam ve _ kullanın',
    });
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
  }
  const usernameTaken = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });
  if (usernameTaken) {
    return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış' });
  }
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      displayName: String(displayName).trim(),
      passwordHash: await hashPassword(password),
    },
  });
  sendVerifyEmail(user).catch((err) =>
    console.error('doğrulama e-postası:', err),
  );
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

// E-posta doğrulama — token ile hesabı doğrular.
router.get('/verify/:token', async (req, res) => {
  const row = await prisma.authToken.findUnique({
    where: { token: req.params.token },
  });
  if (!row || row.type !== 'verify' || row.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Bağlantı geçersiz veya süresi dolmuş' });
  }
  await prisma.user.update({
    where: { id: row.userId },
    data: { emailVerified: true },
  });
  await prisma.authToken.deleteMany({
    where: { userId: row.userId, type: 'verify' },
  });
  res.json({ ok: true });
});

// Doğrulama e-postasını yeniden gönder.
router.post('/verify/resend', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  if (user.emailVerified) {
    return res.status(400).json({ error: 'E-posta zaten doğrulanmış' });
  }
  if (!smtpConfigured) {
    return res.status(503).json({
      error:
        'Sunucuda e-posta gönderimi yapılandırılmamış. Yöneticiyle iletişime geçin.',
    });
  }
  const result = await sendVerifyEmail(user);
  if (!result?.ok) {
    return res.status(502).json({
      error: 'Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.',
    });
  }
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const { login, email, password } = req.body || {};
  const identifier = String(login || email || '').toLowerCase().trim();
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı/e-posta ve şifre zorunlu' });
  }
  let user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }
  user = await applyAdminEmail(user);
  if (user.disabled) {
    return res.status(403).json({ error: 'Hesabınız devre dışı bırakıldı.' });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// Şifre sıfırlama isteği — kayıtlıysa e-posta gönderir. Yanıt her durumda
// aynıdır (e-posta sayımını sızdırmamak için).
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email zorunlu' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (user && !user.disabled) {
    await prisma.authToken.deleteMany({
      where: { userId: user.id, type: 'reset' },
    });
    const token = await createAuthToken(user.id, 'reset', RESET_TTL_MS);
    const link = `${config.appUrl}/reset/${token}`;
    sendMail({
      to: user.email,
      subject: 'PaperMap — Şifre sıfırlama',
      text:
        `Merhaba ${user.displayName},\n\n` +
        `Şifreni sıfırlamak için aşağıdaki bağlantıya tıkla (1 saat geçerli):\n` +
        `${link}\n\n` +
        `Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
      link,
    }).catch(() => {});
  }
  res.json({ ok: true });
});

// Şifre sıfırlama — token ile yeni şifre belirler.
router.post('/reset', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token ve newPassword zorunlu' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı' });
  }
  const row = await prisma.authToken.findUnique({ where: { token: String(token) } });
  if (!row || row.type !== 'reset' || row.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Bağlantı geçersiz veya süresi dolmuş' });
  }
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.authToken.deleteMany({
    where: { userId: row.userId, type: 'reset' },
  });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  let user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  if (user.disabled) {
    return res.status(403).json({ error: 'Hesabınız devre dışı bırakıldı.' });
  }
  user = await applyAdminEmail(user);
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
  if (req.body?.username !== undefined) {
    const uname = String(req.body.username).toLowerCase().trim();
    if (!isValidUsername(uname)) {
      return res.status(400).json({
        error: 'Kullanıcı adı 3-20 karakter olmalı; küçük harf, rakam ve _ kullanın',
      });
    }
    const taken = await prisma.user.findUnique({ where: { username: uname } });
    if (taken && taken.id !== req.userId) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış' });
    }
    data.username = uname;
  }
  if (avatarColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(avatarColor))) {
      return res.status(400).json({ error: 'Geçersiz renk kodu' });
    }
    data.avatarColor = String(avatarColor).toLowerCase();
  }
  if (theme !== undefined) {
    if (typeof theme !== 'string' || !/^[a-z0-9-]{1,48}$/.test(theme)) {
      return res.status(400).json({ error: 'Geçersiz tema' });
    }
    data.theme = theme;
  }
  if (fontPref !== undefined) {
    if (typeof fontPref !== 'string' || !/^[a-z0-9-]{1,32}$/.test(fontPref)) {
      return res.status(400).json({ error: 'Geçersiz font' });
    }
    data.fontPref = fontPref;
  }
  if (req.body?.iconStyle !== undefined) {
    const iconStyle = req.body.iconStyle;
    if (typeof iconStyle !== 'string' || !/^[a-z]{1,16}$/.test(iconStyle)) {
      return res.status(400).json({ error: 'Geçersiz ikon stili' });
    }
    data.iconStyle = iconStyle;
  }
  let statusChanged = false;
  if (req.body?.statusText !== undefined) {
    const raw = req.body.statusText;
    if (raw !== null && typeof raw !== 'string') {
      return res.status(400).json({ error: 'Geçersiz durum' });
    }
    const status = raw == null ? '' : String(raw).trim();
    if (status.length > 60) {
      return res.status(400).json({ error: 'Durum en fazla 60 karakter olabilir' });
    }
    data.statusText = status || null;
    statusChanged = true;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data });
  if (statusChanged) {
    broadcastPeerUpdate(req.userId).catch(() => {});
  }
  res.json({ user: publicUser(user) });
});

// Şifre değiştirme
router.post('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword) {
    return res.status(400).json({ error: 'newPassword zorunlu' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  // Google/PaperApp ile acilan hesap ilk sifresini mevcut sifre sormadan belirler.
  if (user.hasPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'currentPassword ve newPassword zorunlu' });
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      // 400: istemciler 401'i oturum sonu sayip cikis yaptiriyor.
      return res.status(400).json({ error: 'Mevcut şifre hatalı' });
    }
  }
  await prisma.user.update({
    where: { id: req.userId },
    data: { passwordHash: await hashPassword(newPassword), hasPassword: true },
  });
  res.json({ ok: true });
});

// Profil bannerı yükle
router.post('/profile/banner', requireAuth, uploadSingle('banner'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'banner dosyası gerekli' });
  }
  const current = await prisma.user.findUnique({ where: { id: req.userId } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { bannerPath: `/uploads/${req.file.filename}` },
  });
  deleteUpload(current?.bannerPath);
  res.json({ user: publicUser(user) });
});

// Profil bannerını kaldır
router.delete('/profile/banner', requireAuth, async (req, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.userId } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { bannerPath: null },
  });
  deleteUpload(current?.bannerPath);
  res.json({ user: publicUser(user) });
});

// Profil fotoğrafı (avatar) yükle
router.post('/profile/avatar', requireAuth, uploadSingle('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'avatar dosyası gerekli' });
  }
  const current = await prisma.user.findUnique({ where: { id: req.userId } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarPath: `/uploads/${req.file.filename}` },
  });
  deleteUpload(current?.avatarPath);
  res.json({ user: publicUser(user) });
});

// Profil fotoğrafını kaldır
router.delete('/profile/avatar', requireAuth, async (req, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.userId } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarPath: null },
  });
  deleteUpload(current?.avatarPath);
  res.json({ user: publicUser(user) });
});

export default router;
