const tg = window.Telegram?.WebApp || {
  initData: '',
  initDataUnsafe: {},
  expand: () => {},
  ready: () => {},
  close: () => {},
  showAlert: (msg) => alert(msg),
  MainButton: { show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {}, offClick: () => {} },
  HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
  themeParams: {},
};

export function useTelegram() {
  return { tg, user: tg.initDataUnsafe?.user, initData: tg.initData };
}
