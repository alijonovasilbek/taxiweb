// Mavzu: foydalanuvchi tanlovi (cs_theme: 'light' | 'dark') > Telegram colorScheme > qurilma sozlamasi
const KEY = 'cs_theme';

export function getThemePref() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function resolveTheme() {
  const pref = getThemePref();
  if (pref === 'light' || pref === 'dark') return pref;
  const tg = window.Telegram?.WebApp;
  if (tg?.colorScheme) return tg.colorScheme === 'dark' ? 'dark' : 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme() {
  const theme = resolveTheme();
  document.documentElement.dataset.theme = theme;
  const tg = window.Telegram?.WebApp;
  try {
    tg?.setHeaderColor?.(theme === 'dark' ? '#3d0816' : '#7d1531');
    tg?.setBackgroundColor?.(theme === 'dark' ? '#121014' : '#f4f1ee');
  } catch {}
  return theme;
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch {}
  return applyTheme();
}
