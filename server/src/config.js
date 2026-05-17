import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4015', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret_change_me',
  databaseUrl: process.env.DATABASE_URL,
  uploadsDir: process.env.UPLOADS_DIR || path.resolve('uploads'),
};
