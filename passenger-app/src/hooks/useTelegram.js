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

const tg = window.Telegram?.WebApp?.initData
  ? window.Telegram.WebApp
  : DEV_MOCK_TG;

export function useTelegram() {
  return {
    tg,
    user: tg.initDataUnsafe?.user,
    initData: tg.initData,
    colorScheme: tg.colorScheme,
    themeParams: tg.themeParams,
  };
}
