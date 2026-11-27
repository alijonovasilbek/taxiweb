/**
 * Taksi chaqirish: xaritada markaziy pin bilan "Qayerdan" → "Qayerga" (yoki qidiruv) → narx va to'lov → buyurtma.
 * Web App'dagi BookRide bilan bir xil backend: /maps/reverse-geocode, /maps/estimate, POST /orders.
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/client';
import { qk, type TaxiOrder } from '../api/hooks';
import { MapView, type LatLng, type MapHandle, type MapMarker } from '../components/MapView';
import { PlaceSearch, type Place } from '../components/PlacePicker';
import { Button, ErrorNote, Icon, money, T } from '../components/ui';
import { PAYMENT } from '../lib/format';
import { font, radius, useTheme } from '../theme';

type Stage = 'pickup' | 'dropoff' | 'confirm';
type Est = { distance_km: number; duration_min: number; price: number | null; polyline?: { lat: number; lng: number }[] };

export default function TaxiBook() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const map = useRef<MapHandle>(null);
  const [stage, setStage] = useState<Stage>('pickup');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [pin, setPin] = useState<{ p: LatLng; address: string | null; busy: boolean } | null>(null);
  const [moving, setMoving] = useState(false);
  const [search, setSearch] = useState<Stage | null>(null);
  const [est, setEst] = useState<Est | null>(null);
  const [estBusy, setEstBusy] = useState(false);
  const [pay, setPay] = useState<'cash' | 'payme' | 'click'>('cash');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const geoSeq = useRef(0);

  // Joriy joylashuv: ruxsat so'raladi; berilmasa — Chortoq markazi, manzil qidiruv orqali
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const p = { lat: last.coords.latitude, lng: last.coords.longitude };
          setHere(p);
          map.current?.center(p, 16, false);
        }
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const p = { lat: cur.coords.latitude, lng: cur.coords.longitude };
        setHere(p);
        map.current?.center(p, 16);
      } catch {
        // GPS o'chiq — foydalanuvchi xaritani surib yoki qidirib tanlaydi
      }
    })();
  }, []);

  const onCenter = useCallback(async (p: LatLng) => {
    setMoving(false);
    if (stage === 'confirm') return;
    const my = ++geoSeq.current;
    setPin({ p, address: null, busy: true });
    try {
      const r = await api<{ address?: string | null; title?: string | null }>('/maps/reverse-geocode', { query: p });
      if (my === geoSeq.current) setPin({ p, address: r.title || r.address || null, busy: false });
    } catch {
      if (my === geoSeq.current) setPin({ p, address: null, busy: false });
    }
  }, [stage]);

  const pinAddress = pin?.address || (pin ? `${pin.p.lat.toFixed(5)}, ${pin.p.lng.toFixed(5)}` : '');

  const estSeq = useRef(0);
  // Narx va marshrut (manzillar tanlanganda)
  const estimate = async (a: Place, b: Place) => {
    const my = ++estSeq.current;
    setEst(null);
    setEstBusy(true);
    setError(null);
    setTimeout(() => map.current?.fit(330), 400);
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

  const choose = (p: Place) => {
    if (stage === 'pickup') {
      setPickup(p);
      // "Qayerga" oldin tanlangan bo'lsa (qaytib "Qayerdan"ni o'zgartirdi) — to'g'ridan-to'g'ri tasdiqlashga
      if (dropoff) {
        setStage('confirm');
        void estimate(p, dropoff);
      } else setStage('dropoff');
    } else {
      setDropoff(p);
      setStage('confirm');
      if (pickup) void estimate(pickup, p);
    }
  };

  const markers = useMemo<MapMarker[]>(() => [
    ...(pickup && stage !== 'pickup' ? [{ id: 'pickup', type: 'pickup' as const, ...pickup }] : []),
    ...(dropoff && stage === 'confirm' ? [{ id: 'dropoff', type: 'dropoff' as const, ...dropoff }] : []),
  ], [pickup, dropoff, stage]);

  const route = useMemo<[number, number][] | null>(() => {
    if (stage !== 'confirm') return null;
    if (est?.polyline?.length) return est.polyline.map((x) => [x.lat, x.lng]);
    return pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : null;
  }, [stage, est, pickup, dropoff]);

  const back = () => {
    setError(null);
    if (stage === 'confirm') {
      setStage('dropoff');
      setEst(null);
      if (dropoff) map.current?.center(dropoff, 16);
    } else if (stage === 'dropoff') {
      setStage('pickup');
      if (pickup) map.current?.center(pickup, 16);
    } else router.back();
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

  const pinColor = stage === 'pickup' ? t.green : t.red;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MapView ref={map} initial={here} markers={markers} route={route} onCenter={onCenter} onMoveStart={() => setMoving(true)} />

      {stage !== 'confirm' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ alignItems: 'center', transform: [{ translateY: moving ? -30 : -22 }] }}>
            <View style={[s.pinHead, { backgroundColor: pinColor }]}><View style={s.pinDot} /></View>
            <View style={[s.pinLeg, { backgroundColor: pinColor }]} />
          </View>
        </View>
      ) : null}

      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        <Pressable onPress={back} style={[s.fab, { backgroundColor: t.card }]} hitSlop={8}>
          <Icon n="back" size={22} />
        </Pressable>
        {here && stage !== 'confirm' ? (
          <Pressable onPress={() => map.current?.center(here, 16)} style={[s.fab, { backgroundColor: t.card }]} hitSlop={8}>
            <Icon n="locate" size={21} color={t.primary} />
          </Pressable>
        ) : null}
      </SafeAreaView>

      <View style={[s.sheet, { backgroundColor: t.card, paddingBottom: 16 + insets.bottom }]}>
        {stage === 'confirm' && pickup && dropoff ? (
          <View style={{ gap: 12 }}>
            <RoutePoints from={pickup.address} to={dropoff.address} onFrom={() => { setStage('pickup'); map.current?.center(pickup, 16); }}
              onTo={() => { setStage('dropoff'); map.current?.center(dropoff, 16); }} />
            <View style={[s.price, { backgroundColor: t.primarySoft }]}>
              {estBusy ? <ActivityIndicator color={t.primary} /> : (
                <>
                  <View>
                    <T kind="small">Taxminiy narx</T>
                    <T style={{ fontFamily: font.heavy, fontSize: 24, color: t.primary }}>{est?.price ? money(est.price) : '—'}</T>
                  </View>
                  {est ? <T kind="muted">{Number(est.distance_km).toFixed(1)} km · ~{est.duration_min} daq</T> : null}
                </>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['cash', 'payme', 'click'] as const).map((m) => (
                <Pressable key={m} onPress={() => setPay(m)}
                  style={[s.pay, { borderColor: pay === m ? t.primary : t.line, backgroundColor: pay === m ? t.primarySoft : 'transparent' }]}>
                  <Icon n={m === 'cash' ? 'cash' : 'card'} size={17} color={pay === m ? t.primary : t.muted} />
                  <T style={{ fontFamily: font.semibold, color: pay === m ? t.primary : t.text }}>{PAYMENT[m]}</T>
                </Pressable>
              ))}
            </View>
            <ErrorNote error={error} />
            <Button title="Taksi chaqirish" icon="taxi" loading={sending} disabled={estBusy || !est?.price} onPress={submit} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <T kind="label">{stage === 'pickup' ? 'Qayerdan' : 'Qayerga'}</T>
            <Pressable onPress={() => setSearch(stage)} style={[s.addr, { backgroundColor: t.fill }]}>
              <View style={[s.addrDot, { backgroundColor: pinColor }]} />
              <View style={{ flex: 1 }}>
                {pin?.busy ? <ActivityIndicator color={t.primary} style={{ alignSelf: 'flex-start' }} /> : (
                  <T numberOfLines={2} style={{ fontFamily: font.semibold }}>{pinAddress || 'Xaritani suring yoki qidiring'}</T>
                )}
              </View>
              <Icon n="search" size={19} color={t.muted} />
            </Pressable>
            {stage === 'dropoff' && pickup ? <T kind="small" numberOfLines={1}>Qayerdan: {pickup.address}</T> : null}
            <ErrorNote error={error} />
            <Button
              title={stage === 'pickup' ? 'Shu yerdan' : 'Shu yerga'}
              icon="check"
              disabled={!pin || pin.busy || moving}
              onPress={() => pin && choose({ ...pin.p, address: pinAddress })}
            />
          </View>
        )}
      </View>

      {search ? (
        <PlaceSearch
          title={search === 'pickup' ? 'Qayerdan' : 'Qayerga'}
          onClose={() => setSearch(null)}
          onPick={(p) => {
            setSearch(null);
            choose(p);
            if (stage === 'pickup') map.current?.center(p, 16);
          }}
        />
      ) : null}
    </View>
  );
}

function RoutePoints({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: () => void; onTo: () => void }) {
  const t = useTheme();
  const row = (color: string, text: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View style={[s.addrDot, { backgroundColor: color }]} />
      <T numberOfLines={1} style={{ flex: 1, fontFamily: font.semibold }}>{text}</T>
    </Pressable>
  );
  return (
    <View style={{ borderRadius: radius.md, backgroundColor: t.fill, paddingHorizontal: 12, paddingVertical: 4 }}>
      {row(t.green, from, onFrom)}
      <View style={{ height: 1, backgroundColor: t.line, marginLeft: 22 }} />
      {row(t.red, to, onTo)}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  fab: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 4, margin: 4 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, elevation: 12 },
  pinHead: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  pinDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  pinLeg: { width: 4, height: 14, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  addr: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 14, minHeight: 56 },
  addrDot: { width: 12, height: 12, borderRadius: 6 },
  price: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, padding: 14, minHeight: 64 },
  pay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11 },
});
