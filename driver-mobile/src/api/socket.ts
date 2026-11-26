import { io, type Socket } from 'socket.io-client';

import { API_URL } from '../config';
import { clearSession, getAccessToken, hasSession, onSessionChange, refreshSession } from './client';

/** Bitta umumiy Socket.IO ulanishi. Token yangilansa — yangi token bilan qayta ulanadi. */
let socket: Socket | null = null;
let refreshingForSocket = false;

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
    // Server ulanishni rad etdi — ko'pincha access token eskirgan: yangilab, qayta ulanamiz (KAMCHILIKLAR-ANDROID #11)
    socket.on('connect_error', async () => {
      if (refreshingForSocket || !hasSession()) return;
      refreshingForSocket = true;
      try {
        await refreshSession(); // muvaffaqiyatli bo'lsa onSessionChange → qayta ulanish
      } finally {
        refreshingForSocket = false;
      }
    });
    // Sessiya boshqa qurilmadan yoki admin tomonidan yopildi (#10)
    socket.on('session_revoked', () => {
      void clearSession();
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function closeSocket(): void {
  socket?.removeAllListeners();
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
