import { RefreshControl } from 'react-native';

import { useProviderHome } from '../../api/hooks';
import { Badge, Card, Empty, Row, Screen, T } from '../../components/ui';
import { useTheme } from '../../theme';

/** Po'puti qatnovlari. Qatnov ochish va bronlarni boshqarish — 4-bosqich. */
export default function Carpool() {
  const t = useTheme();
  const { data, isRefetching, refetch } = useProviderHome();
  const trips = data?.carpool_trips ?? [];

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <T kind="title">Qatnovlar</T>
      {trips.length ? (
        <Card>
          {trips.map((tr) => (
            <Row
              key={tr.id}
              icon="carpool"
              title={`${tr.from_address} → ${tr.to_address}`}
              subtitle={`${new Date(tr.departure_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · bo'sh joy: ${tr.seats_available}/${tr.seats_total}`}
              right={tr.pending_bookings ? <Badge text={`${tr.pending_bookings} bron`} tone="orange" /> : undefined}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <Empty icon="carpool" title="Faol qatnov yo'q" text="Qatnov ochish va bronlarni tasdiqlash keyingi yangilanishda qo'shiladi. Hozircha Mini App orqali." />
        </Card>
      )}
    </Screen>
  );
}
