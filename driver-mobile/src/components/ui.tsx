import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { font, radius, useTheme } from '../theme';

/**
 * iOS uslubidagi ikonkalar (Ionicons — SF Symbols'ga o'xshash to'la/kontur juftliklari).
 * Ionicons'da yuk mashinasi va ekskavator yo'q — ular MaterialCommunityIcons'dan (shakli mos).
 * [to'plam, to'la, kontur, burilish]
 */
type Glyph = readonly ['ion' | 'mci', string, string, number?];
const ICONS: Record<string, Glyph> = {
  home: ['ion', 'home', 'home-outline'],
  taxi: ['ion', 'car-sport', 'car-sport-outline'],
  carpool: ['ion', 'people', 'people-outline'],
  requests: ['ion', 'reader', 'reader-outline'],
  orders: ['ion', 'receipt', 'receipt-outline'],
  vehicles: ['ion', 'car', 'car-outline'],
  profile: ['ion', 'person-circle', 'person-circle-outline'],
  next: ['ion', 'chevron-forward', 'chevron-forward'],
  back: ['ion', 'chevron-back', 'chevron-back'],
  chevDown: ['ion', 'chevron-down', 'chevron-down'],
  check: ['ion', 'checkmark', 'checkmark'],
  pin: ['ion', 'location', 'location-outline'],
  sun: ['ion', 'sunny', 'sunny-outline'],
  moon: ['ion', 'moon', 'moon-outline'],
  bell: ['ion', 'notifications', 'notifications-outline'],
  battery: ['ion', 'battery-charging', 'battery-charging-outline'],
  shield: ['ion', 'shield-checkmark', 'shield-checkmark-outline'],
  logout: ['ion', 'log-out', 'log-out-outline'],
  phone: ['ion', 'phone-portrait', 'phone-portrait-outline'],
  refresh: ['ion', 'refresh', 'refresh'],
  send: ['ion', 'paper-plane', 'paper-plane-outline'],
  truck: ['mci', 'truck', 'truck-outline'],
  work: ['ion', 'briefcase', 'briefcase-outline'],
  briefcase: ['ion', 'briefcase', 'briefcase-outline'],
  equipment: ['mci', 'excavator', 'excavator'],
  call: ['ion', 'call', 'call-outline'],
  star: ['ion', 'star', 'star-outline'],
  close: ['ion', 'close', 'close'],
  search: ['ion', 'search', 'search'],
  nav: ['ion', 'navigate', 'navigate-outline'],
  clock: ['ion', 'time', 'time-outline'],
  history: ['ion', 'time', 'time-outline'],
  cash: ['ion', 'cash', 'cash-outline'],
  card: ['ion', 'card', 'card-outline'],
  locate: ['ion', 'locate', 'locate-outline'],
  repeat: ['ion', 'repeat', 'repeat'],
  plus: ['ion', 'add', 'add'],
  download: ['ion', 'download', 'download-outline'],
  arrowUR: ['ion', 'arrow-forward', 'arrow-forward', -45],
  map: ['ion', 'map', 'map-outline'],
  sparkles: ['ion', 'sparkles', 'sparkles-outline'],
};
export type IconName = keyof typeof ICONS;

/** Ikonka shriftlari — splash yopilishidan oldin yuklanadi (aks holda bir lahza bo'sh joy ko'rinadi) */
export const ICON_FONTS = { ...Ionicons.font, ...MaterialCommunityIcons.font };

/** `outline` — kontur varianti (masalan, tanlanmagan menyu bandi). `stroke` eski API uchun qoldirilgan. */
export function Icon({ n, size = 20, color, outline }: { n: string; size?: number; color?: string; stroke?: number; outline?: boolean }) {
  const t = useTheme();
  const [set, filled, line, rotate] = ICONS[n] ?? (['ion', 'ellipse', 'ellipse-outline'] as const);
  const name = outline ? line : filled;
  const c = color ?? t.text;
  const glyph = set === 'mci'
    ? <MaterialCommunityIcons name={name as any} size={size} color={c} />
    : <Ionicons name={name as any} size={size} color={c} />;
  return rotate ? <View style={{ transform: [{ rotate: `${rotate}deg` }] }}>{glyph}</View> : glyph;
}

/**
 * "Liquid glass" yuzasi: shaffof fon + yuqoridan tushgan yorug'lik (gradient) + yorug' chekka.
 * Haqiqiy blur ishlatilmaydi — Android 7–11 va arzon telefonlarda sekinlashtiradi; ko'rinishi baribir shishaga o'xshaydi.
 */
export function Glass({ children, style, rounded = 24, strong, onColor }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; rounded?: number; strong?: boolean;
  /** rangli fon (bordo sarlavha, sariq karta) ustidagi oq shisha */
  onColor?: boolean;
}) {
  const t = useTheme();
  const bg = onColor ? 'rgba(255,255,255,0.16)' : strong ? t.glassStrong : t.glass;
  return (
    <View style={[{ borderRadius: rounded, backgroundColor: bg, borderColor: onColor ? 'rgba(255,255,255,0.38)' : t.glassEdge,
      borderWidth: 1, overflow: 'hidden' }, style]}>
      <LinearGradient pointerEvents="none" colors={onColor ? ON_COLOR_SHEEN : t.glassSheen} locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const ON_COLOR_SHEEN = ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.1)'] as const;

/** Rangli shisha "tabletka" ichidagi ikonka (iOS Sozlamalar uslubi) */
export function GlassIcon({ n, size = 36, color, ink = '#fff', iconSize }: {
  n: string; size?: number; color?: string; ink?: string; iconSize?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color ?? t.primary,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.08)']}
        locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: size * 0.18, right: size * 0.18, height: 1,
        backgroundColor: 'rgba(255,255,255,0.75)' }} />
      <Icon n={n} size={iconSize ?? Math.round(size * 0.55)} color={ink} />
    </View>
  );
}

type TextKind = 'title' | 'h2' | 'body' | 'muted' | 'small' | 'label';

export function T({ kind = 'body', style, children, numberOfLines, color }: {
  kind?: TextKind; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; color?: string;
}) {
  const t = useTheme();
  const base: Record<TextKind, TextStyle> = {
    title: { fontFamily: font.heavy, fontSize: 28, color: t.text, letterSpacing: -0.4 },
    h2: { fontFamily: font.bold, fontSize: 18, color: t.text },
    body: { fontFamily: font.medium, fontSize: 15, color: t.text, lineHeight: 21 },
    muted: { fontFamily: font.medium, fontSize: 14, color: t.muted, lineHeight: 20 },
    small: { fontFamily: font.semibold, fontSize: 12, color: t.muted },
    label: { fontFamily: font.bold, fontSize: 13, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  };
  return (
    <Text style={[base[kind], color ? { color } : null, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true, edges = ['top'], padded = true, refresh }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean; refresh?: ReactNode;
}) {
  const t = useTheme();
  const inner = padded ? { padding: 16, paddingBottom: 32, gap: 12 } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} refreshControl={refresh as any} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const body = [{ backgroundColor: t.card, borderRadius: radius.lg, padding: 16, gap: 8 }, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [body, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style }: {
  title: string; onPress?: () => void; kind?: BtnKind; loading?: boolean; disabled?: boolean; icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.fill, danger: t.redSoft, ghost: 'transparent' }[kind];
  const fg = { primary: t.onPrimary, secondary: t.text, danger: t.redInk, ghost: t.primary }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        s.btn, { backgroundColor: off && kind === 'primary' ? t.fill : bg }, pressed && !off && { opacity: 0.75 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? t.muted : fg} />
      ) : (
        <>
          {icon ? <Icon n={icon} size={19} color={off && kind === 'primary' ? t.faint : fg} /> : null}
          <Text style={[s.btnText, { color: off && kind === 'primary' ? t.faint : fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Ro'yxat qatori: ikonka · sarlavha/izoh · o'ng tomonda qiymat yoki strelka */
export function Row({ icon, title, subtitle, right, onPress, tint }: {
  icon?: string; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; tint?: string;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
      {icon ? <GlassIcon n={icon} size={34} color={tint ?? t.primary} iconSize={18} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T>{title}</T>
        {subtitle ? <T kind="small">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon n="next" size={18} color={t.faint} /> : null)}
    </Pressable>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'green' | 'orange' | 'red' | 'brand' }) {
  const t = useTheme();
  const c = {
    neutral: [t.fill, t.muted], green: [t.greenSoft, t.greenInk], orange: [t.orangeSoft, t.orangeInk],
    red: [t.redSoft, t.redInk], brand: [t.primarySoft, t.primary],
  }[tone];
  return (
    <View style={{ backgroundColor: c[0], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: c[1], fontFamily: font.bold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export function Empty({ icon = 'work', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 }}>
      <GlassIcon n={icon} size={68} iconSize={32} />
      <T kind="h2" style={{ textAlign: 'center' }}>{title}</T>
      {text ? <T kind="muted" style={{ textAlign: 'center' }}>{text}</T> : null}
    </View>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const t = useTheme();
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <View style={{ backgroundColor: t.redSoft, borderRadius: radius.md, padding: 12 }}>
      <T color={t.redInk}>{msg}</T>
    </View>
  );
}

export const money = (v: number | string | null | undefined) =>
  `${Math.round(Number(v ?? 0)).toLocaleString('ru-RU').replace(/,/g, ' ')} so'm`;

const s = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnText: { fontFamily: font.bold, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});

/** Ichki ekranlar uchun sarlavha: "‹ Orqaga" + nom */
export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={onBack} hitSlop={12} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon n="next" size={20} color={t.primary} />
        </View>
        <Text style={{ color: t.primary, fontFamily: font.semibold, fontSize: 16 }}>Orqaga</Text>
      </Pressable>
      <T kind="title">{title}</T>
    </View>
  );
}
