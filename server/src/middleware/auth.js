import { verifyToken } from '../auth.js';
import { prisma } from '../prisma.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
  }
}

// requireAuth'tan SONRA kullanilir — yalnizca yoneticilere izin verir
export async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user?.isAdmin) {
    return res.status(403).json({ error: 'Yönetici yetkisi gerekli' });
  }
  next();
}
