// Socket.IO sunucu referansini tutan kucuk modul.
// socket.js disindaki modullerin (notify.js gibi) kullaniciya olay
// gondermesini saglar — dairesel import olmadan.
let io = null;

export function setIo(instance) {
  io = instance;
}

export function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}
