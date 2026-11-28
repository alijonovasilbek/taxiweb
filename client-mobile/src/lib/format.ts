/** Sana/vaqt: backend Toshkent vaqtida "naive" qaytaradi — telefon ham shu mintaqada */
export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (same(d, today)) return `Bugun ${hm}`;
  if (same(d, tomorrow)) return `Ertaga ${hm}`;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
}

type Tone = 'green' | 'orange' | 'red' | 'neutral' | 'brand';

export const TRIP_STATUS: Record<string, { text: string; tone: Tone }> = {
  active: { text: 'Faol', tone: 'green' },
  full: { text: "To'ldi", tone: 'brand' },
  departed: { text: "Yo'lda", tone: 'orange' },
  completed: { text: 'Yakunlangan', tone: 'neutral' },
  cancelled: { text: 'Bekor', tone: 'red' },
};

export const BOOKING_STATUS: Record<string, { text: string; tone: Tone }> = {
  pending: { text: 'Kutilmoqda', tone: 'orange' },
  confirmed: { text: 'Tasdiqlangan', tone: 'green' },
  rejected: { text: 'Rad etilgan', tone: 'red' },
  cancelled: { text: 'Bekor', tone: 'neutral' },
  completed: { text: 'Yakunlangan', tone: 'neutral' },
};

export const REQUEST_STATUS: Record<string, { text: string; tone: Tone }> = {
  open: { text: 'Ochiq', tone: 'brand' },
  assigned: { text: 'Ijrochi tanlandi', tone: 'orange' },
  in_progress: { text: 'Jarayonda', tone: 'green' },
  completed: { text: 'Yakunlangan', tone: 'neutral' },
  cancelled: { text: 'Bekor', tone: 'red' },
  expired: { text: 'Muddati o‘tgan', tone: 'neutral' },
};

export const OFFER_STATUS: Record<string, { text: string; tone: Tone }> = {
  pending: { text: 'Taklif yuborilgan', tone: 'orange' },
  accepted: { text: 'Qabul qilindi', tone: 'green' },
  rejected: { text: 'Tanlanmadi', tone: 'neutral' },
  withdrawn: { text: 'Qaytarib olingan', tone: 'neutral' },
};

export const ORDER_STATUS: Record<string, { text: string; tone: Tone }> = {
  searching: { text: 'Qidirilmoqda', tone: 'orange' },
  accepted: { text: "Haydovchi yo'lda", tone: 'brand' },
  driver_arrived: { text: 'Haydovchi keldi', tone: 'green' },
  in_progress: { text: 'Safarda', tone: 'brand' },
  completed: { text: 'Yakunlangan', tone: 'neutral' },
  cancelled: { text: 'Bekor qilingan', tone: 'red' },
  no_drivers: { text: 'Haydovchi topilmadi', tone: 'red' },
};

export const PAYMENT: Record<string, string> = { cash: 'Naqd', payme: 'Payme', click: 'Click' };

/** Kun vaqtiga qarab salomlashuv */
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Xayrli tun';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}
