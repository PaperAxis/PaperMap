import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

// JWT_SECRET acilista dogrulanir — varsayilan/kisa deger ile uretimde
// calismak token sahteciligine yol acar.
const PLACEHOLDER_SECRETS = new Set([
  'dev_insecure_secret_change_me',
  'change_me_to_a_long_random_secret',
]);
const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < 32 || PLACEHOLDER_SECRETS.has(jwtSecret)) {
  throw new Error(
    'JWT_SECRET ayarlanmalı: en az 32 karakter, rastgele ve gizli bir değer. ' +
      '.env dosyanızdaki JWT_SECRET değerini değiştirin.',
  );
}

export const config = {
  port: parseInt(process.env.PORT || '4015', 10),
  jwtSecret,
  databaseUrl: process.env.DATABASE_URL,
  uploadsDir: process.env.UPLOADS_DIR || path.resolve('uploads'),
  // Tarayicidan API'ye erisebilecek origin'ler (virgulle ayrilir). Bos
  // birakilirsa tum origin'lere izin verilir (acilista uyari gosterilir).
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Bu e-postalarla giris yapan kullanicilar otomatik yonetici olur
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

// Capacitor (APK/IPA) WebView origin'leri — her zaman izinli (mobil uygulama).
const NATIVE_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
]);

// Bir origin'in API'ye erismesine izin verilip verilmedigini soyler.
export function isAllowedOrigin(origin) {
  if (!origin) return true; // native uygulama / sunucu-ici istek
  if (NATIVE_ORIGINS.has(origin)) return true;
  if (config.allowedOrigins.length === 0) return true; // yapilandirilmamis
  return config.allowedOrigins.includes(origin);
}
