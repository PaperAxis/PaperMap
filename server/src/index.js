import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
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

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(config.uploadsDir));

app.get('/health', (req, res) => res.json({ ok: true }));

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
