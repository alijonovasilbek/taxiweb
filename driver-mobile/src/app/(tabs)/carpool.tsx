import { useRouter } from 'expo-router';
import { RefreshControl } from 'react-native';

import { useMyTrips } from '../../api/hooks';
import { Badge, Button, Card, Empty, ErrorNote, Row, Screen, T, money } from '../../components/ui';
import { TRIP_STATUS, fmtDateTime } from '../../lib/format';
import { useTheme } from '../../theme';

/** Po'puti: mening qatnovlarim, yangi qatnov ochish (PLAN-ANDROID §6, 7–8) */
export default function Carpool() {
  const t = useTheme();
  const router = useRouter();
  const { data, error, isRefetching, refetch } = useMyTrips();
  const active = (data ?? []).filter((x) => ['active', 'full', 'departed'].includes(x.status));
  const past = (data ?? []).filter((x) => !['active', 'full', 'departed'].includes(x.status)).slice(0, 15);

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <T kind="title">Qatnovlar</T>
      <Button title="Yangi qatnov ochish" icon="carpool" onPress={() => router.push('/trip/new')} />
      <ErrorNote error={error} />
      {data && !active.length ? (
        <Card>
          <Empty icon="carpool" title="Faol qatnov yo'q" text="Qatnov oching — yo'lovchilar Mini App'da topib, joy band qiladi. Bron so'rovlari shu yerda tasdiqlanadi." />
        </Card>
      ) : null}
      {active.map((tr) => (
        <Card key={tr.id} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(tr.id) } })}>
          <Row
            icon="carpool"
            title={`${tr.from_address} → ${tr.to_address}`}
            subtitle={`${fmtDateTime(tr.departure_at)} · bo'sh: ${tr.seats_available}/${tr.seats_total} · ${money(tr.price_per_seat)}`}
            right={tr.pending_bookings ? <Badge text={`${tr.pending_bookings} bron`} tone="orange" /> : <Badge text={TRIP_STATUS[tr.status]?.text ?? tr.status} tone={TRIP_STATUS[tr.status]?.tone ?? 'neutral'} />}
          />
        </Card>
      ))}
      {past.length ? (
        <Card>
          <T kind="label">O'tgan qatnovlar</T>
          {past.map((tr) => (
            <Row
              key={tr.id}
              title={`${tr.from_address} → ${tr.to_address}`}
              subtitle={fmtDateTime(tr.departure_at)}
              right={<Badge text={TRIP_STATUS[tr.status]?.text ?? tr.status} tone={TRIP_STATUS[tr.status]?.tone ?? 'neutral'} />}
              onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(tr.id) } })}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
