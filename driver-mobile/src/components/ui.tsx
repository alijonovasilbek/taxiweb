import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { font, radius, useTheme } from '../theme';

/**
 * Chortoq dizayni: chiziqli (kontur) ikonkalar; tanlangan holatda — to'la.
 * Ionicons; yuk mashinasi va ekskavator MaterialCommunityIcons'dan. [to'plam, to'la, kontur, burilish]
 * (driver-mobile/src/components/ui.tsx bilan bir xil fayl)
 */
type Glyph = readonly ['ion' | 'mci', string, string, number?];
const ICONS: Record<string, Glyph> = {
  home: ['ion', 'home', 'home-outline'],
  taxi: ['ion', 'car-sport', 'car-sport-outline'],
  carpool: ['ion', 'people', 'people-outline'],
  requests: ['ion', 'reader', 'reader-outline'],
  orders: ['ion', 'document-text', 'document-text-outline'],
  doc: ['ion', 'document-text', 'document-text-outline'],
  vehicles: ['ion', 'car', 'car-outline'],
  profile: ['ion', 'person', 'person-outline'],
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
  chat: ['ion', 'chatbubble', 'chatbubble-outline'],
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
  chart: ['ion', 'bar-chart', 'bar-chart-outline'],
  sliders: ['ion', 'options', 'options-outline'],
  menu: ['ion', 'menu', 'menu'],
  plane: ['ion', 'airplane', 'airplane-outline'],
  sparkles: ['ion', 'sparkles', 'sparkles-outline'],
};
export type IconName = keyof typeof ICONS;

/** Ikonka shriftlari — splash yopilishidan oldin yuklanadi (aks holda bir lahza bo'sh joy ko'rinadi) */
export const ICON_FONTS = { ...Ionicons.font, ...MaterialCommunityIcons.font };

/** Standart — kontur (dizayndagidek); `filled` — to'la variant (tanlangan menyu bandi, yulduz va h.k.) */
export function Icon({ n, size = 20, color, filled }: { n: string; size?: number; color?: string; stroke?: number; filled?: boolean }) {
  const t = useTheme();
  const [set, full, line, rotate] = ICONS[n] ?? (['ion', 'ellipse', 'ellipse-outline'] as const);
  const name = filled ? full : line;
  const c = color ?? t.text;
  const glyph = set === 'mci'
    ? <MaterialCommunityIcons name={name as any} size={size} color={c} />
    : <Ionicons name={name as any} size={size} color={c} />;
  return rotate ? <View style={{ transform: [{ rotate: `${rotate}deg` }] }}>{glyph}</View> : glyph;
}

/** Rangli kvadrat ichidagi ikonka (dizayndagi xizmat/qator ikonkalari) */
export function IconTile({ n, bg, color, size = 40, iconSize, round }: {
  n: string; bg?: string; color?: string; size?: number; iconSize?: number; round?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size / 2 : size * 0.3, backgroundColor: bg ?? t.fill,
      alignItems: 'center', justifyContent: 'center' }}>
      <Icon n={n} size={iconSize ?? Math.round(size * 0.5)} color={color ?? t.text} />
    </View>
  );
}

type TextKind = 'title' | 'h2' | 'body' | 'muted' | 'small' | 'label';

export function T({ kind = 'body', style, children, numberOfLines, color }: {
  kind?: TextKind; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; color?: string;
}) {
  const t = useTheme();
  const base: Record<TextKind, TextStyle> = {
    title: { fontFamily: font.heavy, fontSize: 26, color: t.text, letterSpacing: -0.5 },
    h2: { fontFamily: font.heavy, fontSize: 18, color: t.text, letterSpacing: -0.2 },
    body: { fontFamily: font.medium, fontSize: 15, color: t.text, lineHeight: 21 },
    muted: { fontFamily: font.medium, fontSize: 14, color: t.muted, lineHeight: 20 },
    small: { fontFamily: font.medium, fontSize: 13, color: t.muted },
    label: { fontFamily: font.bold, fontSize: 12, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
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
  const inner = padded ? { padding: 16, paddingTop: 20, paddingBottom: 32, gap: 12 } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} refreshControl={refresh as any} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
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
  const body = [{ backgroundColor: t.card, borderRadius: radius.lg, padding: 16, gap: 8, borderWidth: 1, borderColor: t.lineSoft }, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [body, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark';

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style }: {
  title: string; onPress?: () => void; kind?: BtnKind; loading?: boolean; disabled?: boolean; icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.card, danger: t.redSoft, ghost: 'transparent', dark: t.ink }[kind];
  const fg = { primary: t.onPrimary, secondary: t.text, danger: t.redInk, ghost: t.primary, dark: t.onInk }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        s.btn, { backgroundColor: off && kind === 'primary' ? t.fill : bg },
        kind === 'secondary' && { borderWidth: 1, borderColor: t.line },
        pressed && !off && { opacity: 0.8 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? t.muted : fg} />
      ) : (
        <>
          {icon ? <Icon n={icon} size={20} color={off && kind === 'primary' ? t.faint : fg} /> : null}
          <Text style={[s.btnText, { color: off && kind === 'primary' ? t.faint : fg }, kind === 'primary' && { fontFamily: font.heavy }]}>{title}</Text>
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
      {icon ? <IconTile n={icon} bg={tint ?? t.fill} color={tint ? '#fff' : t.text} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: t.text }}>{title}</Text>
        {subtitle ? <T kind="small">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon n="next" size={18} color={t.muted} /> : null)}
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
    <View style={{ backgroundColor: c[0], borderRadius: 13, height: 26, paddingHorizontal: 10, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ color: c[1], fontFamily: font.bold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export function Empty({ icon = 'work', title, text }: { icon?: string; title: string; text?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 }}>
      <IconTile n={icon} size={64} round bg={t.primarySoft} color={t.primary} iconSize={28} />
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

/** Xarita ustidagi oq doira tugma (orqaga, joylashuvim, profil) */
export function MapFab({ icon, onPress, color, style }: { icon: string; onPress?: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [s.fab, { backgroundColor: t.card, shadowColor: '#000' }, pressed && { opacity: 0.8 }, style]}>
      <Icon n={icon} size={22} color={color ?? t.text} />
    </Pressable>
  );
}

/** Pastki varaqning tutqichi */
export function Grabber() {
  const t = useTheme();
  return <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.grabber, marginBottom: 4 }} />;
}

/** Yo'nalish: oq doira (qayerdan) — chiziq — qora kvadrat (qayerga) */
export function RouteCard({ from, to, fromSub, toSub, right, style }: {
  from: string; to?: string | null; fromSub?: string; toSub?: string; right?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', gap: 12, padding: 14, backgroundColor: t.fill, borderRadius: 18 }, style]}>
      <View style={{ alignItems: 'center', paddingTop: 5, gap: 3 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 3, borderColor: t.ink, backgroundColor: t.card }} />
        {to ? <View style={{ width: 2, flex: 1, backgroundColor: t.grabber }} /> : null}
        {to ? <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: t.ink }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: t.text }}>{from}</Text>
          {fromSub ? <T kind="small">{fromSub}</T> : null}
        </View>
        {to ? (
          <View style={{ gap: 2 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: t.text }}>{to}</Text>
            {toSub ? <T kind="small">{toSub}</T> : null}
          </View>
        ) : null}
      </View>
      {right ? <View style={{ alignSelf: 'center' }}>{right}</View> : null}
    </View>
  );
}

/** O'zbek davlat raqami ko'rinishi: "01 | A 777 AA" */
export function Plate({ number }: { number?: string | null }) {
  const t = useTheme();
  const raw = (number || '').replace(/\s+/g, '').toUpperCase();
  if (!raw) return null;
  const m = raw.match(/^(\d{2})(.+)$/);
  const region = m ? m[1] : '';
  const rest = (m ? m[2] : raw).replace(/^([A-Z])(\d{3})([A-Z]{2})$/, '$1 $2 $3').replace(/^(\d{3})([A-Z]{3})$/, '$1 $2');
  return (
    <View style={{ flexDirection: 'row', height: 40, borderWidth: 2, borderColor: t.ink, borderRadius: 8, overflow: 'hidden' }}>
      {region ? (
        <View style={{ paddingHorizontal: 8, justifyContent: 'center', borderRightWidth: 2, borderRightColor: t.ink }}>
          <Text style={[s.plate, { color: t.text }]}>{region}</Text>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 10, justifyContent: 'center' }}><Text style={[s.plate, { color: t.text }]}>{rest}</Text></View>
    </View>
  );
}

/** Ism bosh harfi bilan doira (haydovchi/yo'lovchi) */
export function Avatar({ name, size = 52 }: { name?: string | null; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.onPrimary, fontFamily: font.heavy, fontSize: size * 0.36 }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnText: { fontFamily: font.bold, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  fab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  plate: { fontFamily: font.heavy, fontSize: 17, letterSpacing: 0.4 },
});

/** Ichki ekranlar uchun sarlavha: "‹" doira tugma + nom */
export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={onBack} hitSlop={12} style={{ alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22, backgroundColor: t.card,
        borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
        <Icon n="back" size={22} />
      </Pressable>
      <T kind="title">{title}</T>
    </View>
  );
}
