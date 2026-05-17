import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import friendsRoutes from './routes/friends.js';
import familiesRoutes from './routes/families.js';
import locationRoutes from './routes/location.js';
import geofencesRoutes from './routes/geofences.js';
import notificationsRoutes from './routes/notifications.js';

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

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

const server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`PaperMap server http://localhost:${config.port}`);
});
