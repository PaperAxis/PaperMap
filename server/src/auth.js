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

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    sharingEnabled: u.sharingEnabled,
  };
}
