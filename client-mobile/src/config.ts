/** Ilova sozlamalari. API manzili yig'ish vaqtida EXPO_PUBLIC_API_URL dan olinadi (.env yoki GitHub o'zgaruvchisi). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** Backend'ga: qaysi ilova (push va bot matnlari shunga qarab) */
export const APP_KIND = 'client' as const;
export const APP_NAME = 'Chortoq';
export const SUPPORT = '@taxigo_support';

/** Telegram orqali kirish: kod muddati tugaguncha shu oraliqda so'raymiz */
export const LOGIN_POLL_MS = 2000;

/** Chortoq Services boti: kirish, raqam ulashish, Mini App */
export const BOT_URL = 'https://t.me/chortoqgotaxibot';

/** Ijrochilar ilovasi (Profil → "Ijrochi bo'lish") */
export const DRIVER_APP_URL = 'https://github.com/alijonovasilbek/taxiweb/releases/download/android-dev/chortoq-ijrochi-dev.apk';

/** Joylashuv noma'lum bo'lsa — Chortoq markazi */
export const DEFAULT_CENTER = { lat: 41.0694, lng: 71.8237 };
