import { useRouter } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { useMyVehicles } from '../../api/hooks';
import { Badge, Button, Card, Empty, ErrorNote, Icon, Screen, T } from '../../components/ui';
import { CATEGORY_NAMES, VEHICLE_STATUS } from '../../lib/catalog';
import { useTheme } from '../../theme';

/** Transportlarim: holat, yetishmayotgan hujjatlar; qo'shish va hujjat yuklash (PLAN-ANDROID §6, 12) */
export default function Vehicles() {
  const t = useTheme();
  const router = useRouter();
  const { data, error, isRefetching, refetch } = useMyVehicles();

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <T kind="title">Transportlarim</T>
      <Button title="Transport qo'shish" icon="vehicles" onPress={() => router.push('/vehicle/new')} />
      <ErrorNote error={error} />
      {data?.length === 0 ? (
        <Card>
          <Empty icon="vehicles" title="Transport qo'shilmagan" text="Transport qo'shing va hujjatlarni yuklang — admin tasdiqlagach ish boshlaysiz." />
        </Card>
      ) : null}
      {data?.map((v) => {
        const st = VEHICLE_STATUS[v.status] ?? { text: v.status, tone: 'neutral' as const };
        return (
          <Card key={v.id} onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: String(v.id) } })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon n="vehicles" size={22} color={t.primary} />
              <View style={{ flex: 1 }}>
                <T kind="h2">{v.model}</T>
                <T kind="small">{[CATEGORY_NAMES[v.category] ?? v.category, v.plate_number, v.color].filter(Boolean).join(' · ')}</T>
              </View>
              <Badge text={st.text} tone={st.tone} />
            </View>
            {v.missing_docs?.length ? (
              <View style={{ backgroundColor: t.orangeSoft, borderRadius: 10, padding: 10 }}>
                <T color={t.orangeInk}>Yetishmayotgan hujjatlar: {v.missing_docs.map((d) => d.name).join(', ')} — yuklash uchun bosing</T>
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
