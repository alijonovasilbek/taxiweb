import { create } from 'zustand';

import { api, ApiError, clearSession, loadSession, onSessionChange, request, saveTokens, type Tokens } from '../api/client';
import { deviceInfo, deviceName, getDeviceId } from '../lib/device';
import { getItem, KEYS, setItem } from '../lib/storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: Status;
  permissionsDone: boolean;
  bootstrap: () => Promise<void>;
  completeLogin: (t: Tokens) => Promise<void>;
  setPermissionsDone: (v: boolean) => void;
  logout: (allDevices?: boolean) => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  permissionsDone: false,
  bootstrap: async () => {
    const [has, perms] = await Promise.all([loadSession(), getItem(KEYS.permissionsDone)]);
    set({ status: has ? 'signedIn' : 'signedOut', permissionsDone: perms === '1' });
    // Har ochilishda: ilova versiyasi va qurilma ma'lumoti serverda yangilansin (KAMCHILIKLAR-ANDROID #9)
    if (has) void registerDevice();
  },
  completeLogin: async (t) => {
    await saveTokens(t);
    void registerDevice();
    set({ status: 'signedIn' });
  },
  setPermissionsDone: (v) => {
    set({ permissionsDone: v });
    void setItem(KEYS.permissionsDone, v ? '1' : null);
  },
  logout: async (allDevices = false) => {
    // Avval taksi onlayn holatini o'chiramiz — aks holda fon GPS va buyurtmalar chiqishdan keyin ham davom etadi
    try {
      const { goOffline } = await import('../lib/taxi');
      await goOffline();
    } catch {
      // haydovchi bo'lmasa yoki oflayn bo'lsa — davom etamiz
    }
    try {
      await api('/auth/app/logout', { method: 'POST', query: { all_devices: allDevices } });
    } catch {
      // oflayn bo'lsa ham lokal sessiya tozalanadi; serverdagi sessiya 60 kunda o'zi tugaydi
    }
    await clearSession();
  },
}));

// Refresh rad etilsa (bloklangan, boshqa qurilmadan chiqarilgan) — avtomatik kirish ekraniga
onSessionChange((signedIn) => {
  useAuth.setState({ status: signedIn ? 'signedIn' : 'signedOut' });
});

/** Qurilmani ro'yxatga olish (push tokeni 3-bosqichda — Firebase ulanganda qo'shiladi) */
export async function registerDevice(fcmToken?: string): Promise<void> {
  try {
    await api('/devices/me', {
      method: 'PUT',
      body: { device_id: await getDeviceId(), ...deviceInfo(), ...(fcmToken ? { fcm_token: fcmToken } : {}) },
    });
  } catch {
    // keyingi ochilishda qayta urinamiz
  }
}

// ── Telegram orqali kirish (backend: /auth/app/start → bot → /auth/app/poll) ──
export type LoginTicket = { code: string; bot_url: string; expires_in: number; poll_interval: number };

export async function startTelegramLogin(): Promise<LoginTicket> {
  return api<LoginTicket>('/auth/app/start', {
    method: 'POST',
    auth: false,
    body: { device_id: await getDeviceId(), device_name: deviceName().slice(0, 120) },
  });
}

/** 'pending' — hali tasdiqlanmagan; Tokens — kirildi; ApiError(410) — eskirgan yoki rad etilgan */
export async function pollTelegramLogin(code: string): Promise<'pending' | Tokens> {
  const r = await request('/auth/app/poll', {
    method: 'POST',
    auth: false,
    body: { code, device_id: await getDeviceId() },
  });
  if (r.status === 202) return 'pending';
  if (r.status === 200) return r.data as Tokens;
  const detail = typeof r.data?.detail === 'string' ? r.data.detail : `Xatolik (${r.status})`;
  throw new ApiError(r.status, detail, r.data);
}
