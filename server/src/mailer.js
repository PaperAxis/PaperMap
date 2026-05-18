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
  });
}

// E-posta gonderir. SMTP yapilandirilmamissa (SMTP_HOST bos) gonderim
// atlanir; bunun yerine baglanti sunucu loguna yazilir — boylece SMTP
// olmadan da sifre sifirlama/dogrulama akislari kirilmaz.
export async function sendMail({ to, subject, text, link }) {
  if (!smtpConfigured) {
    console.warn(
      `[mailer] SMTP yapılandırılmadı — e-posta gönderilmedi (${to}: ${subject}).` +
        (link ? ` Bağlantı: ${link}` : ''),
    );
    return;
  }
  try {
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error('[mailer] e-posta gönderilemedi:', err.message);
  }
}
