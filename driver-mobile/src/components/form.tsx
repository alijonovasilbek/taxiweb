import type { ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { font, radius, useTheme } from '../theme';
import { T } from './ui';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T kind="label">{label}</T>
      {children}
      {hint ? <T kind="small">{hint}</T> : null}
    </View>
  );
}

export function Input({ value, onChangeText, placeholder, keyboardType, multiline, maxLength }: {
  value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: KeyboardTypeOptions;
  multiline?: boolean; maxLength?: number;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.faint}
      keyboardType={keyboardType}
      multiline={multiline}
      maxLength={maxLength}
      style={{
        backgroundColor: t.card, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
        color: t.text, fontFamily: font.medium, fontSize: 16, minHeight: multiline ? 80 : 50,
        textAlignVertical: multiline ? 'top' : 'center', borderWidth: 1, borderColor: t.line,
      }}
    />
  );
}

/** Gorizontal tanlov "chip"lari */
export function Chips<V extends string | number>({ items, value, onChange }: {
  items: { value: V; label: string }[]; value: V | null; onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <Pressable
            key={String(it.value)}
            onPress={() => onChange(it.value)}
            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: on ? t.primary : t.card, borderWidth: 1, borderColor: on ? t.primary : t.line }}
          >
            <T style={{ fontFamily: font.semibold, color: on ? t.onPrimary : t.text }}>{it.label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Stepper({ value, onChange, min = 1, max = 50 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const t = useTheme();
  const btn = (label: string, next: number, off: boolean) => (
    <Pressable
      onPress={() => !off && onChange(next)}
      style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: off ? t.fill : t.primarySoft }}
    >
      <T style={{ fontFamily: font.heavy, fontSize: 22, color: off ? t.faint : t.primary }}>{label}</T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {btn('−', value - 1, value <= min)}
      <T style={{ fontFamily: font.heavy, fontSize: 22, minWidth: 30, textAlign: 'center' }}>{value}</T>
      {btn('+', value + 1, value >= max)}
    </View>
  );
}
