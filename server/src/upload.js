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
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype] || ''}`),
});

const multerUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXT[file.mimetype]) cb(null, true);
    else cb(new Error('Yalnızca görsel dosyaları kabul edilir (jpg, png, webp, gif)'));
  },
});

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
      next();
    });
  };
}

export function deleteUpload(bannerPath) {
  if (!bannerPath) return;
  const file = path.join(uploadsDir, path.basename(bannerPath));
  fs.promises.unlink(file).catch(() => {});
}
