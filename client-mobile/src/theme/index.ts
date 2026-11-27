import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import { getItem, KEYS, setItem } from '../lib/storage';

/** Mini App bilan bir xil tokenlar (passenger-app/src/styles.css) */
const light = {
  scheme: 'light' as 'light' | 'dark',
  primary: '#8c1c3a',
  primaryDark: '#5e0f26',
  primarySoft: 'rgba(140,28,58,0.1)',
  hero: '#7d1531',
  onPrimary: '#ffffff',
  text: '#000000',
  muted: 'rgba(60,60,67,0.6)',
  faint: 'rgba(60,60,67,0.45)',
  line: 'rgba(60,60,67,0.14)',
  fill: 'rgba(118,118,128,0.12)',
  bg: '#f6f1f2',
  card: '#ffffff',
  pressed: '#e5e5ea',
  green: '#34c759',
  greenInk: '#248a3d',
  greenSoft: 'rgba(52,199,89,0.13)',
  red: '#ff3b30',
  redInk: '#d70015',
  redSoft: 'rgba(255,59,48,0.1)',
  orange: '#ff9500',
  orangeInk: '#c93400',
  orangeSoft: 'rgba(255,149,0,0.13)',
  accent: '#ffcc00',
  tabBar: '#ffffff',
  // Bosh sahifa (Web App: passenger-app/src/styles.css → --h-*)
  hBg: '#f4f1ee',
  hHero: '#7d1531',
  hSearch: '#ffffff',
  hSearchText: 'rgba(60,60,67,0.55)',
  taxi: '#ffc72c',
  taxiArt: '#e3a800',
  tileGreen: '#dcefe0', tileGreenIc: '#1f8a3e', tileGreenIcBg: '#ffffff',
  tileBlue: '#d3e9ee', tileBlueIc: '#0e6f86', tileBlueIcBg: '#ffffff',
  equip: '#7d1531', equipText: '#ffffff', equipSub: 'rgba(255,255,255,0.78)', equipIcBg: 'rgba(255,255,255,0.16)', equipIc: '#ffffff',
  tileBorder: 'transparent',
  sheet: '#ffffff',
  shadow: 'rgba(40,10,20,0.16)',
};

const dark: typeof light = {
  ...light,
  scheme: 'dark',
  primary: '#e0557c',
  primaryDark: '#f2a3b8',
  primarySoft: 'rgba(224,85,124,0.18)',
  hero: '#3d0816',
  text: '#ffffff',
  muted: 'rgba(235,235,245,0.6)',
  faint: 'rgba(235,235,245,0.38)',
  line: 'rgba(84,84,88,0.55)',
  fill: 'rgba(118,118,128,0.24)',
  bg: '#000000',
  card: '#1c1c1e',
  pressed: '#2c2c2e',
  greenSoft: 'rgba(48,209,88,0.2)',
  redSoft: 'rgba(255,69,58,0.2)',
  orangeSoft: 'rgba(255,159,10,0.2)',
  tabBar: '#1c1a1f',
  hBg: '#121014',
  hHero: '#5b1024',
  hSearch: '#1f1c22',
  hSearchText: 'rgba(235,235,245,0.5)',
  tileGreen: '#16251c', tileGreenIc: '#6fd68b', tileGreenIcBg: '#1f4a2c',
  tileBlue: '#10252c', tileBlueIc: '#6fc8e0', tileBlueIcBg: '#1b4652',
  equip: '#2a1419', equipText: '#ffffff', equipSub: 'rgba(235,235,245,0.6)', equipIcBg: '#4a1b28', equipIc: '#ff8fab',
  tileBorder: 'rgba(255,255,255,0.07)',
  sheet: '#1c1c1e',
  shadow: 'rgba(0,0,0,0.5)',
};

export type Theme = typeof light;
export type ThemePref = 'system' | 'light' | 'dark';

/** Android'da shrift fayl nomi bilan ro'yxatga olinadi (expo-font config plugin) */
export const font = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };

type ThemeState = { pref: ThemePref; load: () => Promise<void>; set: (p: ThemePref) => void };

export const useThemePref = create<ThemeState>((set) => ({
  pref: 'system',
  load: async () => {
    const v = await getItem(KEYS.theme);
    if (v === 'light' || v === 'dark' || v === 'system') set({ pref: v });
  },
  set: (pref) => {
    set({ pref });
    void setItem(KEYS.theme, pref);
  },
}));

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useThemePref((s) => s.pref);
  const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return mode === 'dark' ? dark : light;
}

export const isDark = (t: Theme) => t.scheme === 'dark';
