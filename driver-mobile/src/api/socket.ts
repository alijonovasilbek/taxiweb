import { io, type Socket } from 'socket.io-client';

import { API_URL } from '../config';
import { getAccessToken, onSessionChange } from './client';

/** Bitta umumiy Socket.IO ulanishi. Token yangilansa — yangi token bilan qayta ulanadi. */
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = getAccessToken();
  if (!token || !API_URL) return null;
  if (!socket) {
    socket = io(API_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      // auth funksiya: har qayta ulanishda eng yangi access token yuboriladi
      auth: (cb) => cb({ token: getAccessToken() }),
      extraHeaders: { 'ngrok-skip-browser-warning': '1' },
      reconnectionDelayMax: 10_000,
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}

onSessionChange((signedIn) => {
  if (!signedIn) closeSocket();
  else if (socket) {
    // Yangi access token (refresh) — server sessiyasi yangilanishi uchun qayta ulanamiz
    socket.disconnect().connect();
  }
});
