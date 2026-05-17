import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from './config.js';

export const uploadsDir = config.uploadsDir;
fs.mkdirSync(uploadsDir, { recursive: true });

const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Dosya icerigindeki sihirli baytlardan gercek goruntu turunu belirler.
// Tarayicinin bildirdigi mimetype'a guvenilmez (sahteciligi onler).
function detectImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype] || ''}`),
});

const multerUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXT[file.mimetype]) cb(null, true);
    else cb(new Error('Yalnızca görsel dosyaları kabul edilir (jpg, png, webp)'));
  },
});

// Yuklenen dosyanin icerigini sihirli baytlardan dogrular; gecersizse siler.
function verifyUploadedImage(file) {
  let head;
  try {
    const fd = fs.openSync(file.path, 'r');
    head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
  } catch {
    return false;
  }
  return detectImageType(head) === file.mimetype;
}

// Tek görsel yükleyen, multer hatalarini 400 JSON'a ceviren middleware uretir
export function uploadSingle(field) {
  return (req, res, next) => {
    multerUpload.single(field)(req, res, (err) => {
      if (err) {
        const msg =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'Dosya çok büyük (en fazla 5MB)'
            : err.message || 'Yükleme hatası';
        return res.status(400).json({ error: msg });
      }
      if (req.file && !verifyUploadedImage(req.file)) {
        fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'Geçersiz ya da bozuk görsel dosyası' });
      }
      next();
    });
  };
}

export function deleteUpload(bannerPath) {
  if (!bannerPath) return;
  const file = path.join(uploadsDir, path.basename(bannerPath));
  fs.promises.unlink(file).catch(() => {});
}
