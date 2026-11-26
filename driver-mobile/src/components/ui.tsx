import {
  BriefcaseBusiness, Car, CarTaxiFront, Check, ChevronRight, Circle, ClipboardList, House, MapPin, Moon, Sun,
  Truck, UserRound, Users, Bell, BatteryCharging, ShieldCheck, LogOut, Smartphone, RefreshCw, Send, Construction,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { font, radius, useTheme } from '../theme';

const ICONS: Record<string, LucideIcon> = {
  home: House, taxi: CarTaxiFront, carpool: Users, requests: ClipboardList, vehicles: Car, profile: UserRound,
  next: ChevronRight, check: Check, pin: MapPin, sun: Sun, moon: Moon, bell: Bell, battery: BatteryCharging,
  shield: ShieldCheck, logout: LogOut, phone: Smartphone, refresh: RefreshCw, send: Send, truck: Truck,
  work: BriefcaseBusiness, equipment: Construction,
};

export type IconName = keyof typeof ICONS;

export function Icon({ n, size = 20, color, stroke = 2 }: { n: string; size?: number; color?: string; stroke?: number }) {
  const t = useTheme();
  const C = ICONS[n] ?? Circle;
  return <C size={size} color={color ?? t.text} strokeWidth={stroke} />;
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
      {icon ? (
        <View style={[s.rowIcon, { backgroundColor: tint ?? t.primarySoft }]}>
          <Icon n={icon} size={18} color={tint ? '#fff' : t.primary} />
        </View>
      ) : null}
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
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={[s.emptyIcon, { backgroundColor: t.primarySoft }]}>
        <Icon n={icon} size={30} color={t.primary} />
      </View>
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
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
