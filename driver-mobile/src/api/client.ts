/**
 * Backend bilan aloqa: access token (1 soat) + refresh token (60 kun, har ishlatilganda almashadi).
 * 401 kelsa — refresh bir marta (bir nechta so'rov bir vaqtda kelsa ham bitta) va so'rov qayta yuboriladi.
 * Refresh rad etilsa (chiqarilgan, bloklangan, token o'g'irlangan) — sessiya tozalanadi va kirish ekraniga qaytiladi.
 */
import { API_URL } from '../config';
import { getItem, KEYS, setItem } from '../lib/storage';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: number; telegram_id: number; first_name: string };
};

type Listener = (signedIn: boolean) => void;

let access: string | null = null;
let refresh: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<Listener>();

export function onSessionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = (v: boolean) => listeners.forEach((fn) => fn(v));

export async function loadSession(): Promise<boolean> {
  [access, refresh] = await Promise.all([getItem(KEYS.access), getItem(KEYS.refresh)]);
  return !!refresh;
}

export async function saveTokens(t: Tokens): Promise<void> {
  access = t.access_token;
  refresh = t.refresh_token;
  await Promise.all([setItem(KEYS.access, access), setItem(KEYS.refresh, refresh)]);
  emit(true);
}

export async function clearSession(): Promise<void> {
  access = null;
  refresh = null;
  await Promise.all([setItem(KEYS.access, null), setItem(KEYS.refresh, null)]);
  emit(false);
}

export const getAccessToken = () => access;

/** null — tarmoq xatosi (sessiya saqlanadi), false — sessiya tugagan */
async function doRefresh(): Promise<boolean | null> {
  if (!refresh) return false;
  try {
    const r = await request('/auth/app/refresh', { method: 'POST', body: { refresh_token: refresh }, auth: false });
    if (r.status === 200) {
      await saveTokens(r.data as Tokens);
      return true;
    }
    if (r.status === 401 || r.status === 403) {
      await clearSession();
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh()
      .then((v) => v === true)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

type Opts = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  timeoutMs?: number;
};

/** Holat kodi bilan xom javob (masalan, 202 "kutilmoqda" kerak bo'lganda) */
export async function request(path: string, opts: Opts = {}): Promise<{ status: number; data: any }> {
  const { method = 'GET', body, query, auth = true, timeoutMs = 15000 } = opts;
  if (!API_URL) throw new ApiError(0, "Server manzili sozlanmagan (EXPO_PUBLIC_API_URL)");
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const headers: Record<string, string> = { Accept: 'application/json', 'ngrok-skip-browser-warning': '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && access) headers.Authorization = `Bearer ${access}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}${qs}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, "Internet aloqasi yo'q yoki server javob bermadi");
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function message(data: any, status: number): string {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg);
  if (status === 429) return "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.";
  if (status >= 500) return 'Serverda xatolik. Keyinroq urinib ko‘ring.';
  return `Xatolik (${status})`;
}

/** Asosiy chaqiruv: 2xx bo'lmasa ApiError otadi */
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  let r = await request(path, opts);
  if (r.status === 401 && opts.auth !== false && refresh) {
    if (await refreshOnce()) r = await request(path, opts);
  }
  if (r.status < 200 || r.status >= 300) throw new ApiError(r.status, message(r.data, r.status), r.data);
  return r.data as T;
}
