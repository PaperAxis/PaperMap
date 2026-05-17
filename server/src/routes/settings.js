import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uploadSingle, deleteUpload } from '../upload.js';

const router = Router();

async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: 'app' },
    create: { id: 'app' },
    update: {},
  });
}

function settingsView(s) {
  return { appName: s.appName, logoPath: s.logoPath };
}

// Herkese açık — uygulama adı + logo
router.get('/', async (req, res) => {
  const s = await getSettings();
  res.json({ settings: settingsView(s) });
});

// Uygulama adını güncelle (yönetici)
router.patch('/', requireAuth, requireAdmin, async (req, res) => {
  const { appName } = req.body || {};
  if (appName === undefined) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }
  const name = String(appName).trim();
  if (!name || name.length > 40) {
    return res.status(400).json({ error: 'Uygulama adı 1–40 karakter olmalı' });
  }
  await getSettings();
  const s = await prisma.appSettings.update({
    where: { id: 'app' },
    data: { appName: name },
  });
  res.json({ settings: settingsView(s) });
});

// Logo yükle (yönetici)
router.post(
  '/logo',
  requireAuth,
  requireAdmin,
  uploadSingle('logo'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'logo dosyası gerekli' });
    }
    const current = await getSettings();
    const s = await prisma.appSettings.update({
      where: { id: 'app' },
      data: { logoPath: `/uploads/${req.file.filename}` },
    });
    deleteUpload(current.logoPath);
    res.json({ settings: settingsView(s) });
  },
);

// Logoyu kaldır (yönetici)
router.delete('/logo', requireAuth, requireAdmin, async (req, res) => {
  const current = await getSettings();
  const s = await prisma.appSettings.update({
    where: { id: 'app' },
    data: { logoPath: null },
  });
  deleteUpload(current.logoPath);
  res.json({ settings: settingsView(s) });
});

export default router;
