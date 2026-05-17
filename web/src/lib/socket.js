import { io } from 'socket.io-client';
import { API_BASE } from './api.js';

export function createSocket(token) {
  return io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
  });
}
