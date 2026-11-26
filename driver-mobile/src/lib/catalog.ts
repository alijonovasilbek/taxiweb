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
