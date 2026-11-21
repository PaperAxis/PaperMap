import nodemailer from 'nodemailer';
import { config } from './config.js';

const smtp = config.smtp;
export const smtpConfigured = Boolean(smtp.host);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    // Ulasilamayan SMTP'de istek askida kalmasin (proxy 504 yerine hizli hata):
    connectionTimeout: 10000, // baglanti kurma
    greetingTimeout: 10000, // sunucu selamlamasi
    socketTimeout: 20000, // sonraki islemler
    // Self-signed sertifika (SMTP_ALLOW_SELF_SIGNED=true) — dogrulamayi kapat:
    ...(smtp.allowSelfSigned ? { tls: { rejectUnauthorized: false } } : {}),
  });
  if (smtp.allowSelfSigned) {
    console.warn(
      '[mailer] SMTP_ALLOW_SELF_SIGNED=true — TLS sertifika doğrulaması KAPALI ' +
        '(yalnızca kendi güvendiğiniz sunucuda kullanın).',
    );
  }
  console.log(`[mailer] SMTP ayarlı: ${smtp.host}:${smtp.port}`);
} else {
  console.warn(
    '[mailer] SMTP ayarlı DEĞİL (SMTP_HOST boş) — doğrulama ve şifre ' +
      'sıfırlama e-postaları GÖNDERİLMEYECEK. Bağlantılar yalnızca bu loga ' +
      'yazılır. Ayarlamak için .env içine SMTP_HOST/PORT/USER/PASS/FROM girin.',
  );
}

// E-posta gonderir. Sonuc: { ok, skipped?, error? }. SMTP yapilandirilmamissa
// (SMTP_HOST bos) gonderim atlanir ve baglanti sunucu loguna yazilir — boylece
// SMTP olmadan da akislar kirilmaz. Hata firlatmaz; cagiran sonuca bakabilir.
export async function sendMail({ to, subject, text, html, link }) {
  if (!smtpConfigured) {
    console.warn(
      `[mailer] SMTP yapılandırılmadı — e-posta gönderilmedi (${to}: ${subject}).` +
        (link ? ` Bağlantı: ${link}` : ''),
    );
    return { ok: false, skipped: true };
  }
  try {
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    return { ok: true };
  } catch (err) {
    console.error(`[mailer] e-posta gönderilemedi (${to}): ${err.message}`);
    return { ok: false, error: err.message };
  }
}
