// Transactional e-mail bodies (verify, password reset). Every message goes out
// as multipart/alternative: a plain-text part and an HTML part built from the
// same fields. A text-only, three-line "click this link" mail from a young
// sending domain reads like phishing to Gmail; a complete message that says
// who sent it and why the recipient got it does not.
//
// HTML rules for mail clients: tables + inline styles only (Gmail drops
// <style> in many views), no web fonts (system fallbacks are what renders),
// no images (blocked by default, and an image-only header hurts spam scoring).

import { config } from './config.js';

// PaperAxis tokens (paperaxis-standartlari §2), inlined because mail clients
// do not read CSS variables.
const C = {
  paper: '#F5F3EE',
  raised: '#FFFFFF',
  soft: '#E6E4DE',
  ink: '#171918',
  graphite: '#666963',
  blue: '#315BDB',
};
const FONT_DISPLAY = "Manrope, Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_BODY = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

const FIRST_YEAR = 2026;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyrightYears() {
  const now = new Date().getFullYear();
  return now > FIRST_YEAR ? `${FIRST_YEAR}–${now}` : String(FIRST_YEAR);
}

function appHost() {
  try {
    return new URL(config.appUrl).host;
  } catch {
    return config.appUrl;
  }
}

/**
 * Builds a single-action account e-mail.
 * @param {object} p
 * @param {string} p.name        recipient display name (user input — escaped)
 * @param {string} p.heading     one-line title, e.g. "E-posta adresini doğrula"
 * @param {string} p.intro       sentence before the button
 * @param {string} p.actionLabel button text, verb first
 * @param {string} p.link        absolute action URL
 * @param {string} p.note        closing sentence (validity, "ignore if not you")
 * @returns {{ text: string, html: string }}
 */
export function renderActionMail({ name, heading, intro, actionLabel, link, note }) {
  const host = appHost();
  const why =
    `Bu e-postayı ${host} adresindeki PaperMap hesabınla ilgili bir işlem ` +
    `yapıldığı için aldın. Bu adrese gönderilen yanıtlar okunmaz.`;
  const imprint = `© ${copyrightYears()} PaperAxis · PaperMap`;

  const text =
    `Merhaba ${name},\n\n` +
    `${intro}\n\n` +
    `${actionLabel}:\n${link}\n\n` +
    `${note}\n\n` +
    `-- \n${why}\n${imprint}\n`;

  const e = escapeHtml;
  const href = e(link);
  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td style="padding:0 0 16px 0;font-family:${FONT_DISPLAY};font-size:18px;font-weight:700;color:${C.ink};">PaperMap</td></tr>
    <tr><td style="background:${C.raised};border:1px solid ${C.soft};border-radius:12px;padding:32px 24px;">
      <h1 style="margin:0 0 24px 0;font-family:${FONT_DISPLAY};font-size:24px;line-height:1.25;font-weight:700;color:${C.ink};">${e(heading)}</h1>
      <p style="margin:0 0 16px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${C.ink};">Merhaba ${e(name)},</p>
      <p style="margin:0 0 24px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${C.ink};">${e(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${C.blue};border-radius:8px;">
          <a href="${href}" style="display:inline-block;padding:12px 24px;font-family:${FONT_BODY};font-size:16px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;">${e(actionLabel)}</a>
        </td>
      </tr></table>
      <p style="margin:24px 0 8px 0;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${C.graphite};">Düğme çalışmazsa bu bağlantıyı tarayıcına yapıştır:</p>
      <p style="margin:0 0 24px 0;font-family:${FONT_MONO};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${href}" style="color:${C.blue};">${href}</a></p>
      <p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${C.graphite};">${e(note)}</p>
    </td></tr>
    <tr><td style="padding:24px 4px 0 4px;font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:${C.graphite};">${e(why)}</td></tr>
    <tr><td style="padding:8px 4px 0 4px;font-family:${FONT_MONO};font-size:12px;line-height:1.4;color:${C.graphite};">${e(imprint)}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { text, html };
}
