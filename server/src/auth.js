import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

// Gecerli kullanici adi: 3-20 karakter, kucuk harf / rakam / alt cizgi
export function isValidUsername(s) {
  return typeof s === 'string' && /^[a-z0-9_]{3,20}$/.test(s);
}

// Oturum sahibinin kendi profili (tum alanlar dahil)
export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    sharingEnabled: u.sharingEnabled,
    sharingUntil: u.sharingUntil,
    avatarColor: u.avatarColor,
    avatarPath: u.avatarPath,
    bannerPath: u.bannerPath,
    theme: u.theme,
    fontPref: u.fontPref,
    iconStyle: u.iconStyle,
    statusText: u.statusText,
    emailVerified: u.emailVerified,
    hasPassword: u.hasPassword !== false,
    isAdmin: u.isAdmin,
  };
}
