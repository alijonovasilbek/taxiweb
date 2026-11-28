/**
 * Safar kuzatuvi: holat (qidiruv → haydovchi yo'lda → keldi → safarda → yakun), haydovchi xaritada real vaqtda,
 * qo'ng'iroq, bekor qilish, "haydovchi topilmadi"da qayta qidirish, yakunda to'lov (Payme/Click) va baho.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../api/client';
import { ACTIVE_STATUSES, qk, useOrder, type TaxiOrder } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { Input } from '../../components/form';
import { MapView, type LatLng, type MapHandle, type MapMarker } from '../../components/MapView';
import { Badge, Button, ErrorNote, Glass, Icon, money, T } from '../../components/ui';
import { PAYMENT } from '../../lib/format';
import { font, radius, useTheme } from '../../theme';

const INFO: Record<string, { title: string; sub?: string; icon: string }> = {
  searching: { title: 'Haydovchi qidirilmoqda…', sub: 'Yaqin haydovchilarga navbat bilan yuborildi', icon: 'search' },
  accepted: { title: "Haydovchi yo'lingizga kelmoqda", icon: 'taxi' },
  driver_arrived: { title: 'Haydovchi yetib keldi', sub: 'Chiqishingiz mumkin', icon: 'pin' },
  in_progress: { title: 'Safar davom etmoqda', sub: "Yo'lingiz bexatar bo'lsin", icon: 'nav' },
  completed: { title: 'Safar yakunlandi', icon: 'check' },
  no_drivers: { title: 'Haydovchi topilmadi', sub: "Hozir yaqin atrofda bo'sh haydovchi yo'q", icon: 'close' },
  cancelled: { title: 'Buyurtma bekor qilindi', icon: 'close' },
};

const FINISHED_SET = new Set(['cancelled', 'no_drivers']);
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? NaN : Number(v));

/** To'g'ri chiziq masofasi (km) — haydovchi kelish vaqtini taxmin qilish uchun */
function km(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

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

  // Birinchi yuklanishda hammasini ko'rinishga sig'diramiz
  const fitted = useRef(false);
  useEffect(() => {
    if (o && !fitted.current) {
      fitted.current = true;
      setTimeout(() => map.current?.fit(60), 300);
    }
  }, [o]);

  const cancel = () =>
    Alert.alert('Buyurtmani bekor qilasizmi?', status === 'searching' ? '' : 'Haydovchi allaqachon yo‘lda.', [
      { text: "Yo'q", style: 'cancel' },
      {
        text: 'Bekor qilish', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await api(`/orders/${orderId}/cancel`, { method: 'PUT', body: { reason: "Yo'lovchi bekor qildi" } });
            void qc.invalidateQueries({ queryKey: qk.activeOrder });
            router.replace('/(tabs)');
          } catch (e) {
            setError(e instanceof Error ? e.message : "Bekor qilib bo'lmadi");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

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

  const info = INFO[status] ?? INFO.searching;
  // Haydovchi yo'lda: shahar ichida ~25 km/soat (yo'l to'g'ri chiziqdan ~1,4 marta uzun)
  const arriveMin = status === 'accepted' && driverLoc && pickup && !Number.isNaN(pickup.lat)
    ? Math.max(1, Math.round((km(driverLoc, pickup) * 1.4) / 25 * 60)) : null;
  const tone = status === 'completed' || status === 'driver_arrived' ? t.green : ['no_drivers', 'cancelled'].includes(status) ? t.red : t.primary;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ height: '56%' }}>
        <MapView ref={map} initial={pickup && !Number.isNaN(pickup.lat) ? pickup : null} markers={markers}
          route={FINISHED_SET.has(status) ? null : route} />
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, padding: 12 }}>
          <Pressable onPress={leave} hitSlop={8}>
            <Glass strong rounded={23} style={s.fab}><Icon n="back" size={22} /></Glass>
          </Pressable>
        </SafeAreaView>
        {driverLoc && active ? (
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0, padding: 12 }}>
            <Pressable onPress={() => map.current?.center(driverLoc, 16)} hitSlop={8}>
              <Glass strong rounded={23} style={s.fab}><Icon n="taxi" size={21} color={t.primary} /></Glass>
            </Pressable>
          </SafeAreaView>
        ) : null}
      </View>

      <ScrollView style={[s.sheet, { backgroundColor: t.sheet }]} contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 14, paddingBottom: 24 + insets.bottom }}>
        <View style={[s.grabber, { backgroundColor: t.line }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[s.statusIcon, { backgroundColor: tone + '22' }]}>
            {status === 'searching' ? <ActivityIndicator color={tone} /> : <Icon n={info.icon} size={22} color={tone} />}
          </View>
          <View style={{ flex: 1 }}>
            <T kind="h2" style={{ fontSize: 20 }}>{arriveMin ? `~${arriveMin} daqiqada keladi` : info.title}</T>
            {arriveMin ? <T kind="small">Haydovchi yo'lingizga kelmoqda</T> : info.sub ? <T kind="small">{info.sub}</T> : null}
            {status === 'cancelled' && o?.cancel_reason ? <T kind="small">{o.cancel_reason}</T> : null}
          </View>
          {o ? <T style={{ fontFamily: font.heavy, color: t.primary, fontSize: 17 }}>{money(o.final_price || o.estimated_price)}</T> : null}
        </View>

        {o ? (
          <View style={{ borderRadius: radius.md, backgroundColor: t.fill, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[s.dot, { backgroundColor: t.green }]} /><T numberOfLines={1} style={{ flex: 1 }}>{o.pickup_address}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[s.dot, { backgroundColor: t.red }]} /><T numberOfLines={1} style={{ flex: 1 }}>{o.dropoff_address}</T>
            </View>
            <T kind="small">
              {o.distance_km ? `${Number(o.distance_km).toFixed(1)} km · ` : ''}{PAYMENT[o.payment_method || 'cash'] ?? o.payment_method}
            </T>
          </View>
        ) : null}

        {o?.driver && status !== 'cancelled' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.fill, borderRadius: 18, padding: 12 }}>
            <View style={[s.avatar, { backgroundColor: t.primary }]}><Icon n="taxi" size={22} color="#fff" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontFamily: font.bold }}>{o.driver.name}</T>
              <T kind="small">{o.driver.car_color} {o.driver.car_model}</T>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={[s.plate, { borderColor: t.text }]}><T style={{ fontFamily: font.heavy, fontSize: 13 }}>{o.driver.car_number}</T></View>
                <T kind="small">★ {Number(o.driver.rating || 5).toFixed(1)}</T>
              </View>
            </View>
            {o.driver.phone && active ? (
              <Pressable onPress={() => Linking.openURL(`tel:${o.driver!.phone}`)} style={[s.call, { backgroundColor: t.green }]}>
                <Icon n="call" size={22} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ErrorNote error={error} />

        {status === 'no_drivers' ? <Button title="Qayta qidirish" icon="repeat" loading={busy} onPress={retry} /> : null}
        {status === 'completed' && o ? <Finish order={o} onDone={leave} /> : null}
        {['searching', 'accepted', 'driver_arrived'].includes(status) ? (
          <Button title="Buyurtmani bekor qilish" kind="danger" loading={busy} onPress={cancel} />
        ) : null}
        {['no_drivers', 'cancelled'].includes(status) || status === 'searching' ? (
          <Button title={status === 'searching' ? 'Orqaga (qidiruv davom etadi)' : 'Asosiy sahifa'} kind="ghost" onPress={leave} />
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Yakun: onlayn to'lov (Payme/Click tanlangan bo'lsa) va haydovchiga baho */
function Finish({ order, onDone }: { order: TaxiOrder; onDone: () => void }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState(order.passenger_rated);
  const online = order.payment_method === 'payme' || order.payment_method === 'click';

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
      await api('/ratings', { method: 'POST', body: { order_id: order.id, rating, comment: comment || null, target_role: 'driver' } });
      setRated(true);
      void qc.invalidateQueries({ queryKey: qk.order(order.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {online ? <Button title={`${order.payment_method === 'payme' ? 'Payme' : 'Click'} orqali to'lash`} icon="card" kind="secondary" onPress={pay} /> : null}
      {rated ? (
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
          <Badge text="Baho uchun rahmat!" tone="green" />
        </View>
      ) : (
        <>
          <T kind="label">Haydovchini baholang</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Icon n="star" size={38} color={n <= rating ? '#ff9f0a' : t.faint} />
              </Pressable>
            ))}
          </View>
          <Input value={comment} onChangeText={setComment} placeholder="Izoh (ixtiyoriy)" multiline maxLength={300} />
          <ErrorNote error={error} />
          <Button title="Baholash" icon="star" loading={busy} onPress={rate} />
        </>
      )}
      <Button title="Asosiy sahifa" kind="ghost" onPress={onDone} />
    </View>
  );
}

const s = StyleSheet.create({
  fab: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  sheet: { flex: 1, marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, elevation: 14 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 2 },
  statusIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  plate: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  call: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
