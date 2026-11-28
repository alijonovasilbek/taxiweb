/**
 * Taksi — dizayndagi "Haydovchi: buyurtma" ekrani: to'liq xarita, tepada "Liniyada" kalit va bugungi daromad,
 * pastda suzuvchi karta: kutish holati yoki faol safar (yo'lovchi, yo'nalish, navigator, keyingi qadam).
 * Yangi buyurtma taklifi OfferOverlay'da (xarita ustida karta) ko'rsatiladi.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../api/client';
import { qk, useDriverActive, useEarnings, useProviderHome, type TaxiOrder } from '../../api/hooks';
import { MapView, type LatLng, type MapHandle, type MapMarker } from '../../components/MapView';
import { Avatar, Button, Card, Empty, ErrorNote, Icon, IconTile, MapFab, RouteCard, Screen, T, money } from '../../components/ui';
import { BOT_URL } from '../../config';
import { callPhone, openNavigator } from '../../lib/navigator';
import { goOffline, goOnline, syncTracking } from '../../lib/taxi';
import { font, useTheme } from '../../theme';

const STEPS: Record<string, { title: string; next?: { path: string; label: string } }> = {
  accepted: { title: "Yo'lovchi oldiga", next: { path: 'arrived', label: 'Yetib keldim' } },
  driver_arrived: { title: "Yo'lovchini kutyapsiz", next: { path: 'start', label: 'Safarni boshlash' } },
  in_progress: { title: 'Safarda', next: { path: 'complete', label: 'Safarni yakunlash' } },
};
const PAYMENT: Record<string, string> = { cash: 'Naqd pul', click: 'Click', payme: 'Payme', telegram: 'Telegram' };
const num = (v: string | number | null | undefined) => Number(v ?? NaN);

export default function Taxi() {
  const t = useTheme();
  const qc = useQueryClient();
  const home = useProviderHome();
  const active = useDriverActive();
  const earnings = useEarnings(!!home.data?.taxi);
  const me = useQuery({ queryKey: ['driver-me'], queryFn: () => api<{ tariff_name?: string }>('/drivers/me'), enabled: !!home.data?.taxi });
  const map = useRef<MapHandle>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [cardH, setCardH] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<TaxiOrder | null>(null);

  const taxi = home.data?.taxi;
  const online = active.data?.driver?.is_online ?? taxi?.is_online ?? false;
  const order = active.data?.order ?? null;

  // Ilova qayta ochilganda serverdagi holat bilan fon GPS'ni moslaymiz
  useEffect(() => {
    if (active.data?.driver) void syncTracking(active.data.driver.is_online);
  }, [active.data?.driver]);

  // Xaritadagi o'z joylashuvim (faqat ekran ochiq paytda; serverga yuborish — fon vazifasida)
  const centered = useRef(false);
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let dead = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted' || dead) return;
      const last = await Location.getLastKnownPositionAsync();
      if (last && !dead) setHere({ lat: last.coords.latitude, lng: last.coords.longitude });
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 5000 },
        (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }));
      if (dead) sub.remove();
    })().catch(() => undefined);
    return () => {
      dead = true;
      sub?.remove();
    };
  }, []);
  useEffect(() => {
    if (here && !centered.current && !order) {
      centered.current = true;
      map.current?.center(here, 15, false);
    }
  }, [here, order]);
  useEffect(() => {
    if (cardH) map.current?.margin(cardH + 12);
  }, [cardH]);

  // Faol safar: marshrut (olib ketish → manzil) va hammasini ko'rinishga sig'dirish
  // Marshrut buyurtma raqami bilan saqlanadi: buyurtma tugasa — o'zi yo'qoladi (effektda setState shart emas)
  const [routeOf, setRouteOf] = useState<{ id: number; pts: [number, number][] } | null>(null);
  const route = order && routeOf?.id === order.id ? routeOf.pts : null;
  const routeFor = useRef<number | null>(null);
  useEffect(() => {
    if (!order || routeFor.current === order.id) return;
    routeFor.current = order.id;
    setTimeout(() => map.current?.fit(cardH + 40), 400);
    api<{ polyline?: { lat: number; lng: number }[]; approx?: boolean }>('/maps/route', {
      query: { fromLat: num(order.pickup_lat), fromLng: num(order.pickup_lng), toLat: num(order.dropoff_lat), toLng: num(order.dropoff_lng) },
    })
      .then((r) => {
        if (!r.approx && r.polyline && r.polyline.length > 2) setRouteOf({ id: order.id, pts: r.polyline.map((p) => [p.lat, p.lng]) });
      })
      .catch(() => undefined);
  }, [order, cardH]);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (here) m.push({ id: 'me', type: 'driver', ...here });
    if (order) {
      m.push({ id: 'pickup', type: 'pickup', lat: num(order.pickup_lat), lng: num(order.pickup_lng) });
      m.push({ id: 'dropoff', type: 'dropoff', lat: num(order.dropoff_lat), lng: num(order.dropoff_lng) });
    }
    return m;
  }, [here, order]);

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: qk.driverActive });
    void qc.invalidateQueries({ queryKey: qk.home });
    void qc.invalidateQueries({ queryKey: qk.earnings });
  };

  const toggle = async (v: boolean) => {
    setError(null);
    setToggling(true);
    try {
      if (v) await goOnline();
      else await goOffline();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setToggling(false);
      refreshAll();
    }
  };

  if (home.data && !taxi) {
    return (
      <Screen>
        <T kind="title">Taksi</T>
        <Card>
          <Empty icon="taxi" title="Taksi transporti tasdiqlanmagan" text="Yengil avtomobil yoki miniven qo'shing, hujjatlarni yuklang va admin tasdiqlashini kuting." />
        </Card>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.map }}>
      <MapView ref={map} initial={here} markers={markers} route={route} />

      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        <Pressable onPress={() => !toggling && !order && toggle(!online)} style={[s.pill, { backgroundColor: t.card }]}>
          {toggling ? <ActivityIndicator size="small" color={t.primary} /> : (
            <View style={[s.switch, { backgroundColor: online ? t.green : t.grabber }]}>
              <View style={[s.knob, online ? { right: 3 } : { left: 3 }]} />
            </View>
          )}
          <Text style={[s.pillText, { color: t.text }]}>{online ? 'Liniyada' : 'Oflayn'}</Text>
        </Pressable>
        <View style={[s.pill, { backgroundColor: t.ink, paddingHorizontal: 16 }]}>
          <Text style={[s.pillSub, { color: t.scheme === 'dark' ? '#5f5f5f' : '#cfcfcf' }]}>Bugun</Text>
          <Text style={[s.pillText, { color: t.onInk }]}>{money(earnings.data?.today_earnings ?? home.data?.earnings_today)}</Text>
        </View>
      </SafeAreaView>

      {here ? (
        <MapFab icon="locate" onPress={() => map.current?.center(here, 16)} style={[s.locate, { bottom: cardH + 24 }]} />
      ) : null}

      <View onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))} style={[s.card, { backgroundColor: t.card }]}>
        <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false} bounces={false}>
          {home.data?.phone_required ? (
            <View style={{ gap: 10 }}>
              <T color={t.orangeInk}>Onlayn bo'lish uchun telefon raqamingizni tasdiqlang: botda «📱 Raqamni ulashish» tugmasini bosing.</T>
              <Button title="Botni ochish" kind="secondary" icon="send" onPress={() => Linking.openURL(BOT_URL)} />
            </View>
          ) : null}

          {finished ? <RatePassenger order={finished} onClose={() => setFinished(null)} /> : order ? (
            <ActiveRide order={order} onDone={(o) => setFinished(o)} onChanged={refreshAll} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile n="taxi" size={48} iconSize={24} bg={online ? t.greenSoft : t.fill} color={online ? t.greenInk : t.text} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.h, { color: t.text }]}>{online ? 'Buyurtmalar kutilmoqda' : 'Siz oflaynsiz'}</Text>
                  <Text style={[s.sub, { color: t.muted }]} numberOfLines={1}>
                    {taxi ? `${taxi.car_model} · ${taxi.car_number}${me.data?.tariff_name ? ` · ${me.data.tariff_name}` : ''}` : '…'}
                  </Text>
                </View>
                {online ? <ActivityIndicator color={t.primary} /> : null}
              </View>
              <ErrorNote error={error} />
              {online ? (
                <Button title="Liniyadan chiqish" kind="secondary" loading={toggling} onPress={() => toggle(false)} />
              ) : (
                <Button title="Liniyaga chiqish" loading={toggling} onPress={() => toggle(true)} />
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ActiveRide({ order, onDone, onChanged }: { order: TaxiOrder; onDone: (o: TaxiOrder) => void; onChanged: () => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = STEPS[order.status];
  const toPickup = order.status === 'accepted' || order.status === 'driver_arrived';
  const target = toPickup
    ? { lat: num(order.pickup_lat), lng: num(order.pickup_lng) }
    : { lat: num(order.dropoff_lat), lng: num(order.dropoff_lng) };

  const next = async () => {
    if (!step?.next) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/orders/${order.id}/${step.next.path}`, { method: 'PUT' });
      if (step.next.path === 'complete') onDone(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const cancel = () =>
    Alert.alert('Buyurtmani bekor qilish', "Yo'lovchiga xabar boradi. Tez-tez bekor qilish reytingga ta'sir qiladi.", [
      { text: 'Yo‘q', style: 'cancel' },
      {
        text: 'Bekor qilish',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/orders/${order.id}/cancel`, { method: 'PUT', query: { as_driver: true }, body: { reason: 'Haydovchi bekor qildi' } });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Xatolik');
          }
          onChanged();
        },
      },
    ]);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={[s.chip, { backgroundColor: t.primary }]}><Text style={[s.chipText, { color: t.onPrimary }]}>{(step?.title ?? order.status).toUpperCase()}</Text></View>
        <Text style={[s.price, { color: t.text }]}>{money(order.estimated_price)}</Text>
      </View>

      <View style={[s.passenger, { backgroundColor: t.fill }]}>
        <Avatar name={order.passenger_name || "Yo'lovchi"} size={44} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[s.h, { color: t.text, fontSize: 16 }]} numberOfLines={1}>{order.passenger_name || "Yo'lovchi"}</Text>
          <Text style={[s.sub, { color: t.muted }]}>
            {order.passenger_rating ? `★ ${Number(order.passenger_rating).toFixed(1)} · ` : ''}{PAYMENT[order.payment_method] ?? order.payment_method}
          </Text>
        </View>
        {order.passenger_phone ? (
          <Pressable onPress={() => callPhone(order.passenger_phone!)} hitSlop={8} style={[s.call, { backgroundColor: t.green }]}>
            <Icon n="call" size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <RouteCard from={order.pickup_address} to={order.dropoff_address}
        toSub={order.distance_km ? `Safar ${Number(order.distance_km).toFixed(1).replace('.', ',')} km${order.duration_min ? ` · ${order.duration_min} daq` : ''}` : undefined} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Navigator" kind="secondary" icon="nav" onPress={() => openNavigator(target.lat, target.lng)} style={{ width: 140 }} />
        {step?.next ? <Button title={step.next.label} loading={busy} onPress={next} style={{ flex: 1 }} /> : null}
      </View>
      <ErrorNote error={error} />
      {order.status !== 'in_progress' ? <Button title="Bekor qilish" kind="ghost" onPress={cancel} style={{ height: 44 }} /> : null}
    </View>
  );
}

function RatePassenger({ order, onClose }: { order: TaxiOrder; onClose: () => void }) {
  const t = useTheme();
  const [sent, setSent] = useState(false);
  const rate = async (n: number) => {
    try {
      await api('/ratings', { method: 'POST', body: { order_id: order.id, rating: n, target_role: 'passenger' } });
    } catch {
      // takroriy baho (409) — e'tiborsiz
    }
    setSent(true);
    setTimeout(onClose, 1200);
  };
  return (
    <View style={{ gap: 12, alignItems: 'center' }}>
      <IconTile n="check" size={56} round bg={t.primary} color={t.onPrimary} iconSize={28} />
      <Text style={[s.h, { color: t.text, fontSize: 20 }]}>Safar yakunlandi</Text>
      <Text style={[s.price, { color: t.text }]}>{money(order.estimated_price)}</Text>
      <Text style={[s.sub, { color: t.muted }]}>{PAYMENT[order.payment_method] ?? order.payment_method}</Text>
      {sent ? (
        <T color={t.greenInk}>Rahmat!</T>
      ) : (
        <>
          <T>Yo'lovchini baholang</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => rate(n)} hitSlop={4} style={{ padding: 4 }}>
                <Icon n="star" filled size={36} color={t.primary} />
              </Pressable>
            ))}
          </View>
          <Button title="O'tkazib yuborish" kind="ghost" onPress={onClose} style={{ alignSelf: 'stretch', height: 44 }} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 16 },
  pill: { height: 48, borderRadius: 24, paddingLeft: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10 },
  pillText: { fontFamily: font.bold, fontSize: 15 },
  pillSub: { fontFamily: font.medium, fontSize: 13 },
  switch: { width: 36, height: 22, borderRadius: 11 },
  knob: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  locate: { position: 'absolute', right: 16 },
  card: { position: 'absolute', left: 12, right: 12, bottom: 12, maxHeight: '70%', borderRadius: 28, padding: 20, elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 32, shadowOffset: { width: 0, height: 8 } },
  h: { fontFamily: font.heavy, fontSize: 18 },
  sub: { fontFamily: font.medium, fontSize: 13 },
  chip: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  chipText: { fontFamily: font.heavy, fontSize: 12, letterSpacing: 0.5 },
  price: { fontFamily: font.heavy, fontSize: 26, letterSpacing: -0.8 },
  passenger: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  call: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
