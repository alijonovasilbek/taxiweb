import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import { getItem, KEYS, setItem } from '../lib/storage';

/** Chortoq dizayn tokenlari (taksi ilovasi dizayni) */
const light = {
  scheme: 'light' as 'light' | 'dark',
  // Dizayn tokenlari (Chortoq taksi dizayni): iliq neytral fon, oq kartalar, bordo aksent
  primary: '#7b1e3a',
  primaryDark: '#5a1229',
  primarySoft: '#efe4e7',
  hero: '#7b1e3a',
  onPrimary: '#ffffff',
  ink: '#141414',
  onInk: '#ffffff',
  text: '#141414',
  muted: '#5f5f5f',
  faint: '#9a9a94',
  line: '#e6e6e1',
  lineSoft: '#efefea',
  fill: '#f3f3f0',
  bg: '#f6f6f3',
  card: '#ffffff',
  pressed: '#eaeae4',
  map: '#ecebe6',
  green: '#1a7f43',
  greenInk: '#1a7f43',
  greenSoft: '#e6f2ea',
  red: '#a61b1b',
  redInk: '#a61b1b',
  redSoft: '#fdecec',
  orange: '#94560f',
  orangeInk: '#94560f',
  orangeSoft: '#fbefe0',
  blueInk: '#1f5f99',
  blueSoft: '#e6eff8',
  accent: '#7b1e3a',
  tabBar: '#ffffff',
  grabber: '#d9d9d4',
  shadow: 'rgba(0,0,0,0.14)',
  sheet: '#ffffff',
};

const dark: typeof light = {
  ...light,
  scheme: 'dark',
  primary: '#d0587c',
  primaryDark: '#f2a3b8',
  primarySoft: '#3a1a24',
  hero: '#5a1229',
  ink: '#f2f2ee',
  onInk: '#141414',
  text: '#f2f2ee',
  muted: '#a3a39c',
  faint: '#6e6e69',
  line: '#2e2e2b',
  lineSoft: '#262624',
  fill: '#242422',
  bg: '#0f0f0e',
  card: '#1b1b1a',
  pressed: '#2a2a28',
  map: '#1b1b1a',
  green: '#4fc27d',
  greenInk: '#4fc27d',
  greenSoft: '#16291d',
  red: '#ff6b6b',
  redInk: '#ff8a8a',
  redSoft: '#3a1717',
  orange: '#e0a25a',
  orangeInk: '#e0a25a',
  orangeSoft: '#33240f',
  blueInk: '#7fb6ea',
  blueSoft: '#14243a',
  accent: '#d0587c',
  tabBar: '#161615',
  grabber: '#3a3a37',
  shadow: 'rgba(0,0,0,0.5)',
  sheet: '#1b1b1a',
};

export type Theme = typeof light;
export type ThemePref = 'system' | 'light' | 'dark';

/** Android'da shrift fayl nomi bilan ro'yxatga olinadi (expo-font config plugin) */
export const font = {
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 28 };

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
