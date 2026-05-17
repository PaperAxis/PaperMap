import http from 'http';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isAllowedOrigin } from './config.js';
import { prisma } from './prisma.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import friendsRoutes from './routes/friends.js';
import familiesRoutes from './routes/families.js';
import locationRoutes from './routes/location.js';
import geofencesRoutes from './routes/geofences.js';
import notificationsRoutes from './routes/notifications.js';
import conversationsRoutes from './routes/conversations.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Reverse proxy arkasinda calisir — gercek istemci IP'si X-Forwarded-For'dan
app.set('trust proxy', true);

if (config.allowedOrigins.length === 0) {
  console.warn(
    '[uyarı] ALLOWED_ORIGINS ayarlı değil — tüm origin\'lere CORS izni veriliyor. ' +
      'Üretimde .env içinde ALLOWED_ORIGINS belirleyin.',
  );
}
app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) }));
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(config.uploadsDir));

app.get('/health', (req, res) => res.json({ ok: true }));

// Kimlik dogrulama uclarinda kaba kuvvet / e-posta sayimi sinirlamasi
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme. Lütfen birkaç dakika sonra tekrar deneyin.' },
  validate: { trustProxy: false },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/families', familiesRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/geofences', geofencesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

const server = http.createServer(app);
initSocket(server);

// 30 gunden eski konum gecmisini periyodik temizle
const HISTORY_RETENTION_DAYS = 30;
async function pruneLocationHistory() {
  const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.locationHistory.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    if (count > 0) console.log(`Eski konum geçmişi temizlendi: ${count} kayıt`);
  } catch (err) {
    console.error('konum geçmişi temizleme:', err);
  }
}
pruneLocationHistory();
setInterval(pruneLocationHistory, 6 * 60 * 60 * 1000);

server.listen(config.port, () => {
  console.log(`PaperMap server http://localhost:${config.port}`);
});
