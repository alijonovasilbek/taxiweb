/**
 * Taksi chaqirish — dizayndagi "Bosh ekran" va "Tarif":
 * xarita markazida olib ketish pini (yaqin mashinalar bilan), pastda "Qayerga boramiz?" + Uy/Ish + oxirgi manzillar;
 * manzil tanlangach — yo'nalish, tariflar ro'yxati (har biri o'z narxi bilan), to'lov va "Buyurtma berish".
 * Backend: /maps/reverse-geocode, /drivers/nearby, /maps/estimate (tariflar bilan), POST /orders (tariff_id).
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
import { carKind, TariffCar } from '../components/TariffCar';
import { ErrorNote, Grabber, Icon, IconTile, MapFab, money, RouteCard } from '../components/ui';
import { greeting, PAYMENT } from '../lib/format';
import { font, useTheme } from '../theme';

type Stage = 'pickup' | 'dropoff' | 'confirm';
type Tariff = { id: number; code?: string | null; name: string; seats: number; level?: number; description?: string | null; price: number };
type Est = {
  distance_km: number; duration_min: number; price: number | null; tariffs?: Tariff[];
  polyline?: { lat: number; lng: number }[]; approx?: boolean;
};
type Pay = 'cash' | 'payme' | 'click';
const PAYS: Pay[] = ['cash', 'payme', 'click'];

const km = (a: LatLng, b: LatLng) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
const fmtKm = (v: number) => `${v.toFixed(1).replace('.', ',')} km`;

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
  const [tariffId, setTariffId] = useState<number | null>(null);
  const [pay, setPay] = useState<Pay>('cash');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [sheetH, setSheetH] = useState(0);
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
    setTimeout(() => map.current?.fit(470), 350);
    try {
      const r = await api<Est>('/maps/estimate', {
        method: 'POST', body: { from_lat: a.lat, from_lng: a.lng, to_lat: b.lat, to_lng: b.lng },
      });
      if (my === estSeq.current) {
        setEst(r);
        // Oldin tanlangan tarif hali bo'lsa — saqlanadi, aks holda birinchisi (Ekonom)
        setTariffId((cur) => (r.tariffs?.some((x) => x.id === cur) ? cur : r.tariffs?.[0]?.id ?? null));
      }
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

  // Pin va xarita "markazi" — pastki varaq ustidagi ko'rinadigan qismning o'rtasi
  useEffect(() => {
    if (sheetH) map.current?.margin(Math.max(0, sheetH - 24));
  }, [sheetH]);

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

  const tariffs = est?.tariffs ?? [];
  const chosen = tariffs.find((x) => x.id === tariffId) ?? tariffs[0];
  const price = chosen?.price ?? est?.price ?? null;

  const submit = async () => {
    if (!pickup || !dropoff) return;
    setSending(true);
    setError(null);
    try {
      const o = await api<TaxiOrder>('/orders', {
        method: 'POST',
        body: {
          pickup, dropoff, payment_method: pay, tariff_id: chosen?.id ?? null,
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
  const pinColor = stage === 'pickup' ? t.ink : t.primary;
  const eta = cars?.eta_min;
  const nCars = cars?.cars.length ?? 0;
  const bubble = stage === 'pickup'
    ? (moving ? null : eta ? `${eta} daq` : null)
    : stage === 'dropoff' && !moving ? 'Shu yerga' : null;
  const from = here ?? pin?.p ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: t.map }}>
      <MapView ref={map} initial={here} markers={markers} route={route} onCenter={onCenter} onMoveStart={() => setMoving(true)} />

      {pinMode ? (
        <View pointerEvents="none" style={[s.pinWrap, { bottom: Math.max(0, sheetH - 24) }]}>
          <View style={{ alignItems: 'center', transform: [{ translateY: moving ? -34 : -26 }] }}>
            {bubble ? (
              <View style={[s.bubble, { backgroundColor: t.ink }]}>
                <Text style={[s.bubbleText, { color: t.onInk }]}>{bubble}</Text>
              </View>
            ) : null}
            <View style={[s.pinHead, { borderColor: pinColor, backgroundColor: t.card }]}><View style={[s.pinDot, { backgroundColor: pinColor }]} /></View>
            <View style={[s.pinLeg, { backgroundColor: pinColor }]} />
          </View>
          <View style={[s.pinShadow, moving && { opacity: 0.25, transform: [{ scale: 0.7 }] }]} />
        </View>
      ) : null}

      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        <MapFab icon="back" onPress={back} />
        <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="none">
          {stage === 'pickup' && nCars ? (
            <View style={[s.topPill, { backgroundColor: t.card }]}>
              <View style={[s.liveDot, { backgroundColor: t.green }]} />
              <Text style={[s.topPillText, { color: t.text }]}>Yaqinda {nCars} ta taksi</Text>
            </View>
          ) : null}
          {stage === 'confirm' && est ? (
            <View style={[s.topPill, { backgroundColor: t.ink }]}>
              <Text style={[s.topPillText, { color: t.onInk }]}>{est.duration_min} daq · {fmtKm(Number(est.distance_km))}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ width: 48 }} />
      </SafeAreaView>

      {here && pinMode ? (
        <MapFab icon="locate" onPress={() => map.current?.center(here, 17)}
          style={[s.locate, { bottom: sheetH + 12 }]} />
      ) : null}

      <View onLayout={(e) => setSheetH(Math.round(e.nativeEvent.layout.height))}
        style={[s.sheet, { backgroundColor: t.sheet, paddingBottom: 20 + insets.bottom }]}>
        <Grabber />

        {stage === 'pickup' ? (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text style={[s.hello, { color: t.muted }]}>{greeting()}</Text>
              <Text style={[s.h1, { color: t.text }]}>Qayerga boramiz?</Text>
              <Pressable onPress={() => setSearch('pickup')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={[s.fromDot, { borderColor: t.ink, backgroundColor: t.card }]} />
                {pin?.busy || moving ? <ActivityIndicator size="small" color={t.muted} /> : (
                  <Text numberOfLines={1} style={[s.fromText, { color: t.muted }]}>{pinAddress || 'Olib ketish joyi'}</Text>
                )}
                <Icon n="chevDown" size={14} color={t.muted} />
              </Pressable>
            </View>

            {dropoff ? (
              <>
                <RouteCard from={pinAddress || 'Olib ketish joyi'} to={dropoff.address}
                  right={<Pressable onPress={() => setSearch('dropoff')} style={[s.roundBtn, { backgroundColor: t.card }]}><Icon n="search" size={18} /></Pressable>} />
                <BigButton title="Davom etish" disabled={!pin || pin.busy || moving} onPress={() => goConfirm(dropoff)} />
              </>
            ) : (
              <>
                <Pressable onPress={() => setSearch('dropoff')} style={[s.where, { backgroundColor: t.fill }]}>
                  <Icon n="search" size={22} color={t.text} />
                  <Text style={[s.whereText, { color: t.text }]}>Manzilni kiriting</Text>
                  <View style={[s.now, { backgroundColor: t.card }]}>
                    <Icon n="clock" size={16} color={t.text} />
                    <Text style={[s.nowText, { color: t.text }]}>Hozir</Text>
                  </View>
                </Pressable>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <SavedCard icon="home" title="Uy" sub={saved.home?.address ?? "Qo'shish"} accent
                    onPress={() => (saved.home ? goConfirm(saved.home) : router.push('/places'))} />
                  <SavedCard icon="briefcase" title="Ish" sub={saved.work?.address ?? "Qo'shish"}
                    onPress={() => (saved.work ? goConfirm(saved.work) : router.push('/places'))} />
                </View>

                <ScrollView style={{ maxHeight: 170 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {recent.map((p, i) => (
                    <PlaceRow key={p.address} icon="clock" title={p.address} last={false}
                      right={from ? fmtKm(km(from, p)) : undefined} onPress={() => goConfirm(p)} first={i === 0} />
                  ))}
                  <PlaceRow icon="map" title="Xaritadan tanlash" subtitle="Borish joyini pin bilan belgilang" onPress={pickDropoffOnMap} last />
                </ScrollView>
              </>
            )}
            <ErrorNote error={error} />
          </View>
        ) : null}

        {stage === 'dropoff' ? (
          <View style={{ gap: 14 }}>
            <Text style={[s.h1, { color: t.text }]}>Qayerga?</Text>
            <Pressable onPress={() => setSearch('dropoff')} style={[s.where, { backgroundColor: t.fill }]}>
              <View style={[s.toDot, { backgroundColor: t.primary }]} />
              {pin?.busy || moving ? <ActivityIndicator size="small" color={t.primary} /> : (
                <Text numberOfLines={1} style={[s.whereText, { color: t.text }]}>{pinAddress || 'Xaritani suring'}</Text>
              )}
              <Icon n="search" size={20} color={t.muted} />
            </Pressable>
            <BigButton title="Shu yerga" disabled={!pin || pin.busy || moving}
              onPress={() => pin && goConfirm({ ...pin.p, address: pinAddress }, pickup)} />
          </View>
        ) : null}

        {stage === 'confirm' && pickup && dropoff ? (
          <View style={{ gap: 14 }}>
            <RouteCard from={pickup.address} to={dropoff.address}
              right={<Pressable onPress={() => setSearch('dropoff')} style={[s.roundBtn, { backgroundColor: t.card }]}><Icon n="search" size={18} /></Pressable>} />

            {estBusy && !tariffs.length ? <ActivityIndicator color={t.primary} style={{ marginVertical: 24 }} /> : null}
            <ScrollView style={{ maxHeight: 290 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
              {tariffs.map((x) => {
                const on = x.id === chosen?.id;
                return (
                  <Pressable key={x.id} onPress={() => setTariffId(x.id)} accessibilityState={{ selected: on }}
                    style={[s.tariff, { borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primarySoft : t.card }]}>
                    <TariffCar kind={carKind(x)} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.tariffName, { color: t.text }]}>{x.name}</Text>
                      <Text style={[s.tariffMeta, { color: t.muted }]} numberOfLines={1}>
                        {eta ? `${eta} daq · ` : ''}{x.seats} o‘rin{x.description ? ` · ${x.description}` : ''}
                      </Text>
                    </View>
                    <Text style={[s.tariffPrice, { color: t.text }]}>{money(x.price)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={() => setPay(PAYS[(PAYS.indexOf(pay) + 1) % PAYS.length])}
              style={[s.payRow, { borderColor: t.line, backgroundColor: t.card }]}>
              <Icon n={pay === 'cash' ? 'cash' : 'card'} size={20} color={t.text} />
              <Text style={[s.payText, { color: t.text }]}>{pay === 'cash' ? 'Naqd pul' : PAYMENT[pay]}</Text>
              <Text style={[s.payHint, { color: t.muted }]}>o‘zgartirish</Text>
              <Icon n="next" size={16} color={t.muted} />
            </Pressable>
            <ErrorNote error={error} />
            <BigButton title={price ? `Buyurtma berish · ${money(price)}` : 'Buyurtma berish'} loading={sending}
              disabled={estBusy || !price} onPress={submit} />
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

function SavedCard({ icon, title, sub, accent, onPress }: { icon: string; title: string; sub: string; accent?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.saved, { borderColor: t.line }, pressed && { opacity: 0.7 }]}>
      <IconTile n={icon} bg={accent ? t.primary : t.fill} color={accent ? t.onPrimary : t.text} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.savedTitle, { color: t.text }]}>{title}</Text>
        <Text style={[s.savedSub, { color: t.muted }]} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  );
}

function PlaceRow({ icon, title, subtitle, right, onPress, last }: {
  icon: string; title: string; subtitle?: string; right?: string; onPress: () => void; last?: boolean; first?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, !last && { borderBottomWidth: 1, borderBottomColor: t.lineSoft }, pressed && { opacity: 0.6 }]}>
      <Icon n={icon} size={22} color={t.muted} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[s.rowSub, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={[s.rowSub, { color: t.muted }]}>{right}</Text> : null}
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
        <Text style={[s.bigText, { color: off ? t.faint : t.onPrimary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  topPill: { height: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10 },
  topPillText: { fontFamily: font.semibold, fontSize: 14 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  locate: { position: 'absolute', right: 16 },
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: 'center', marginBottom: 6 },
  bubbleText: { fontFamily: font.semibold, fontSize: 13 },
  pinHead: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  pinDot: { width: 8, height: 8, borderRadius: 4 },
  pinLeg: { width: 3, height: 14, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  pinShadow: { width: 10, height: 4, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -24 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, elevation: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 24,
  },
  hello: { fontFamily: font.medium, fontSize: 14 },
  h1: { fontFamily: font.heavy, fontSize: 26, letterSpacing: -0.5 },
  fromDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 3 },
  fromText: { fontFamily: font.semibold, fontSize: 13, flexShrink: 1 },
  toDot: { width: 10, height: 10, borderRadius: 2 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingLeft: 16, paddingRight: 8, height: 56 },
  whereText: { flex: 1, fontFamily: font.semibold, fontSize: 17 },
  now: { height: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nowText: { fontFamily: font.semibold, fontSize: 14 },
  saved: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: 16 },
  savedTitle: { fontFamily: font.bold, fontSize: 15 },
  savedSub: { fontFamily: font.medium, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowTitle: { fontFamily: font.semibold, fontSize: 15 },
  rowSub: { fontFamily: font.medium, fontSize: 13 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tariff: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 68, paddingLeft: 8, paddingRight: 14, borderRadius: 18, borderWidth: 2 },
  tariffName: { fontFamily: font.bold, fontSize: 16 },
  tariffMeta: { fontFamily: font.medium, fontSize: 13 },
  tariffPrice: { fontFamily: font.bold, fontSize: 16 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  payText: { flex: 1, fontFamily: font.semibold, fontSize: 15 },
  payHint: { fontFamily: font.medium, fontSize: 13 },
  big: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontFamily: font.heavy, fontSize: 17 },
});
