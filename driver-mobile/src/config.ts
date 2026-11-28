/** Ilova sozlamalari. API manzili yig'ish vaqtida EXPO_PUBLIC_API_URL dan olinadi (.env yoki GitHub o'zgaruvchisi). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export const APP_NAME = 'Chortoq Ijrochi';
export const SUPPORT = '@taxigo_support';

/** Telegram orqali kirish: kod muddati tugaguncha shu oraliqda so'raymiz */
export const LOGIN_POLL_MS = 2000;

/** Chortoq Services boti: kirish, raqam ulashish, Mini App */
export const BOT_URL = 'https://t.me/chortoqgotaxibot';

/** Xarita boshlang'ich markazi (joylashuv noma'lum bo'lsa) — Chortoq */
export const DEFAULT_CENTER = { lat: 41.0694, lng: 71.8237 };
