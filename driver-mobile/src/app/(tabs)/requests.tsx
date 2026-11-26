import { RefreshControl } from 'react-native';

import { useProviderHome } from '../../api/hooks';
import { Badge, Card, Empty, Row, Screen, T } from '../../components/ui';
import { SERVICE_NAMES } from '../../lib/catalog';
import { useTheme } from '../../theme';

/** Yuk tashish va spets texnika so'rovlari. Lenta, taklif berish va ishlarim — 4-bosqich. */
export default function Requests() {
  const t = useTheme();
  const { data, isRefetching, refetch } = useProviderHome();

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <T kind="title">So'rovlar</T>
      <Card>
        <Row icon="requests" title="Sizga mos yangi so'rovlar" right={<Badge text={String(data?.new_requests ?? 0)} tone="brand" />} />
      </Card>
      {data?.active_jobs.length ? (
        <Card>
          <T kind="label">Ishlarim</T>
          {data.active_jobs.map((j) => (
            <Row
              key={j.id}
              icon={j.service_type === 'equipment' ? 'equipment' : 'truck'}
              title={j.title || SERVICE_NAMES[j.service_type] || "So'rov"}
              subtitle={j.to_address ? `${j.from_address} → ${j.to_address}` : j.from_address}
              right={<Badge text={j.status === 'in_progress' ? 'Jarayonda' : 'Tanlangan'} tone={j.status === 'in_progress' ? 'green' : 'orange'} />}
            />
          ))}
        </Card>
      ) : null}
      <Card>
        <Empty icon="requests" title="Taklif berish keyingi yangilanishda" text="So'rovlar lentasi, narx taklif qilish va ishni yakunlash tayyorlanmoqda. Hozircha Mini App'dagi «Ijrochi» bo'limidan foydalaning." />
      </Card>
    </Screen>
  );
}
