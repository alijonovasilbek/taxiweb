/**
 * Safar kuzatuvi — dizayndagi "Haydovchi kelmoqda" va "Safar tugadi":
 * xaritada haydovchi real vaqtda, yetib kelish vaqti va davlat raqami, haydovchi kartasi, qo'ng'iroq / xabar / xavfsizlik,
 * bekor qilish; "haydovchi topilmadi"da qayta qidirish; yakunda — narx, safar ma'lumoti, baho va teglar, onlayn to'lov.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../api/client';
import { ACTIVE_STATUSES, qk, useOrder, type TaxiOrder } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { CancelSheet } from '../../components/CancelSheet';
import { MapView, type LatLng, type MapHandle, type MapMarker } from '../../components/MapView';
import { Avatar, Button, ErrorNote, Grabber, Icon, IconTile, MapFab, money, Plate, RouteCard, T } from '../../components/ui';
import { PAYMENT } from '../../lib/format';
import { font, useTheme } from '../../theme';

const TOP: Record<string, string> = {
  searching: 'Haydovchi qidirilmoqda',
  accepted: "Haydovchi yo'lda",
  driver_arrived: 'Haydovchi yetib keldi',
  in_progress: 'Safar davom etmoqda',
  no_drivers: 'Haydovchi topilmadi',
  cancelled: 'Buyurtma bekor qilindi',
};

const FINISHED_SET = new Set(['cancelled', 'no_drivers']);
const TAGS = ['Toza mashina', 'Xushmuomala', 'Yaxshi haydadi', 'Tez yetib keldi', 'Yoqimli musiqa'];
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? NaN : Number(v));
const fmtKm = (v: number) => `${v.toFixed(1).replace('.', ',')} km`;

/** To'g'ri chiziq masofasi (km) — haydovchi kelish vaqtini taxmin qilish uchun */
function km(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}
// Shahar ichida ~25 km/soat, yo'l to'g'ri chiziqdan ~1,4 marta uzun
const minutes = (a: LatLng, b: LatLng) => Math.max(1, Math.round((km(a, b) * 1.4) / 25 * 60));

export default function Ride() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const map = useRef<MapHandle>(null);
  const [liveLoc, setDriverLoc] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const q = useOrder(orderId, true);
  const o = q.data;
  const status = o?.status ?? 'searching';
  const active = ACTIVE_STATUSES.includes(status);

  // Haydovchining joylashuvi: socket (har bir necha soniya), bo'lmasa — buyurtma javobidagi oxirgi nuqta
  const driverLoc = liveLoc ?? (o?.driver?.lat && o.driver.lng ? { lat: o.driver.lat, lng: o.driver.lng } : null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const track = () => socket.emit('passenger:track_order', { order_id: orderId });
    track();
    socket.on('connect', track);
    const onLoc = (d: { order_id: number; lat: number; lng: number }) => {
      if (Number(d?.order_id) === orderId) setDriverLoc({ lat: d.lat, lng: d.lng });
    };
    socket.on('driver_location', onLoc);
    return () => {
      socket.off('connect', track);
      socket.off('driver_location', onLoc);
    };
  }, [orderId]);

  const pickup = o ? { lat: num(o.pickup_lat), lng: num(o.pickup_lng) } : null;
  const dropoff = o ? { lat: num(o.dropoff_lat), lng: num(o.dropoff_lng) } : null;

  // Marshrut (ko'chalar bo'ylab): olib ketish → borish joyi; server taxminiy qaytarsa chizilmaydi
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const routeFor = useRef<number | null>(null);
  useEffect(() => {
    if (!o || routeFor.current === o.id) return;
    routeFor.current = o.id;
    api<{ polyline?: { lat: number; lng: number }[]; approx?: boolean }>('/maps/route', {
      query: { fromLat: num(o.pickup_lat), fromLng: num(o.pickup_lng), toLat: num(o.dropoff_lat), toLng: num(o.dropoff_lng) },
    })
      .then((r) => {
        if (!r.approx && r.polyline && r.polyline.length > 2) setRoute(r.polyline.map((p) => [p.lat, p.lng]));
      })
      .catch(() => undefined);
  }, [o]);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (pickup) m.push({ id: 'pickup', type: 'pickup', ...pickup });
    if (dropoff) m.push({ id: 'dropoff', type: 'dropoff', ...dropoff });
    if (driverLoc && active && status !== 'searching') m.push({ id: 'driver', type: 'driver', ...driverLoc });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.pickup_lat, o?.dropoff_lat, driverLoc?.lat, driverLoc?.lng, active, status]);

  // Birinchi yuklanishda (varaq o'lchami ma'lum bo'lgach) hammasini varaq ustidagi qismga sig'diramiz
  const fitted = useRef(false);
  useEffect(() => {
    if (o && sheetH && !fitted.current) {
      fitted.current = true;
      setTimeout(() => map.current?.fit(sheetH + 20), 300);
    }
  }, [o, sheetH]);

  // Bekor qilish — sabab tanlanadi (analitika uchun kod bilan saqlanadi)
  const [cancelling, setCancelling] = useState(false);
  const cancel = async (code: string, text: string | null) => {
    await api(`/orders/${orderId}/cancel`, { method: 'PUT', body: { reason_code: code, reason: text } });
    setCancelling(false);
    void qc.invalidateQueries({ queryKey: qk.activeOrder });
    router.replace('/(tabs)');
  };

  const retry = async () => {
    if (!o) return;
    setBusy(true);
    setError(null);
    try {
      const n = await api<TaxiOrder>('/orders', {
        method: 'POST',
        body: {
          pickup: { lat: num(o.pickup_lat), lng: num(o.pickup_lng), address: o.pickup_address },
          dropoff: { lat: num(o.dropoff_lat), lng: num(o.dropoff_lng), address: o.dropoff_address },
          payment_method: o.payment_method || 'cash',
          tariff_id: (o as TaxiOrder & { tariff_id?: number | null }).tariff_id ?? null,
        },
      });
      void qc.invalidateQueries({ queryKey: qk.activeOrder });
      router.replace({ pathname: '/ride/[id]', params: { id: String(n.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buyurtma yuborilmadi');
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    void qc.invalidateQueries({ queryKey: qk.activeOrder });
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const share = () => {
    if (!o) return;
    const d = o.driver;
    void Share.share({
      message: `Chortoq taksi: ${o.pickup_address} → ${o.dropoff_address}` +
        (d ? `\nHaydovchi: ${d.name}, ${d.car_color} ${d.car_model}, ${d.car_number}${d.phone ? `, ${d.phone}` : ''}` : ''),
    });
  };

  if (status === 'completed' && o) return <Finish order={o} onDone={leave} />;

  const arriveMin = status === 'accepted' && driverLoc && pickup && !Number.isNaN(pickup.lat) ? minutes(driverLoc, pickup) : null;
  const rideMin = status === 'in_progress' && driverLoc && dropoff && !Number.isNaN(dropoff.lat) ? minutes(driverLoc, dropoff) : null;
  const price = o ? money(o.final_price || o.estimated_price) : '';
  const payText = o?.payment_method && o.payment_method !== 'cash' ? PAYMENT[o.payment_method] ?? o.payment_method : 'Naqd';
  const bad = status === 'no_drivers' || status === 'cancelled';

  return (
    <View style={{ flex: 1, backgroundColor: t.map }}>
      <MapView ref={map} initial={pickup && !Number.isNaN(pickup.lat) ? pickup : null} markers={markers}
        route={FINISHED_SET.has(status) ? null : route} />

      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        <MapFab icon="back" onPress={leave} />
        <View style={[s.statusPill, { backgroundColor: bad ? t.redInk : t.ink }]}>
          {status === 'searching' ? <ActivityIndicator size="small" color={t.onInk} /> : <View style={[s.dot, { backgroundColor: bad ? '#fff' : t.primary }]} />}
          <Text style={[s.statusText, { color: bad ? '#fff' : t.onInk }]} numberOfLines={1}>{TOP[status] ?? TOP.searching}</Text>
        </View>
        {driverLoc && active && status !== 'searching' ? (
          <MapFab icon="taxi" color={t.primary} onPress={() => map.current?.center(driverLoc, 16)} />
        ) : null}
      </SafeAreaView>

      <View onLayout={(e) => setSheetH(Math.round(e.nativeEvent.layout.height))}
        style={[s.sheet, { backgroundColor: t.sheet, paddingBottom: 20 + insets.bottom }]}>
        <Grabber />
        <ScrollView contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false} bounces={false}>
          {/* Sarlavha: kelish vaqti / holat + davlat raqami */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.kicker, { color: t.muted }]}>
                {status === 'accepted' ? 'Yetib keladi' : status === 'in_progress' ? 'Manzilgacha' : status === 'driver_arrived' ? 'Sizni kutmoqda' : ' '}
              </Text>
              <Text style={[s.big, { color: t.text }]} numberOfLines={2}>
                {arriveMin ? `${arriveMin} daqiqa` : rideMin ? `~${rideMin} daqiqa`
                  : status === 'driver_arrived' ? 'Chiqing' : status === 'searching' ? 'Qidirilmoqda…'
                    : status === 'no_drivers' ? 'Bo‘sh haydovchi yo‘q' : status === 'cancelled' ? 'Bekor qilindi'
                      : status === 'accepted' ? 'Yo‘lda' : 'Safarda'}
              </Text>
            </View>
            {o?.driver && !bad ? <Plate number={o.driver.car_number} /> : null}
          </View>

          {status === 'cancelled' && o?.cancel_reason ? <T kind="muted">{o.cancel_reason}</T> : null}
          {status === 'searching' ? <T kind="muted">Yaqin haydovchilarga navbat bilan yuborildi</T> : null}

          {o?.driver && !bad ? (
            <View style={[s.driver, { backgroundColor: t.fill }]}>
              <Avatar name={o.driver.name} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.driverName, { color: t.text }]} numberOfLines={1}>{o.driver.name}</Text>
                <Text style={[s.driverCar, { color: t.muted }]} numberOfLines={1}>{o.driver.car_model} · {o.driver.car_color}</Text>
              </View>
              <View style={[s.ratingPill, { backgroundColor: t.card }]}>
                <Icon n="star" filled size={14} color={t.text} />
                <Text style={[s.ratingText, { color: t.text }]}>{Number(o.driver.rating || 5).toFixed(1).replace('.', ',')}</Text>
              </View>
            </View>
          ) : null}

          {o?.driver && active ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Action icon="call" label="Qo‘ng‘iroq" disabled={!o.driver.phone} onPress={() => Linking.openURL(`tel:${o.driver!.phone}`)} />
              <Action icon="chat" label="Xabar" disabled={!o.driver.phone} onPress={() => Linking.openURL(`sms:${o.driver!.phone}`)} />
              <Action icon="shield" label="Xavfsizlik" onPress={share} />
            </View>
          ) : null}

          {o && (status === 'searching' || bad) ? <RouteCard from={o.pickup_address} to={o.dropoff_address} /> : null}

          <ErrorNote error={error} />

          {o ? (
            <View style={s.footer}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.footSub, { color: t.muted }]} numberOfLines={1}>
                  {o.dropoff_address}{o.tariff_name ? ` · ${o.tariff_name}` : ''}
                </Text>
                <Text style={[s.footMain, { color: t.text }]}>{price} · {payText}</Text>
              </View>
              {['searching', 'accepted', 'driver_arrived'].includes(status) ? (
                <Pressable onPress={busy ? undefined : () => setCancelling(true)} style={[s.cancel, { backgroundColor: t.redSoft }]}>
                  {busy ? <ActivityIndicator color={t.redInk} /> : <Text style={[s.cancelText, { color: t.redInk }]}>Bekor qilish</Text>}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {status === 'no_drivers' ? <Button title="Qayta qidirish" icon="repeat" loading={busy} onPress={retry} /> : null}
          {bad ? <Button title="Asosiy sahifa" kind="secondary" onPress={leave} /> : null}
        </ScrollView>
      </View>
      <CancelSheet role="passenger" visible={cancelling} onClose={() => setCancelling(false)} onConfirm={cancel}
        note={status === 'searching' ? undefined : 'Haydovchi allaqachon yo‘lda.'} />
    </View>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [s.action, { borderColor: t.line, backgroundColor: t.card, opacity: disabled ? 0.45 : 1 }, pressed && { opacity: 0.7 }]}>
      <Icon n={icon} size={22} color={t.text} />
      <Text style={[s.actionText, { color: t.text }]}>{label}</Text>
    </Pressable>
  );
}

/** "Safar tugadi": narx, safar ma'lumoti, baho + teglar, onlayn to'lov */
function Finish({ order, onDone }: { order: TaxiOrder; onDone: () => void }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState(order.passenger_rated);
  const online = order.payment_method === 'payme' || order.payment_method === 'click';
  const name = order.driver?.name?.split(' ')[0] || 'Haydovchi';
  const mins = order.started_at && order.completed_at
    ? Math.max(1, Math.round((Date.parse(order.completed_at) - Date.parse(order.started_at)) / 60000)) : order.duration_min;

  const pay = async () => {
    try {
      const r = await api<{ url: string }>(`/payments/${order.payment_method}/create`, {
        method: 'POST', body: { order_id: order.id, orderId: order.id },
      });
      await Linking.openURL(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "To'lovni ochib bo'lmadi");
    }
  };

  const rate = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/ratings', { method: 'POST', body: { order_id: order.id, rating, comment: tags.join(', ') || null, target_role: 'driver' } });
      setRated(true);
      void qc.invalidateQueries({ queryKey: qk.order(order.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: t.card }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 20, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={onDone} hitSlop={8} style={[s.close, { backgroundColor: t.fill }]}><Icon n="close" size={20} /></Pressable>
        </View>

        <View style={{ alignItems: 'center', gap: 10 }}>
          <IconTile n="check" size={64} round bg={t.primary} color={t.onPrimary} iconSize={32} />
          <Text style={[s.doneTitle, { color: t.text }]}>Manzilga yetib keldingiz</Text>
          <Text style={[s.donePrice, { color: t.text }]}>{money(order.final_price || order.estimated_price)}</Text>
          <Text style={[s.doneSub, { color: t.muted }]}>
            {online ? `${PAYMENT[order.payment_method!]} orqali to‘lanadi` : 'Naqd pul bilan to‘lanadi'}
          </Text>
        </View>

        <View style={[s.stats, { backgroundColor: t.fill }]}>
          <Stat label="Masofa" value={order.distance_km ? fmtKm(Number(order.distance_km)) : '—'} />
          <Stat label="Vaqt" value={mins ? `${mins} daq` : '—'} />
          <Stat label="Tarif" value={order.tariff_name || 'Ekonom'} />
        </View>

        {online ? <Button title={`${order.payment_method === 'payme' ? 'Payme' : 'Click'} orqali to'lash`} icon="card" kind="secondary" onPress={pay} /> : null}

        {rated ? (
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
            <T kind="h2">Baho uchun rahmat!</T>
            <T kind="muted">Fikringiz haydovchilarni yaxshilashga yordam beradi</T>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={name} size={40} />
                <Text style={[s.ask, { color: t.text }]}>{name} bilan safar qanday o‘tdi?</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={4} style={s.star} accessibilityLabel={`${n} yulduz`}>
                    <Icon n="star" filled={n <= rating} size={38} color={n <= rating ? t.primary : t.faint} />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <Pressable key={tag} onPress={() => setTags(on ? tags.filter((x) => x !== tag) : [...tags, tag])}
                    style={[s.tag, { borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primarySoft : t.card }]}>
                    <Text style={[s.tagText, { color: t.text }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={{ flex: 1 }} />
        <ErrorNote error={error} />
        {rated ? <Button title="Yopish" onPress={onDone} /> : <Button title="Baholash" loading={busy} onPress={rate} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={[s.statLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[s.statValue, { color: t.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  statusPill: { flex: 1, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  statusText: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '62%', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, elevation: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 24,
  },
  kicker: { fontFamily: font.medium, fontSize: 14 },
  big: { fontFamily: font.heavy, fontSize: 32, letterSpacing: -1 },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  driverName: { fontFamily: font.bold, fontSize: 16 },
  driverCar: { fontFamily: font.medium, fontSize: 13 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16 },
  ratingText: { fontFamily: font.bold, fontSize: 14 },
  action: { flex: 1, height: 64, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionText: { fontFamily: font.semibold, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  footSub: { fontFamily: font.medium, fontSize: 13 },
  footMain: { fontFamily: font.bold, fontSize: 17 },
  cancel: { height: 44, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: font.bold, fontSize: 14 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: font.heavy, fontSize: 24, letterSpacing: -0.5, textAlign: 'center' },
  donePrice: { fontFamily: font.heavy, fontSize: 40, letterSpacing: -1.2 },
  doneSub: { fontFamily: font.medium, fontSize: 14 },
  stats: { flexDirection: 'row', padding: 14, borderRadius: 18 },
  statLabel: { fontFamily: font.medium, fontSize: 12 },
  statValue: { fontFamily: font.bold, fontSize: 16 },
  ask: { fontFamily: font.semibold, fontSize: 16, flexShrink: 1 },
  star: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tag: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center' },
  tagText: { fontFamily: font.semibold, fontSize: 14 },
});
