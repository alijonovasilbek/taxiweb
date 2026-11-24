// Standart xarita markazi — Chortoq
export const CHORTOQ = { lat: 41.0694, lng: 71.8237 };

// Tez tanlash uchun mashhur joylar (Yandex API kaliti bo'lmasa ham ishlaydi)
export const PRESET_PLACES = [
  { address: 'Chortoq markazi', lat: 41.0694, lng: 71.8237 },
  { address: 'Chortoq dehqon bozori', lat: 41.0721, lng: 71.8190 },
  { address: 'Namangan shahri', lat: 40.9983, lng: 71.6726 },
  { address: 'Uychi', lat: 41.0806, lng: 71.9233 },
  { address: 'Yangiqo\'rg\'on', lat: 41.1919, lng: 71.7233 },
  { address: 'Chust', lat: 41.0033, lng: 71.2378 },
  { address: 'Pop', lat: 40.8736, lng: 71.1089 },
  { address: 'Toshkent', lat: 41.2995, lng: 69.2401 },
];

export const STATUS = {
  // so'rovlar
  open: { label: 'Takliflar kutilmoqda', color: 'orange' },
  assigned: { label: 'Ijrochi tanlandi', color: 'blue' },
  in_progress: { label: 'Bajarilmoqda', color: 'blue' },
  completed: { label: 'Yakunlandi', color: 'green' },
  cancelled: { label: 'Bekor qilindi', color: 'red' },
  expired: { label: 'Muddati o\'tdi', color: 'gray' },
  // qatnov
  active: { label: 'Faol', color: 'green' },
  full: { label: 'To\'lgan', color: 'orange' },
  departed: { label: 'Yo\'lda', color: 'blue' },
  // bron / taklif
  pending: { label: 'Kutilmoqda', color: 'orange' },
  confirmed: { label: 'Tasdiqlandi', color: 'green' },
  rejected: { label: 'Rad etildi', color: 'red' },
  accepted: { label: 'Qabul qilindi', color: 'green' },
  withdrawn: { label: 'Qaytarib olindi', color: 'gray' },
  approved: { label: 'Tasdiqlangan', color: 'green' },
  blocked: { label: 'Bloklangan', color: 'red' },
};

export const SERVICE_ROUTES = {
  taxi: '/book',
  carpool: '/carpool',
  cargo: '/requests/new/cargo',
  equipment: '/requests/new/equipment',
};

export const DURATION_UNITS = [
  { code: 'hour', label: 'soat' },
  { code: 'shift', label: 'smena' },
  { code: 'day', label: 'kun' },
];
