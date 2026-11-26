import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useProviderHome } from '../../api/hooks';
import { Badge, Button, Card, Empty, ErrorNote, Icon, Row, Screen, T, money } from '../../components/ui';
import { SERVICE_NAMES } from '../../lib/catalog';
import { font, radius, useTheme } from '../../theme';

const ORDER_STATUS: Record<string, string> = {
  accepted: "Yo'lovchi oldiga boryapsiz",
  driver_arrived: 'Yetib keldingiz — kutyapsiz',
  in_progress: 'Safarda',
};

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const { data, error, isLoading, isRefetching, refetch } = useProviderHome();

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Xayrli tun' : hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <View style={[s.hero, { backgroundColor: t.hero }]}>
        <Text style={s.heroSmall}>{greet},</Text>
        <Text style={s.heroName}>{data?.user.first_name ?? '…'}</Text>
        <View style={s.heroStats}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Bugungi daromad</Text>
            <Text style={s.statValue}>{money(data?.earnings_today)}</Text>
          </View>
          {data?.taxi ? (
            <View style={s.stat}>
              <Text style={s.statLabel}>Taksi</Text>
              <Text style={s.statValue}>{data.taxi.is_online ? '🟢 Onlayn' : '⚪️ Oflayn'}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ErrorNote error={error} />

      {data?.active_order ? (
        <Card onPress={() => router.push('/taxi')} style={{ borderWidth: 2, borderColor: t.primary }}>
          <Badge text="Faol buyurtma" tone="brand" />
          <T kind="h2">{ORDER_STATUS[data.active_order.status] ?? data.active_order.status}</T>
          <T kind="muted" numberOfLines={1}>📍 {data.active_order.pickup_address}</T>
          <T kind="muted" numberOfLines={1}>🏁 {data.active_order.dropoff_address}</T>
        </Card>
      ) : null}

      {data && data.new_requests > 0 ? (
        <Card onPress={() => router.push('/requests')}>
          <Row icon="requests" title={`Yangi so'rovlar: ${data.new_requests}`} subtitle="Sizning transportingizga mos" onPress={() => router.push('/requests')} />
        </Card>
      ) : null}

      {data?.active_jobs.length ? (
        <Card>
          <T kind="label">Ishlarim</T>
          {data.active_jobs.map((j) => (
            <Row
              key={j.id}
              icon={j.service_type === 'equipment' ? 'equipment' : 'truck'}
              title={j.title || SERVICE_NAMES[j.service_type] || "So'rov"}
              subtitle={j.from_address}
              right={<Badge text={j.status === 'in_progress' ? 'Jarayonda' : 'Tanlangan'} tone={j.status === 'in_progress' ? 'green' : 'orange'} />}
            />
          ))}
        </Card>
      ) : null}

      {data?.carpool_trips.length ? (
        <Card>
          <T kind="label">Qatnovlarim</T>
          {data.carpool_trips.map((tr) => (
            <Row
              key={tr.id}
              icon="carpool"
              title={`${tr.from_address} → ${tr.to_address}`}
              subtitle={`${new Date(tr.departure_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · bo'sh joy: ${tr.seats_available}/${tr.seats_total}`}
              right={tr.pending_bookings ? <Badge text={`${tr.pending_bookings} bron`} tone="orange" /> : undefined}
            />
          ))}
        </Card>
      ) : null}

      {data && data.pending_vehicles > 0 ? (
        <Card>
          <Row icon="vehicles" title="Transportingiz tekshirilmoqda" subtitle="Admin tasdiqlagach tegishli bo'lim ochiladi" onPress={() => router.push('/vehicles')} />
        </Card>
      ) : null}

      {data && data.sections.length === 0 && !isLoading ? (
        <Card>
          <Empty
            icon="vehicles"
            title="Hali ijrochi emassiz"
            text="Transportingizni qo'shing va hujjatlarni yuklang. Admin tasdiqlagach taksi, qatnovlar yoki so'rovlar bo'limi ochiladi."
          />
          <Button title="Transportlarim" icon="vehicles" kind="secondary" onPress={() => router.push('/vehicles')} />
        </Card>
      ) : null}

      {data && data.unread_notifications > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <Icon n="bell" size={16} color={t.muted} />
          <T kind="small">O'qilmagan bildirishnomalar: {data.unread_notifications}</T>
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, gap: 2 },
  heroSmall: { color: 'rgba(255,255,255,0.75)', fontFamily: font.semibold, fontSize: 15 },
  heroName: { color: '#fff', fontFamily: font.heavy, fontSize: 28 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: radius.md, padding: 12, gap: 2 },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontFamily: font.semibold, fontSize: 12 },
  statValue: { color: '#fff', fontFamily: font.bold, fontSize: 17 },
});
