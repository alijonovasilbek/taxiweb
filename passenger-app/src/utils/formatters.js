export function formatPrice(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(amount))) + ' so\'m';
}

export function formatDistance(km) {
  if (km === null || km === undefined) return '—';
  const n = Number(km);
  return n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`;
}

export function formatDuration(min) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} soat ${min % 60} min`;
}

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export const WEEKDAYS_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
export const WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

// Backend vaqtni mahalliy (Toshkent) naive formatda qaytaradi: "2026-11-25T07:30:00"
export function parseLocal(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).replace(' ', 'T');
  return new Date(s.length <= 19 ? s : s);
}

export function formatDateTime(value) {
  const d = parseLocal(value);
  if (!d || isNaN(d)) return '—';
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === today.toDateString()) return `Bugun, ${hm}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Ertaga, ${hm}`;
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${hm}`;
}

export function formatDate(value) {
  const d = parseLocal(value);
  if (!d || isNaN(d)) return '—';
  return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeAgo(value) {
  const d = parseLocal(value);
  if (!d || isNaN(d)) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'hozirgina';
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return formatDate(value);
}

// <input type="datetime-local"> uchun qiymat
export function toInputDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toInputDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function apiError(err, fallback = 'Xatolik yuz berdi') {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.response?.data?.error || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg?.replace('Value error, ', '')).join('; ');
  return fallback;
}
