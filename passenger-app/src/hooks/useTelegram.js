// Dev rejimida mock user (faqat localhost uchun)
const DEV_MODE = import.meta.env.DEV && !window.Telegram?.WebApp?.initData;

const DEV_MOCK_TG = {
  initData: 'dev_mock',
  initDataUnsafe: {
    user: { id: 999999999, first_name: 'Test', last_name: 'User', username: 'testuser' },
  },
  expand: () => {},
  ready: () => {},
  close: () => {},
  showAlert: (msg) => alert(msg),
  showConfirm: (msg, cb) => cb(confirm(msg)),
  MainButton: { show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {}, offClick: () => {} },
  BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
  HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
  themeParams: {},
};

// Mock faqat `npm run dev` (localhost) da. Production build'da Telegram'siz ochilsa — "bot orqali oching" ekrani.
const NO_TG = {
  initData: '', initDataUnsafe: {}, expand: () => {}, ready: () => {}, close: () => {},
  showAlert: (msg) => alert(msg), showConfirm: (msg, cb) => cb(confirm(msg)),
  MainButton: DEV_MOCK_TG.MainButton, BackButton: DEV_MOCK_TG.BackButton, HapticFeedback: DEV_MOCK_TG.HapticFeedback,
  themeParams: {},
};
const tg = window.Telegram?.WebApp?.initData
  ? window.Telegram.WebApp
  : (DEV_MODE ? DEV_MOCK_TG : NO_TG);

export function useTelegram() {
  return {
    tg,
    user: tg.initDataUnsafe?.user,
    initData: tg.initData,
    colorScheme: tg.colorScheme,
    themeParams: tg.themeParams,
  };
}
