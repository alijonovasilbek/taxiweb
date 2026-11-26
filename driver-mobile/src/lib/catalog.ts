/** backend/app/catalog.py bilan mos (nomlar ilovada ko'rsatish uchun) */
export const CATEGORY_NAMES: Record<string, string> = {
  sedan: 'Yengil avtomobil',
  minivan: 'Miniven',
  bus: 'Mikroavtobus',
  damas: 'Damas',
  labo: 'Labo',
  gazel: 'Gazel',
  isuzu: 'Isuzu',
  kamaz: 'KamAZ',
  dump_truck: 'Samosval',
  excavator: 'Ekskavator',
  bulldozer: 'Buldozer',
  crane: 'Avtokran',
  loader: 'Yuklagich',
  tractor: 'Traktor',
  concrete_mixer: 'Beton aralashtirgich',
};

export const VEHICLE_STATUS: Record<string, { text: string; tone: 'green' | 'orange' | 'red' | 'neutral' }> = {
  approved: { text: 'Tasdiqlangan', tone: 'green' },
  pending: { text: 'Tekshirilmoqda', tone: 'orange' },
  rejected: { text: 'Rad etilgan', tone: 'red' },
  blocked: { text: 'Bloklangan', tone: 'red' },
};

export const SERVICE_NAMES: Record<string, string> = {
  taxi: 'Taksi',
  carpool: "Po'puti",
  cargo: 'Yuk tashish',
  equipment: 'Spets texnika',
};

/** backend VEHICLE_CATEGORIES[...].services bilan mos */
export const CARPOOL_CATEGORIES = ['sedan', 'minivan', 'bus', 'damas'];
export const SERVICE_CATEGORIES: Record<string, string[]> = {
  cargo: ['minivan', 'damas', 'labo', 'gazel', 'isuzu', 'kamaz', 'dump_truck'],
  equipment: ['dump_truck', 'excavator', 'bulldozer', 'crane', 'loader', 'tractor', 'concrete_mixer'],
};

export const DOC_TYPES: Record<string, string> = {
  passport: 'Pasport',
  license: 'Haydovchilik guvohnomasi',
  tech_passport: 'Texnik pasport',
  insurance: "Sug'urta",
  other: 'Boshqa',
};

/** Kategoriya bo'yicha qaysi maydonlar so'raladi */
export const CATEGORY_GROUPS: { title: string; items: string[] }[] = [
  { title: "Yo'lovchi", items: ['sedan', 'minivan', 'bus'] },
  { title: 'Yuk', items: ['damas', 'labo', 'gazel', 'isuzu', 'kamaz', 'dump_truck'] },
  { title: 'Maxsus texnika', items: ['excavator', 'bulldozer', 'crane', 'loader', 'tractor', 'concrete_mixer'] },
];
export const PASSENGER_CATS = ['sedan', 'minivan', 'bus', 'damas'];
export const CARGO_CATS = ['minivan', 'damas', 'labo', 'gazel', 'isuzu', 'kamaz', 'dump_truck'];
