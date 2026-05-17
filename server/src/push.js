// FCM (Firebase Cloud Messaging) push bildirimleri.
// Service account dosyasi yoksa sessizce devre disi kalir —
// Socket.IO bildirimi ve bildirim gecmisi calismaya devam eder.
import fs from 'node:fs';
import admin from 'firebase-admin';
import { prisma } from './prisma.js';

const SERVICE_ACCOUNT_PATH =
  process.env.FCM_SERVICE_ACCOUNT || '/app/fcm/service-account.json';

let messaging = null;
let initTried = false;

function ensureInit() {
  if (initTried) return;
  initTried = true;

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.log('FCM yapılandırılmadı — push bildirimleri devre dışı.');
    return;
  }
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    messaging = admin.messaging();
    console.log('FCM push etkin.');
  } catch (err) {
    console.error('FCM başlatılamadı:', err.message);
  }
}

// Kullanicinin tum cihazlarina push gonderir; gecersiz token'lari temizler.
export async function sendPush(userId, title, body) {
  ensureInit();
  if (!messaging) return;

  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    notification: { title, body },
    tokens: tokens.map((t) => t.token),
  });

  const stale = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || '';
      if (code.includes('not-registered') || code.includes('invalid-argument')) {
        stale.push(tokens[i].token);
      }
    }
  });
  if (stale.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
  }
}
