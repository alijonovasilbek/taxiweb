/**
 * Buyurtmani bekor qilish: sababni tanlash (analitika uchun backend'ga kod bilan boradi).
 * "Boshqa sabab" tanlansa — qisqa izoh. Sabablar ro'yxati serverdan (GET /orders/cancel-reasons), bo'lmasa — zaxira ro'yxat.
 * (driver-mobile/src/components/CancelSheet.tsx bilan bir xil fayl)
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../api/client';
import { font, useTheme } from '../theme';
import { Button, ErrorNote, Grabber } from './ui';

type Role = 'passenger' | 'driver';
type Reason = { code: string; label: string };

const FALLBACK: Record<Role, Reason[]> = {
  passenger: [
    { code: 'wait_long', label: 'Haydovchi juda uzoq' },
    { code: 'changed_mind', label: "Rejam o'zgardi" },
    { code: 'wrong_address', label: "Manzilni noto'g'ri kiritdim" },
    { code: 'driver_asked', label: "Haydovchi bekor qilishni so'radi" },
    { code: 'found_other', label: 'Boshqa transport topdim' },
    { code: 'other', label: 'Boshqa sabab' },
  ],
  driver: [
    { code: 'passenger_no_show', label: "Yo'lovchi chiqmadi" },
    { code: 'passenger_asked', label: "Yo'lovchi bekor qilishni so'radi" },
    { code: 'far_pickup', label: 'Olib ketish joyi juda uzoq' },
    { code: 'car_problem', label: 'Mashinada nosozlik' },
    { code: 'other', label: 'Boshqa sabab' },
  ],
};

export function CancelSheet({ role, visible, onClose, onConfirm, note }: {
  role: Role;
  visible: boolean;
  onClose: () => void;
  /** reason_code va (ixtiyoriy) izoh — chaqiruvchi PUT /orders/{id}/cancel yuboradi */
  onConfirm: (code: string, text: string | null) => Promise<void>;
  note?: string;
}) {
  const t = useTheme();
  const reasons = useQuery({
    queryKey: ['cancel-reasons', role],
    queryFn: () => api<Reason[]>('/orders/cancel-reasons', { query: { role } }),
    staleTime: 3_600_000,
    enabled: visible,
  });
  const list = reasons.data?.length ? reasons.data : FALLBACK[role];
  const [code, setCode] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(code, code === 'other' ? text.trim() || null : null);
      setCode(null);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bekor qilib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: t.sheet }]}>
          <Grabber />
          <Text style={[s.title, { color: t.text }]}>Nega bekor qilyapsiz?</Text>
          {note ? <Text style={[s.note, { color: t.muted }]}>{note}</Text> : null}
          <View style={{ gap: 8 }}>
            {list.map((r) => {
              const on = r.code === code;
              return (
                <Pressable key={r.code} onPress={() => setCode(r.code)} accessibilityState={{ selected: on }}
                  style={[s.row, { borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primarySoft : t.card }]}>
                  <View style={[s.radio, { borderColor: on ? t.primary : t.grabber }]}>
                    {on ? <View style={[s.dot, { backgroundColor: t.primary }]} /> : null}
                  </View>
                  <Text style={[s.label, { color: t.text }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {code === 'other' ? (
            <TextInput value={text} onChangeText={setText} placeholder="Qisqacha yozing (ixtiyoriy)" placeholderTextColor={t.faint}
              maxLength={200} style={[s.input, { backgroundColor: t.fill, color: t.text }]} />
          ) : null}
          <ErrorNote error={error} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Ortga" kind="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Bekor qilish" kind="danger" disabled={!code} loading={busy} onPress={confirm} style={{ flex: 1.4 }} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, gap: 14 },
  title: { fontFamily: font.heavy, fontSize: 22, letterSpacing: -0.4 },
  note: { fontFamily: font.medium, fontSize: 14, marginTop: -6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: font.semibold, fontSize: 15, flex: 1 },
  input: { height: 48, borderRadius: 14, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 15 },
});
