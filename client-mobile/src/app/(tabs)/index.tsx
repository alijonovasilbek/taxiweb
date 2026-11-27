import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActiveOrder, useBookings, useCatalog, useMe, useMyRequests, useUnread } from '../../api/hooks';
import { Badge, Card, Icon, T } from '../../components/ui';
import { BOOKING_STATUS, fmtDateTime, ORDER_STATUS, REQUEST_STATUS } from '../../lib/format';
import { font, radius, useTheme } from '../../theme';

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const active = useActiveOrder();
  const unread = useUnread();
  const catalog = useCatalog();
  const requests = useMyRequests();
  const bookings = useBookings();
  const [refreshing, setRefreshing] = useState(false);

  const on = (code: string) => !catalog.data || catalog.data.services.some((s) => s.code === code && s.is_active);
  const openReqs = (requests.data ?? []).filter((r) => ['open', 'assigned', 'in_progress'].includes(r.status));
  const openBookings = (bookings.data ?? []).filter((b) => ['pending', 'confirmed'].includes(b.status));
  const order = active.data;
  const hour = new Date().getHours();
  const hello = hour < 11 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[t.primary]} />}
      >
        <View style={[s.hero, { backgroundColor: t.hero }]}>
          <View style={s.heroTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.logo}><Text style={s.logoText}>C</Text></View>
              <Text style={s.brand}>Chortoq</Text>
            </View>
            <Pressable onPress={() => router.push('/notifications')} style={s.bell} hitSlop={8}>
              <Icon n="bell" size={20} color="#fff" />
              {unread.data?.unread ? (
                <View style={s.dot}><Text style={s.dotText}>{unread.data.unread > 99 ? '99+' : unread.data.unread}</Text></View>
              ) : null}
            </Pressable>
          </View>
          <Text style={s.hello}>{hello},</Text>
          <Text style={s.name} numberOfLines={1}>{me.data?.first_name || 'mehmon'}</Text>
        </View>

        {order ? (
          <Card onPress={() => router.push({ pathname: '/ride/[id]', params: { id: String(order.id) } })}
            style={{ borderLeftWidth: 4, borderLeftColor: t.primary }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T kind="h2">Faol taksi buyurtmasi</T>
              <Badge text={ORDER_STATUS[order.status]?.text ?? order.status} tone={ORDER_STATUS[order.status]?.tone ?? 'brand'} />
            </View>
            <T kind="muted" numberOfLines={1}>{order.pickup_address} → {order.dropoff_address}</T>
          </Card>
        ) : null}

        {on('taxi') ? (
          <Pressable
            onPress={() => router.push(order ? { pathname: '/ride/[id]', params: { id: String(order.id) } } : '/taxi')}
            style={({ pressed }) => [s.taxi, { backgroundColor: t.primary }, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.taxiTitle}>Taksi</Text>
              <Text style={s.taxiSub}>Qayerga boramiz?</Text>
            </View>
            <View style={s.taxiIcon}><Icon n="taxi" size={40} color="#fff" stroke={1.8} /></View>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {on('carpool') ? (
            <Tile title="Po'puti" text="Shaharlararo qatnovda joy bron qilish" icon="carpool" color="#248a3d" onPress={() => router.push('/carpool')} />
          ) : null}
          {on('cargo') ? (
            <Tile title="Yuk tashish" text="Labo, Gazel, Isuzu" icon="truck" color="#0a6fc2"
              onPress={() => router.push({ pathname: '/request/new', params: { service: 'cargo' } })} />
          ) : null}
        </View>
        {on('equipment') ? (
          <Card onPress={() => router.push({ pathname: '/request/new', params: { service: 'equipment' } })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.tileIcon, { backgroundColor: '#c93400' }]}><Icon n="equipment" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <T kind="h2">Maxsus texnika</T>
                <T kind="small">Ekskavator, kran, yuklagich va boshqalar</T>
              </View>
              <Icon n="next" size={18} color={t.faint} />
            </View>
          </Card>
        ) : null}

        {openReqs.length || openBookings.length ? <T kind="label" style={{ marginTop: 6 }}>Faol buyurtmalarim</T> : null}
        {openReqs.slice(0, 3).map((r) => (
          <Card key={`r${r.id}`} onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(r.id) } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T kind="h2" numberOfLines={1} style={{ flex: 1 }}>{r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Maxsus texnika')}</T>
              <Badge text={REQUEST_STATUS[r.status]?.text ?? r.status} tone={REQUEST_STATUS[r.status]?.tone ?? 'neutral'} />
            </View>
            <T kind="muted" numberOfLines={1}>{r.from_address}{r.to_address ? ` → ${r.to_address}` : ''}</T>
            {r.status === 'open' ? <T kind="small">{r.offers_count || 0} ta taklif</T> : null}
          </Card>
        ))}
        {openBookings.slice(0, 2).map((b) => (
          <Card key={`b${b.id}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(b.trip_id) } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T kind="h2">Po'puti · {fmtDateTime(b.departure_at)}</T>
              <Badge text={BOOKING_STATUS[b.status]?.text ?? b.status} tone={BOOKING_STATUS[b.status]?.tone ?? 'neutral'} />
            </View>
            <T kind="muted" numberOfLines={1}>{b.from_address} → {b.to_address}</T>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ title, text, icon, color, onPress }: { title: string; text: string; icon: string; color: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, { backgroundColor: t.card }, pressed && { opacity: 0.7 }]}>
      <View style={[s.tileIcon, { backgroundColor: color }]}><Icon n={icon} size={20} color="#fff" /></View>
      <T kind="h2">{title}</T>
      <T kind="small">{text}</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, gap: 2 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#8c1c3a', fontFamily: font.heavy, fontSize: 20 },
  brand: { color: '#fff', fontFamily: font.bold, fontSize: 17 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ffcc00', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#000', fontFamily: font.bold, fontSize: 10 },
  hello: { color: 'rgba(255,255,255,0.78)', fontFamily: font.medium, fontSize: 15 },
  name: { color: '#fff', fontFamily: font.heavy, fontSize: 28 },
  taxi: { borderRadius: radius.lg, padding: 20, minHeight: 120, flexDirection: 'row', alignItems: 'center' },
  taxiTitle: { color: '#fff', fontFamily: font.heavy, fontSize: 26 },
  taxiSub: { color: 'rgba(255,255,255,0.85)', fontFamily: font.semibold, fontSize: 15 },
  taxiIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, borderRadius: radius.lg, padding: 16, gap: 6 },
  tileIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
