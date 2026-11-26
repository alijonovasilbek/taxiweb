import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../api/client';
import { font, radius, useTheme } from '../theme';
import { Button, Icon, T } from './ui';

export type Place = { address: string; lat: number; lng: number };
type Suggest = { title: string; subtitle?: string; address?: string; lat?: number; lng?: number; uri?: string; popular?: boolean };

// Chortoq markazi — joylashuv noma'lum bo'lsa qidiruv shu atrofda
const DEFAULT_BIAS = { lat: 41.069, lng: 71.823 };

async function resolve(item: Suggest, bias: { lat: number; lng: number }): Promise<Place | null> {
  if (item.lat && item.lng) return { lat: item.lat, lng: item.lng, address: item.address || item.title };
  const query = item.uri ? { uri: item.uri } : { address: [item.title, item.subtitle].filter(Boolean).join(', '), ...bias };
  const found = await api<{ lat: number; lng: number; address?: string; title?: string }[]>('/maps/geocode', { query });
  if (!found.length) return null;
  return { lat: found[0].lat, lng: found[0].lng, address: item.title || found[0].address || '' };
}

/** Joy tanlash: nom yoki manzil yoziladi → Yandex Geosuggest (backend /maps/suggest) → tanlanadi */
export function PlacePicker({ label, value, onChange }: { label: string; value: Place | null; onChange: (p: Place) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ backgroundColor: t.card, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: t.line }}
      >
        <Icon n="pin" size={20} color={t.primary} />
        <View style={{ flex: 1 }}>
          <T kind="small">{label}</T>
          <T numberOfLines={1} color={value ? t.text : t.faint}>{value?.address ?? 'Tanlang'}</T>
        </View>
      </Pressable>
      {open ? <SearchModal onClose={() => setOpen(false)} onPick={(p) => { onChange(p); setOpen(false); }} /> : null}
    </>
  );
}

function SearchModal({ onClose, onPick }: { onClose: () => void; onPick: (p: Place) => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [items, setItems] = useState<Suggest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bias = useRef(DEFAULT_BIAS);
  const seq = useRef(0);

  useEffect(() => {
    void Location.getLastKnownPositionAsync()
      .then((p) => {
        if (p) bias.current = { lat: p.coords.latitude, lng: p.coords.longitude };
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    const my = ++seq.current;
    const id = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await api<Suggest[]>('/maps/suggest', { method: 'POST', body: { text: q, ...bias.current } });
        if (my === seq.current) {
          setItems(res);
          setError(null);
        }
      } catch (e) {
        if (my === seq.current) setError(e instanceof Error ? e.message : 'Xatolik');
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [text]);

  const pick = async (it: Suggest) => {
    setBusy(true);
    try {
      const p = await resolve(it, bias.current);
      if (p) onPick(p);
      else setError('Bu joyning koordinatasi topilmadi, boshqasini tanlang');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  const current = async () => {
    setBusy(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { lat, lng } = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const r = await api<{ address?: string; title?: string }>('/maps/reverse-geocode', { query: { lat, lng } });
      onPick({ lat, lng, address: r.title || r.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Joylashuvni aniqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="Joy nomi yoki manzil"
            placeholderTextColor={t.faint}
            style={{ flex: 1, backgroundColor: t.card, borderRadius: radius.md, paddingHorizontal: 14, height: 50, color: t.text, fontFamily: font.medium, fontSize: 16 }}
          />
          <Button title="Yopish" kind="ghost" onPress={onClose} />
        </View>
        <Button title="Hozirgi joylashuvim" kind="secondary" icon="pin" onPress={current} />
        {busy ? <ActivityIndicator color={t.primary} /> : null}
        {error ? <T color={t.redInk}>{error}</T> : null}
        <FlatList
          data={text.trim().length >= 2 ? items : []}
          keyExtractor={(it, i) => `${it.title}-${i}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => pick(item)} style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line, opacity: pressed ? 0.6 : 1 })}>
              <T>{item.popular ? '⭐️ ' : ''}{item.title}</T>
              {item.subtitle ? <T kind="small">{item.subtitle}</T> : null}
            </Pressable>
          )}
          ListEmptyComponent={text.trim().length >= 2 && !busy ? <T kind="muted">Hech narsa topilmadi</T> : undefined}
        />
      </SafeAreaView>
    </Modal>
  );
}
