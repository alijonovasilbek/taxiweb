/**
 * Manzil tanlash: qidiruv (Yandex Geosuggest + mashhur joylar), "Xaritadan tanlash", hozirgi joylashuv,
 * saqlangan (Uy/Ish) va oxirgi manzillar. Hamma ekranlarda bir xil: taksi, po'puti, yuk/texnika, manzillarim.
 */
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/client';
import { recentPlaces, useMe, useRides } from '../api/hooks';
import { DEFAULT_CENTER } from '../config';
import { font, radius, useTheme } from '../theme';
import { MapView, type LatLng, type MapHandle } from './MapView';
import { Icon, T } from './ui';

export type Place = { address: string; lat: number; lng: number };
type Suggest = { title: string; subtitle?: string; address?: string; lat?: number; lng?: number; uri?: string; popular?: boolean; distance_km?: number | null };

async function resolve(item: Suggest, bias: LatLng): Promise<Place | null> {
  if (item.lat && item.lng) return { lat: item.lat, lng: item.lng, address: item.address || item.title };
  const query = item.uri ? { uri: item.uri } : { address: [item.title, item.subtitle].filter(Boolean).join(', '), ...bias };
  const found = await api<{ lat: number; lng: number; address?: string; title?: string }[]>('/maps/geocode', { query });
  if (!found.length) return null;
  return { lat: found[0].lat, lng: found[0].lng, address: item.title || found[0].address || '' };
}

async function addressOf(p: LatLng): Promise<string> {
  try {
    const r = await api<{ address?: string | null; title?: string | null }>('/maps/reverse-geocode', { query: p });
    return r.title || r.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  } catch {
    return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }
}

/** Ruxsat so'rab joriy joylashuv (oxirgi ma'lum — tez, bo'lmasa aniq) */
export async function myLocation(): Promise<LatLng | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync();
  if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
  const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: cur.coords.latitude, lng: cur.coords.longitude };
}

/** Formadagi maydon: bosilganda qidiruv oynasi */
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
      {open ? <PlaceSearch title={label} initial={value} onClose={() => setOpen(false)} onPick={(p) => { onChange(p); setOpen(false); }} /> : null}
    </>
  );
}

/**
 * Qidiruv oynasi. `onMap` berilsa — "Xaritadan tanlash" shu funksiyani chaqiradi (taksi ekrani o'z xaritasida pin bilan
 * tanlatadi); berilmasa — ichki to'liq ekranli xarita oynasi ochiladi.
 */
export function PlaceSearch({ title, initial, onClose, onPick, onMap }: {
  title?: string; initial?: LatLng | null; onClose: () => void; onPick: (p: Place) => void; onMap?: () => void;
}) {
  const t = useTheme();
  const me = useMe();
  const rides = useRides();
  const [text, setText] = useState('');
  const [items, setItems] = useState<Suggest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const bias = useRef<LatLng>(DEFAULT_CENTER);
  const [here, setHere] = useState<LatLng | null>(null);
  const seq = useRef(0);
  const q = text.trim();

  useEffect(() => {
    void Location.getLastKnownPositionAsync()
      .then((p) => {
        if (!p) return;
        bias.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setHere(bias.current);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
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
        if (my === seq.current) setError(e instanceof Error ? e.message : 'Qidiruv ishlamadi');
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const run = async (fn: () => Promise<Place | null>, fail: string) => {
    setBusy(true);
    setError(null);
    try {
      const p = await fn();
      if (p) onPick(p);
      else setError(fail);
    } catch (e) {
      setError(e instanceof Error ? e.message : fail);
    } finally {
      setBusy(false);
    }
  };

  const current = () => run(async () => {
    const p = await myLocation();
    return p ? { ...p, address: await addressOf(p) } : null;
  }, "Joylashuvni aniqlab bo'lmadi. GPS va ruxsatni tekshiring.");

  const saved = me.data?.saved_places ?? {};
  const quick: { icon: string; title: string; subtitle?: string; onPress: () => void }[] = [
    { icon: 'map', title: 'Xaritadan tanlash', subtitle: 'Xaritani surib, pin bilan belgilang', onPress: () => (onMap ? onMap() : setMapOpen(true)) },
    { icon: 'nav', title: 'Hozirgi joylashuvim', onPress: () => void current() },
    ...(saved.home ? [{ icon: 'home', title: 'Uy', subtitle: saved.home.address, onPress: () => onPick(saved.home!) }] : []),
    ...(saved.work ? [{ icon: 'briefcase', title: 'Ish', subtitle: saved.work.address, onPress: () => onPick(saved.work!) }] : []),
    ...recentPlaces(rides.data, 5).map((p) => ({ icon: 'history', title: p.address, onPress: () => onPick(p) })),
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.sheet }}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={10} style={s.headBtn}><Icon n="back" size={22} /></Pressable>
          <View style={[s.input, { backgroundColor: t.fill }]}>
            <Icon n="search" size={18} color={t.muted} />
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder={title ? `${title}: joy nomi yoki manzil` : 'Joy nomi yoki manzil'}
              placeholderTextColor={t.faint}
              style={{ flex: 1, height: 48, color: t.text, fontFamily: font.medium, fontSize: 16 }}
            />
            {text ? <Pressable onPress={() => setText('')} hitSlop={8}><Icon n="close" size={18} color={t.muted} /></Pressable> : null}
          </View>
        </View>
        {busy ? <ActivityIndicator color={t.primary} style={{ marginVertical: 6 }} /> : null}
        {error ? <View style={{ paddingHorizontal: 16 }}><T color={t.redInk}>{error}</T></View> : null}
        <FlatList
          data={q.length >= 2 ? items : []}
          keyExtractor={(it, i) => `${it.title}-${i}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListHeaderComponent={q.length < 2 ? (
            <View>
              {quick.map((r) => <Row key={`${r.icon}-${r.title}`} {...r} />)}
            </View>
          ) : <Row icon="map" title="Xaritadan tanlash" subtitle="Topilmasa — xaritada belgilang" onPress={() => (onMap ? onMap() : setMapOpen(true))} />}
          renderItem={({ item }) => (
            <Row icon={item.popular ? 'star' : 'pin'} title={item.title} subtitle={item.subtitle}
              right={item.distance_km ? `${item.distance_km} km` : undefined}
              onPress={() => void run(() => resolve(item, bias.current), 'Bu joyning koordinatasi topilmadi, boshqasini tanlang')} />
          )}
          ListEmptyComponent={q.length >= 2 && !busy ? <T kind="muted" style={{ paddingVertical: 12 }}>Hech narsa topilmadi — xaritadan tanlang</T> : undefined}
        />
      </SafeAreaView>
      {mapOpen ? (
        <MapPick title={title} initial={initial ?? here ?? DEFAULT_CENTER} onClose={() => setMapOpen(false)}
          onPick={(p) => { setMapOpen(false); onPick(p); }} />
      ) : null}
    </Modal>
  );
}

function Row({ icon, title, subtitle, right, onPress }: { icon: string; title: string; subtitle?: string; right?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, { borderBottomColor: t.line }, pressed && { opacity: 0.6 }]}>
      <View style={[s.rowIc, { backgroundColor: t.fill }]}><Icon n={icon} size={18} color={icon === 'map' ? t.primary : t.text} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: icon === 'map' ? t.primary : t.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[s.rowSub, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={[s.rowSub, { color: t.muted }]}>{right}</Text> : null}
    </Pressable>
  );
}

/** To'liq ekranli xarita: markazdagi pin ostidagi manzil tanlanadi */
export function MapPick({ title, initial, onClose, onPick }: { title?: string; initial: LatLng; onClose: () => void; onPick: (p: Place) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapHandle>(null);
  const [pin, setPin] = useState<{ p: LatLng; address: string | null } | null>(null);
  const [moving, setMoving] = useState(false);
  const seq = useRef(0);

  const onCenter = async (p: LatLng) => {
    setMoving(false);
    const my = ++seq.current;
    setPin({ p, address: null });
    const a = await addressOf(p);
    if (my === seq.current) setPin({ p, address: a });
  };

  const locate = async () => {
    const p = await myLocation().catch(() => null);
    if (p) map.current?.center(p, 17);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <MapView ref={map} initial={initial} onCenter={onCenter} onMoveStart={() => setMoving(true)} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ alignItems: 'center', transform: [{ translateY: moving ? -32 : -24 }] }}>
            <View style={[s.pinHead, { backgroundColor: t.primary }]}><View style={s.pinDot} /></View>
            <View style={[s.pinLeg, { backgroundColor: t.primary }]} />
          </View>
        </View>
        <SafeAreaView edges={['top']} style={s.mapTop} pointerEvents="box-none">
          <Pressable onPress={onClose} style={[s.fab, { backgroundColor: t.card }]}><Icon n="back" size={22} /></Pressable>
          <View style={[s.mapTitle, { backgroundColor: t.card }]}><Text style={[s.rowTitle, { color: t.text }]}>{title || 'Manzil'}: xaritani suring</Text></View>
        </SafeAreaView>
        <Pressable onPress={() => void locate()} style={[s.fab, { position: 'absolute', right: 14, bottom: 170 + insets.bottom, backgroundColor: t.card }]}>
          <Icon n="nav" size={20} color={t.primary} />
        </Pressable>
        <View style={[s.mapSheet, { backgroundColor: t.sheet, paddingBottom: 16 + insets.bottom }]}>
          <View style={[s.addr, { backgroundColor: t.fill }]}>
            <Icon n="pin" size={19} color={t.primary} />
            {!pin?.address || moving ? <ActivityIndicator size="small" color={t.primary} /> : (
              <Text numberOfLines={2} style={[s.rowTitle, { color: t.text, flex: 1 }]}>{pin.address}</Text>
            )}
          </View>
          <Pressable
            disabled={!pin?.address || moving}
            onPress={() => pin?.address && onPick({ ...pin.p, address: pin.address })}
            style={[s.big, { backgroundColor: !pin?.address || moving ? t.fill : t.primary }]}
          >
            <Text style={[s.bigText, { color: !pin?.address || moving ? t.faint : '#fff' }]}>Shu manzilni tanlash</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  headBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIc: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: font.semibold, fontSize: 16 },
  rowSub: { fontFamily: font.medium, fontSize: 13 },
  pinHead: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', elevation: 6 },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  pinLeg: { width: 4, height: 16, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  mapTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  fab: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  mapTitle: { flex: 1, height: 46, borderRadius: 23, justifyContent: 'center', paddingHorizontal: 16, elevation: 5 },
  mapSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, gap: 12, elevation: 16 },
  addr: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, minHeight: 56 },
  big: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontFamily: font.heavy, fontSize: 17 },
});
