import { RefreshControl } from 'react-native';

import { useProviderHome } from '../../api/hooks';
import { Badge, Card, Empty, Row, Screen, T } from '../../components/ui';
import { useTheme } from '../../theme';

/** Taksi bo'limi. Onlayn bo'lish, fon GPS va kiruvchi buyurtma ekrani — 3-bosqich (PLAN-ANDROID §10). */
export default function Taxi() {
  const t = useTheme();
  const { data, isRefetching, refetch } = useProviderHome();
  const taxi = data?.taxi;

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <T kind="title">Taksi</T>
      {taxi ? (
        <Card>
          <Row
            icon="taxi"
            title={`${taxi.car_model} · ${taxi.car_number}`}
            subtitle={`${taxi.car_color} · reyting ${Number(taxi.rating).toFixed(1)} · ${taxi.total_rides} ta safar`}
            right={<Badge text={taxi.is_online ? 'Onlayn' : 'Oflayn'} tone={taxi.is_online ? 'green' : 'neutral'} />}
          />
        </Card>
      ) : null}
      <Card>
        <Empty
          icon="taxi"
          title="Onlayn bo'lish keyingi yangilanishda"
          text="Fondagi GPS, ilova yopiq bo'lsa ham keladigan buyurtma qo'ng'irog'i va safar bosqichlari tayyorlanmoqda. Hozircha buyurtmalarni Mini App'dagi «Taksi haydovchisi» bo'limida qabul qiling."
        />
      </Card>
    </Screen>
  );
}
