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

// Tarayicidan API'ye erisebilecek origin'ler (virgulle ayrilir). Bos
// birakilirsa tum origin'lere izin verilir (acilista uyari gosterilir).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '4015', 10),
  jwtSecret,
  databaseUrl: process.env.DATABASE_URL,
  uploadsDir: process.env.UPLOADS_DIR || path.resolve('uploads'),
  allowedOrigins,
  // Bu e-postalarla giris yapan kullanicilar otomatik yonetici olur
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  // SMTP — yapilandirilmamissa (SMTP_HOST bos) e-posta gonderimi atlanir.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    // Kendinden-imzali (self-signed) TLS sertifikasi olan mail sunuculari icin.
    // Sertifika dogrulamasini kapatir — yalnizca kendi guvendiginiz sunucuda
    // "true" yapin (aksi halde MITM riski). Varsayilan: guvenli (dogrulama acik).
    allowSelfSigned: process.env.SMTP_ALLOW_SELF_SIGNED === 'true',
  },
  // E-posta baglantilarinda kullanilan genel web adresi. Bos birakilirsa
  // ilk ALLOWED_ORIGINS degeri kullanilir.
  appUrl:
    (process.env.APP_URL || '').replace(/\/$/, '') || allowedOrigins[0] || '',
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
