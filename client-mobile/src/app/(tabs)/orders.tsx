import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { useBookings, useMyRequests, useRides } from '../../api/hooks';
import { Badge, Card, Empty, money, Screen, T } from '../../components/ui';
import { BOOKING_STATUS, fmtDateTime, ORDER_STATUS, REQUEST_STATUS } from '../../lib/format';
import { font, useTheme } from '../../theme';

type Tab = 'taxi' | 'requests' | 'carpool';

const TABS: [Tab, string][] = [['taxi', 'Taksi'], ['requests', 'Yuk / texnika'], ['carpool', "Po'puti"]];

/** Barcha xizmatlar bo'yicha buyurtmalar — Web App'da berilganlari ham shu yerda (bitta akkaunt) */
export default function Orders() {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('taxi');
  const rides = useRides();
  const requests = useMyRequests();
  const bookings = useBookings();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([rides.refetch(), requests.refetch(), bookings.refetch()]);
    setRefreshing(false);
  };

  const rideList = rides.data ?? [];
  const reqList = requests.data ?? [];
  const bookList = bookings.data ?? [];

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[t.primary]} />}>
      <T kind="title">Buyurtmalarim</T>
      <View style={{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: 12, padding: 3 }}>
        {TABS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: tab === k ? t.card : 'transparent' }}>
            <T style={{ fontFamily: tab === k ? font.bold : font.medium }}>{label}</T>
          </Pressable>
        ))}
      </View>

      {tab === 'taxi' && (rideList.length ? rideList.map((o) => (
        <Card key={o.id} onPress={() => router.push({ pathname: '/ride/[id]', params: { id: String(o.id) } })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T kind="small">{fmtDateTime(o.created_at)}</T>
            <Badge text={ORDER_STATUS[o.status]?.text ?? o.status} tone={ORDER_STATUS[o.status]?.tone ?? 'neutral'} />
          </View>
          <T numberOfLines={1}>{o.pickup_address}</T>
          <T kind="muted" numberOfLines={1}>→ {o.dropoff_address}</T>
          <T style={{ fontFamily: font.bold, color: t.primary }}>{money(o.final_price || o.estimated_price)}</T>
        </Card>
      )) : <Empty icon="taxi" title="Taksi buyurtmalari yo'q" text="Asosiy sahifadan taksi chaqiring" />)}

      {tab === 'requests' && (reqList.length ? reqList.map((r) => (
        <Card key={r.id} onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(r.id) } })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T kind="h2" numberOfLines={1} style={{ flex: 1 }}>{r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Maxsus texnika')}</T>
            <Badge text={REQUEST_STATUS[r.status]?.text ?? r.status} tone={REQUEST_STATUS[r.status]?.tone ?? 'neutral'} />
          </View>
          <T kind="muted" numberOfLines={1}>{r.from_address}{r.to_address ? ` → ${r.to_address}` : ''}</T>
          <T kind="small">{fmtDateTime(r.created_at)}{r.status === 'open' ? ` · ${r.offers_count || 0} ta taklif` : ''}</T>
        </Card>
      )) : <Empty icon="truck" title="So'rovlar yo'q" text="Yuk tashish yoki maxsus texnika uchun so'rov yarating" />)}

      {tab === 'carpool' && (bookList.length ? bookList.map((b) => (
        <Card key={b.id} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(b.trip_id) } })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T kind="h2">{fmtDateTime(b.departure_at)}</T>
            <Badge text={BOOKING_STATUS[b.status]?.text ?? b.status} tone={BOOKING_STATUS[b.status]?.tone ?? 'neutral'} />
          </View>
          <T kind="muted" numberOfLines={1}>{b.from_address} → {b.to_address}</T>
          <T kind="small">{b.driver_name} · {b.seats} o'rin · {money(Number(b.price_per_seat) * b.seats)}</T>
        </Card>
      )) : <Empty icon="carpool" title="Bronlar yo'q" text="Po'puti bo'limida qatnov qidiring" />)}
    </Screen>
  );
}
