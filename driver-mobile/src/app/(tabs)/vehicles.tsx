import { Linking, RefreshControl, View } from 'react-native';

import { useMyVehicles } from '../../api/hooks';
import { Badge, Button, Card, Empty, ErrorNote, Icon, Screen, T } from '../../components/ui';
import { CATEGORY_NAMES, VEHICLE_STATUS } from '../../lib/catalog';
import { useTheme } from '../../theme';

const BOT_URL = 'https://t.me/chortoqgotaxibot';

/** Transportlar va hujjatlar holati. Qo'shish/tahrirlash va kamera bilan hujjat yuklash — 5-bosqich. */
export default function Vehicles() {
  const t = useTheme();
  const { data, error, isRefetching, refetch } = useMyVehicles();

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <T kind="title">Transportlarim</T>
      <ErrorNote error={error} />
      {data?.length === 0 ? (
        <Card>
          <Empty icon="vehicles" title="Transport qo'shilmagan" text="Transport qo'shing va hujjatlarni yuklang — admin tasdiqlagach ish boshlaysiz." />
        </Card>
      ) : null}
      {data?.map((v) => {
        const st = VEHICLE_STATUS[v.status] ?? { text: v.status, tone: 'neutral' as const };
        return (
          <Card key={v.id}>
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
                <T color={t.orangeInk}>Yetishmayotgan hujjatlar: {v.missing_docs.map((d) => d.name).join(', ')}</T>
              </View>
            ) : null}
          </Card>
        );
      })}
      <Card>
        <T kind="muted">Transport qo'shish va hujjat yuklash ilovaning keyingi yangilanishida. Hozircha Chortoq Services Mini App'da: «Profil → Transportlarim».</T>
        <Button title="Mini App'ni ochish" kind="secondary" icon="send" onPress={() => Linking.openURL(BOT_URL)} />
      </Card>
    </Screen>
  );
}
