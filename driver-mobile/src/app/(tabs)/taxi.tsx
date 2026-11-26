import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, Switch, View } from 'react-native';

import { api } from '../../api/client';
import { qk, useDriverActive, useEarnings, useProviderHome, type TaxiOrder } from '../../api/hooks';
import { Badge, Button, Card, Empty, ErrorNote, Icon, Row, Screen, T, money } from '../../components/ui';
import { BOT_URL } from '../../config';
import { callPhone, openNavigator } from '../../lib/navigator';
import { goOffline, goOnline, syncTracking } from '../../lib/taxi';
import { font, useTheme } from '../../theme';

const STEPS: Record<string, { title: string; next?: { path: string; label: string } }> = {
  accepted: { title: "Yo'lovchi oldiga boryapsiz", next: { path: 'arrived', label: 'Yetib keldim' } },
  driver_arrived: { title: "Yetib keldingiz — yo'lovchini kutyapsiz", next: { path: 'start', label: 'Safarni boshlash' } },
  in_progress: { title: 'Safarda', next: { path: 'complete', label: 'Safarni yakunlash' } },
};
const PAYMENT: Record<string, string> = { cash: 'Naqd', click: 'Click', payme: 'Payme', telegram: 'Telegram' };

export default function Taxi() {
  const t = useTheme();
  const qc = useQueryClient();
  const home = useProviderHome();
  const active = useDriverActive();
  const earnings = useEarnings(!!home.data?.taxi);
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
    <Screen refresh={<RefreshControl refreshing={active.isRefetching} onRefresh={refreshAll} tintColor={t.primary} />}>
      <T kind="title">Taksi</T>

      {home.data?.phone_required ? (
        <Card style={{ backgroundColor: t.orangeSoft }}>
          <T color={t.orangeInk}>Onlayn bo'lish uchun telefon raqamingizni tasdiqlang: botda «📱 Raqamni ulashish» tugmasini bosing.</T>
          <Button title="Botni ochish" kind="secondary" icon="send" onPress={() => Linking.openURL(BOT_URL)} />
        </Card>
      ) : null}

      {!order ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T kind="h2">{online ? 'Onlaynsiz' : 'Oflaynsiz'}</T>
              <T kind="muted">{online ? 'Yaqin buyurtmalar sizga taklif qilinadi' : "Buyurtma olish uchun onlayn bo'ling"}</T>
            </View>
            <Switch
              value={online}
              disabled={toggling}
              onValueChange={toggle}
              trackColor={{ true: t.green, false: t.fill }}
              thumbColor="#fff"
            />
          </View>
          {!online ? (
            <Button title="Onlayn bo'lish" icon="taxi" loading={toggling} onPress={() => toggle(true)} />
          ) : null}
          <ErrorNote error={error} />
        </Card>
      ) : (
        <ActiveRide order={order} onDone={(o) => setFinished(o)} onChanged={refreshAll} />
      )}

      {finished ? <RatePassenger order={finished} onClose={() => setFinished(null)} /> : null}

      {taxi ? (
        <Card>
          <Row
            icon="taxi"
            title={`${taxi.car_model} · ${taxi.car_number}`}
            subtitle={`${taxi.car_color} · reyting ${Number(taxi.rating).toFixed(1)}`}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Bugun" value={money(earnings.data?.today_earnings)} />
            <Stat label="Jami safarlar" value={String(earnings.data?.total_rides ?? taxi.total_rides ?? 0)} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.fill, borderRadius: 12, padding: 12, gap: 2 }}>
      <T kind="small">{label}</T>
      <T style={{ fontFamily: font.bold, fontSize: 17 }}>{value}</T>
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
    ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) }
    : { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng) };

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
    <Card style={{ borderWidth: 2, borderColor: t.primary }}>
      <Badge text={`Buyurtma #${order.id}`} tone="brand" />
      <T kind="h2">{step?.title ?? order.status}</T>
      <Row
        icon="profile"
        title={order.passenger_name || "Yo'lovchi"}
        subtitle={order.passenger_rating ? `★ ${Number(order.passenger_rating).toFixed(1)}` : undefined}
        right={
          order.passenger_phone ? (
            <Pressable onPress={() => callPhone(order.passenger_phone!)} hitSlop={10} style={{ backgroundColor: t.greenSoft, borderRadius: 12, padding: 10 }}>
              <Icon n="phone" size={20} color={t.greenInk} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ gap: 6 }}>
        <T kind="muted">📍 {order.pickup_address}</T>
        <T kind="muted">🏁 {order.dropoff_address}</T>
        <T kind="small">
          {[money(order.estimated_price), PAYMENT[order.payment_method] ?? order.payment_method,
            order.distance_km ? `${Number(order.distance_km).toFixed(1)} km` : null].filter(Boolean).join(' · ')}
        </T>
      </View>
      <Button
        title={toPickup ? "Navigator: yo'lovchi oldiga" : 'Navigator: manzilga'}
        kind="secondary"
        icon="pin"
        onPress={() => openNavigator(target.lat, target.lng)}
      />
      {step?.next ? <Button title={step.next.label} icon="check" loading={busy} onPress={next} style={{ height: 58 }} /> : null}
      <ErrorNote error={error} />
      {order.status !== 'in_progress' ? <Button title="Bekor qilish" kind="ghost" onPress={cancel} /> : null}
    </Card>
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
    <Card>
      <T kind="h2">Safar yakunlandi ✅</T>
      <T kind="muted">{money(order.estimated_price)} · {PAYMENT[order.payment_method] ?? order.payment_method}</T>
      {sent ? (
        <T color={t.greenInk}>Rahmat!</T>
      ) : (
        <>
          <T>Yo'lovchini baholang</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => rate(n)} hitSlop={6} style={{ padding: 6 }}>
                <T style={{ fontSize: 34 }} color={t.orange}>★</T>
              </Pressable>
            ))}
          </View>
          <Button title="O'tkazib yuborish" kind="ghost" onPress={onClose} />
        </>
      )}
    </Card>
  );
}
