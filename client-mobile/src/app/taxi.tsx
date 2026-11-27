/**
 * Taksi chaqirish — xarita markazida "olib ketish" pini (yaqin mashinalar va kelish vaqti bilan),
 * pastda "Qayerga boramiz?" + Uy/Ish + oxirgi manzillar; manzil tanlangach marshrut, narx, to'lov va buyurtma.
 * Backend Web App bilan bir xil: /maps/reverse-geocode, /drivers/nearby, /maps/estimate, POST /orders.
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/client';
import { qk, recentPlaces, useMe, useRides, type NearbyCars, type TaxiOrder } from '../api/hooks';
import { MapView, type LatLng, type MapHandle, type MapMarker } from '../components/MapView';
import { PlaceSearch, type Place } from '../components/PlacePicker';
import { ErrorNote, Icon, money, T } from '../components/ui';
import { PAYMENT } from '../lib/format';
import { font, useTheme } from '../theme';

type Stage = 'pickup' | 'dropoff' | 'confirm';
type Est = { distance_km: number; duration_min: number; price: number | null; polyline?: { lat: number; lng: number }[]; approx?: boolean };
type Pay = 'cash' | 'payme' | 'click';

export default function TaxiBook() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ to_lat?: string; to_lng?: string; to_address?: string }>();
  const me = useMe();
  const rides = useRides();
  const map = useRef<MapHandle>(null);

  const preset = params.to_lat && params.to_lng
    ? { lat: Number(params.to_lat), lng: Number(params.to_lng), address: params.to_address || 'Manzil' } : null;
  const [stage, setStage] = useState<Stage>('pickup');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(preset);
  const [pin, setPin] = useState<{ p: LatLng; address: string | null; busy: boolean } | null>(null);
  const [moving, setMoving] = useState(false);
  const [search, setSearch] = useState<'pickup' | 'dropoff' | null>(null);
  const [cars, setCars] = useState<NearbyCars | null>(null);
  const [est, setEst] = useState<Est | null>(null);
  const [estBusy, setEstBusy] = useState(false);
  const [pay, setPay] = useState<Pay>('cash');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const geoSeq = useRef(0);
  const estSeq = useRef(0);

  const saved = me.data?.saved_places ?? {};
  const recent = recentPlaces(rides.data, 4);

  // Joriy joylashuv: avval oxirgi ma'lum (tez), keyin aniq
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const p = { lat: last.coords.latitude, lng: last.coords.longitude };
          setHere(p);
          map.current?.center(p, 17, false);
        }
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const p = { lat: cur.coords.latitude, lng: cur.coords.longitude };
        setHere(p);
        if (!last) map.current?.center(p, 17);
      } catch {
        // GPS o'chiq — xaritani surib yoki qidirib tanlanadi
      }
    })();
  }, []);

  const loadCars = useCallback(async (p: LatLng) => {
    try {
      setCars(await api<NearbyCars>('/drivers/nearby', { query: p }));
    } catch {
      setCars(null);
    }
  }, []);

  const onCenter = useCallback(async (p: LatLng) => {
    setMoving(false);
    if (stage === 'confirm') return;
    const my = ++geoSeq.current;
    setPin({ p, address: null, busy: true });
    if (stage === 'pickup') void loadCars(p);
    try {
      const r = await api<{ address?: string | null; title?: string | null }>('/maps/reverse-geocode', { query: p });
      if (my === geoSeq.current) setPin({ p, address: r.title || r.address || null, busy: false });
    } catch {
      if (my === geoSeq.current) setPin({ p, address: null, busy: false });
    }
  }, [stage, loadCars]);

  const pinAddress = pin?.address || (pin ? `${pin.p.lat.toFixed(5)}, ${pin.p.lng.toFixed(5)}` : '');
  const currentPickup = (): Place | null => (pin && !pin.busy ? { ...pin.p, address: pinAddress } : pickup);

  const estimate = async (a: Place, b: Place) => {
    const my = ++estSeq.current;
    setEst(null);
    setEstBusy(true);
    setError(null);
    setTimeout(() => map.current?.fit(400), 350);
    try {
      const r = await api<Est>('/maps/estimate', {
        method: 'POST', body: { from_lat: a.lat, from_lng: a.lng, to_lat: b.lat, to_lng: b.lng },
      });
      if (my === estSeq.current) setEst(r);
    } catch (e) {
      if (my === estSeq.current) setError(e instanceof Error ? e.message : 'Narxni hisoblab bo‘lmadi');
    } finally {
      if (my === estSeq.current) setEstBusy(false);
    }
  };

  /** Manzil tanlandi: olib ketish joyi — xarita markazidagi pin (yoki qidiruvdan tanlangan) */
  const goConfirm = (to: Place, from?: Place | null) => {
    const a = from ?? currentPickup();
    if (!a) return setError("Olib ketish joyini tanlang: xaritani suring yoki qidiring");
    // ~50 metrdan yaqin — bir xil joy (pin surilmasdan "Shu yerga" bosilgan)
    if (Math.abs(a.lat - to.lat) < 0.0005 && Math.abs(a.lng - to.lng) < 0.0005) {
      return setError("Borish joyi olib ketish joyi bilan bir xil. Xaritani surib boshqa joyni tanlang.");
    }
    setPickup(a);
    setDropoff(to);
    setStage('confirm');
    void estimate(a, to);
  };

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (stage !== 'pickup') {
      if (pickup) m.push({ id: 'pickup', type: 'pickup', ...pickup });
      if (dropoff && stage === 'confirm') m.push({ id: 'dropoff', type: 'dropoff', ...dropoff });
    } else {
      (cars?.cars ?? []).slice(0, 8).forEach((c, i) => m.push({ id: `car${i}`, type: 'car', lat: c.lat, lng: c.lng }));
    }
    return m;
  }, [pickup, dropoff, stage, cars]);

  const route = useMemo<[number, number][] | null>(() => {
    // Faqat ko'chalar bo'ylab haqiqiy marshrut chiziladi. Yuklanayotganda yoki server taxminiy (to'g'ri chiziq)
    // qaytarsa — chiziq yo'q, faqat ikki nuqta: "uylar ustidan" o'tgan chiziq chalg'itadi
    if (stage !== 'confirm' || !est?.polyline || est.approx || est.polyline.length <= 2) return null;
    return est.polyline.map((x) => [x.lat, x.lng]);
  }, [stage, est]);

  const back = () => {
    setError(null);
    if (stage === 'confirm' || stage === 'dropoff') {
      setStage('pickup');
      setEst(null);
      if (pickup) map.current?.center(pickup, 17);
    } else router.back();
  };

  // Android "orqaga" tugmasi: avval bosqichma-bosqich (tasdiqlash → manzil → ekrandan chiqish)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (search) return false;
      if (stage === 'pickup') return false;
      back();
      return true;
    });
    return () => sub.remove();
  });

  /** "Xaritadan tanlash": borish joyini shu ekrandagi pin bilan belgilash */
  const pickDropoffOnMap = () => {
    const a = stage === 'confirm' ? pickup : currentPickup();
    if (a) setPickup(a);
    setSearch(null);
    setEst(null);
    setStage('dropoff');
    if (dropoff) map.current?.center(dropoff, 17);
  };

  const submit = async () => {
    if (!pickup || !dropoff) return;
    setSending(true);
    setError(null);
    try {
      const o = await api<TaxiOrder>('/orders', {
        method: 'POST',
        body: {
          pickup, dropoff, payment_method: pay,
          road_distance_km: est?.distance_km ?? null, road_duration_min: est?.duration_min ?? null,
        },
      });
      void qc.invalidateQueries({ queryKey: qk.activeOrder });
      router.replace({ pathname: '/ride/[id]', params: { id: String(o.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buyurtma yuborilmadi');
    } finally {
      setSending(false);
    }
  };

  const pinMode = stage === 'pickup' || stage === 'dropoff';
  const pinColor = stage === 'pickup' ? t.green : t.red;
  const eta = cars?.eta_min;
  const bubble = stage === 'pickup'
    ? (moving ? null : eta ? `~${eta} daq` : 'Olib ketish joyi')
    : stage === 'dropoff' && !moving ? 'Shu yerga' : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MapView ref={map} initial={here} markers={markers} route={route} onCenter={onCenter} onMoveStart={() => setMoving(true)} />

      {pinMode ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ alignItems: 'center', transform: [{ translateY: moving ? -34 : -26 }] }}>
            {bubble ? (
              <View style={[s.bubble, { backgroundColor: t.text }]}>
                {stage === 'pickup' && eta ? <Icon n="taxi" size={15} color={t.bg} /> : null}
                <Text style={[s.bubbleText, { color: t.bg }]}>{bubble}</Text>
              </View>
            ) : null}
            <View style={[s.pinHead, { backgroundColor: pinColor }]}><View style={s.pinDot} /></View>
            <View style={[s.pinLeg, { backgroundColor: pinColor }]} />
          </View>
          <View style={[s.pinShadow, moving && { opacity: 0.25, transform: [{ scale: 0.7 }] }]} />
        </View>
      ) : null}

      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        <Pressable onPress={back} style={[s.fab, { backgroundColor: t.card }]} hitSlop={8}>
          <Icon n="back" size={22} />
        </Pressable>
        {stage === 'pickup' ? (
          <Pressable onPress={() => setSearch('pickup')} style={[s.addrPill, { backgroundColor: t.card }]}>
            <View style={[s.dot, { backgroundColor: t.green }]} />
            {pin?.busy || moving ? <ActivityIndicator size="small" color={t.primary} /> : (
              <Text numberOfLines={1} style={[s.addrPillText, { color: t.text }]}>{pinAddress || 'Olib ketish joyi'}</Text>
            )}
            <Icon n="chevDown" size={16} color={t.muted} />
          </Pressable>
        ) : <View style={{ flex: 1 }} />}
        <View style={{ width: 46 }} />
      </SafeAreaView>

      {here && pinMode ? (
        <Pressable onPress={() => map.current?.center(here, 17)} style={[s.fab, s.locate, { backgroundColor: t.card, bottom: (stage === 'pickup' ? 330 : 190) + insets.bottom }]}>
          <Icon n="nav" size={20} color={t.primary} />
        </Pressable>
      ) : null}

      <View style={[s.sheet, { backgroundColor: t.sheet, paddingBottom: 14 + insets.bottom, shadowColor: t.shadow }]}>
        <View style={[s.grabber, { backgroundColor: t.line }]} />

        {stage === 'pickup' ? (
          <View style={{ gap: 10 }}>
            {dropoff ? (
              <>
                <Pressable onPress={() => setSearch('dropoff')} style={[s.where, { backgroundColor: t.fill }]}>
                  <View style={[s.dot, { backgroundColor: t.red }]} />
                  <Text numberOfLines={1} style={[s.whereText, { color: t.text }]}>{dropoff.address}</Text>
                  <Icon n="search" size={18} color={t.muted} />
                </Pressable>
                <BigButton title="Davom etish" disabled={!pin || pin.busy || moving} onPress={() => goConfirm(dropoff)} />
              </>
            ) : (
              <>
                <Pressable onPress={() => setSearch('dropoff')} style={[s.where, { backgroundColor: t.fill }]}>
                  <Icon n="search" size={20} color={t.text} />
                  <Text style={[s.whereText, { color: t.text, fontFamily: font.bold }]}>Qayerga boramiz?</Text>
                  <Icon n="next" size={20} color={t.muted} />
                </Pressable>
                <ScrollView style={{ maxHeight: 210 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <PlaceRow icon="home" title="Uyga" subtitle={saved.home?.address ?? "Manzil qo'shish"}
                    onPress={() => (saved.home ? goConfirm(saved.home) : router.push('/places'))} />
                  <PlaceRow icon="briefcase" title="Ishga" subtitle={saved.work?.address ?? "Manzil qo'shish"}
                    onPress={() => (saved.work ? goConfirm(saved.work) : router.push('/places'))} />
                  {recent.map((p) => (
                    <PlaceRow key={p.address} icon="history" title={p.address} onPress={() => goConfirm(p)} />
                  ))}
                  <PlaceRow icon="map" title="Xaritadan tanlash" subtitle="Borish joyini pin bilan belgilang" onPress={pickDropoffOnMap} />
                </ScrollView>
              </>
            )}
            <ErrorNote error={error} />
          </View>
        ) : null}

        {stage === 'dropoff' ? (
          <View style={{ gap: 10 }}>
            <T kind="label">Qayerga</T>
            <Pressable onPress={() => setSearch('dropoff')} style={[s.where, { backgroundColor: t.fill }]}>
              <View style={[s.dot, { backgroundColor: t.red }]} />
              {pin?.busy || moving ? <ActivityIndicator size="small" color={t.primary} /> : (
                <Text numberOfLines={1} style={[s.whereText, { color: t.text }]}>{pinAddress || 'Xaritani suring'}</Text>
              )}
              <Icon n="search" size={18} color={t.muted} />
            </Pressable>
            <BigButton title="Shu yerga" disabled={!pin || pin.busy || moving}
              onPress={() => pin && goConfirm({ ...pin.p, address: pinAddress }, pickup)} />
          </View>
        ) : null}

        {stage === 'confirm' && pickup && dropoff ? (
          <View style={{ gap: 12 }}>
            <View style={[s.points, { backgroundColor: t.fill }]}>
              <Pressable onPress={() => { setStage('pickup'); setEst(null); map.current?.center(pickup, 17); }} style={s.pointRow}>
                <View style={[s.dot, { backgroundColor: t.green }]} />
                <Text numberOfLines={1} style={[s.pointText, { color: t.text }]}>{pickup.address}</Text>
              </Pressable>
              <View style={[s.pointLine, { backgroundColor: t.line }]} />
              <Pressable onPress={() => setSearch('dropoff')} style={s.pointRow}>
                <View style={[s.dot, { backgroundColor: t.red }]} />
                <Text numberOfLines={1} style={[s.pointText, { color: t.text }]}>{dropoff.address}</Text>
              </Pressable>
            </View>

            <View style={[s.tariff, { borderColor: t.primary, backgroundColor: t.primarySoft }]}>
              <View style={[s.tariffIc, { backgroundColor: t.taxi }]}><Icon n="taxi" size={24} color="#141414" /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.tariffName, { color: t.text }]}>Taksi</Text>
                <Text style={[s.tariffSub, { color: t.muted }]}>
                  {est ? `${Number(est.distance_km).toFixed(1)} km · ~${est.duration_min} daq` : 'Hisoblanmoqda…'}
                  {eta ? ` · kelish ~${eta} daq` : ''}
                </Text>
              </View>
              {estBusy ? <ActivityIndicator color={t.primary} /> : (
                <Text style={[s.tariffPrice, { color: t.text }]}>{est?.price ? money(est.price) : '—'}</Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['cash', 'payme', 'click'] as Pay[]).map((m) => (
                <Pressable key={m} onPress={() => setPay(m)}
                  style={[s.pay, { borderColor: pay === m ? t.text : t.line, backgroundColor: pay === m ? t.fill : 'transparent' }]}>
                  <Icon n={m === 'cash' ? 'cash' : 'card'} size={17} color={t.text} />
                  <Text style={[s.payText, { color: t.text }]}>{PAYMENT[m]}</Text>
                </Pressable>
              ))}
            </View>
            <ErrorNote error={error} />
            <BigButton title={est?.price ? `Buyurtma berish · ${money(est.price)}` : 'Buyurtma berish'} loading={sending}
              disabled={estBusy || !est?.price} onPress={submit} />
          </View>
        ) : null}
      </View>

      {search ? (
        <PlaceSearch
          title={search === 'pickup' ? 'Qayerdan' : 'Qayerga'}
          initial={search === 'dropoff' ? dropoff ?? pin?.p ?? here : pin?.p ?? here}
          onClose={() => setSearch(null)}
          onMap={search === 'dropoff' ? pickDropoffOnMap : () => { setSearch(null); setStage('pickup'); }}
          onPick={(p) => {
            setSearch(null);
            if (search === 'pickup') {
              setPickup(p);
              map.current?.center(p, 17);
              if (dropoff && stage === 'confirm') goConfirm(dropoff, p);
            } else goConfirm(p, stage === 'pickup' ? null : pickup);
          }}
        />
      ) : null}
    </View>
  );
}

function PlaceRow({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
      <View style={[s.rowIc, { backgroundColor: t.fill }]}><Icon n={icon} size={19} color={t.text} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[s.rowSub, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

function BigButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  const t = useTheme();
  const off = disabled || loading;
  return (
    <Pressable onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.big, { backgroundColor: off ? t.fill : t.primary }, pressed && !off && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color="#fff" /> : (
        <Text style={[s.bigText, { color: off ? t.faint : '#fff' }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  fab: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  locate: { position: 'absolute', right: 14 },
  addrPill: { flex: 1, height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, elevation: 5 },
  addrPillText: { flex: 1, fontFamily: font.bold, fontSize: 15 },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6, elevation: 6 },
  bubbleText: { fontFamily: font.bold, fontSize: 14 },
  pinHead: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 6, borderWidth: 3, borderColor: '#fff' },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  pinLeg: { width: 4, height: 16, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  pinShadow: { width: 10, height: 4, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -24 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8, elevation: 16, shadowOpacity: 1, shadowRadius: 20,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 16, height: 58 },
  whereText: { flex: 1, fontFamily: font.semibold, fontSize: 17 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowIc: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: font.semibold, fontSize: 16 },
  rowSub: { fontFamily: font.medium, fontSize: 13 },
  points: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  pointText: { flex: 1, fontFamily: font.semibold, fontSize: 15 },
  pointLine: { height: 1, marginLeft: 24 },
  tariff: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 2, padding: 12 },
  tariffIc: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tariffName: { fontFamily: font.heavy, fontSize: 17 },
  tariffSub: { fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  tariffPrice: { fontFamily: font.heavy, fontSize: 18 },
  pay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 14, height: 46 },
  payText: { fontFamily: font.semibold, fontSize: 14 },
  big: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontFamily: font.heavy, fontSize: 17 },
});
