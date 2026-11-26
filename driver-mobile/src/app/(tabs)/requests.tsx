import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { RefreshControl, View } from 'react-native';

import { useJobs, useRequestFeed, type ServiceRequest } from '../../api/hooks';
import { Chips } from '../../components/form';
import { Badge, Card, Empty, ErrorNote, Row, Screen, T, money } from '../../components/ui';
import { CATEGORY_NAMES, SERVICE_NAMES } from '../../lib/catalog';
import { OFFER_STATUS, REQUEST_STATUS, fmtDateTime } from '../../lib/format';
import { useTheme } from '../../theme';

type Tab = 'feed' | 'jobs';

/** Yuk tashish va spets texnika: mos so'rovlar lentasi, ishlarim (PLAN-ANDROID §6, 9–11) */
export default function Requests() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('feed');
  const feed = useRequestFeed();
  const jobs = useJobs();
  const q = tab === 'feed' ? feed : jobs;

  return (
    <Screen refresh={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={t.primary} />}>
      <T kind="title">So'rovlar</T>
      <Chips
        items={[
          { value: 'feed' as Tab, label: `Yangi${feed.data ? ` (${feed.data.requests.length})` : ''}` },
          { value: 'jobs' as Tab, label: 'Ishlarim va takliflarim' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorNote error={q.error} />
      {tab === 'feed' ? <Feed /> : <Jobs />}
    </Screen>
  );
}

function RequestCard({ r, right }: { r: ServiceRequest; right?: ReactElement }) {
  const router = useRouter();
  const t = useTheme();
  const cat = r.vehicle_category ? CATEGORY_NAMES[r.vehicle_category] : null;
  return (
    <Card onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(r.id) } })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Badge text={SERVICE_NAMES[r.service_type] ?? r.service_type} tone="brand" />
        {cat ? <T kind="small">{cat}</T> : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <T kind="h2" numberOfLines={2}>{r.title || (r.to_address ? `${r.from_address} → ${r.to_address}` : r.from_address)}</T>
      <T kind="muted" numberOfLines={1}>📍 {r.from_address}{r.to_address ? ` → ${r.to_address}` : ''}</T>
      <T kind="small">
        {[r.scheduled_at ? fmtDateTime(r.scheduled_at) : 'Vaqti kelishiladi',
          r.distance_km != null ? `sizdan ${Number(r.distance_km).toFixed(1)} km` : null,
          r.budget ? `byudjet ${money(r.budget)}` : null,
          r.client_rating ? `mijoz ★ ${Number(r.client_rating).toFixed(1)}` : null].filter(Boolean).join(' · ')}
      </T>
      {r.my_offer_status ? <T kind="small" color={t.primary}>Taklifingiz: {money(r.my_offer_price)} · {OFFER_STATUS[r.my_offer_status]?.text ?? r.my_offer_status}</T> : null}
    </Card>
  );
}

function Feed() {
  const { data } = useRequestFeed();
  if (!data) return null;
  if (!data.vehicles.length) {
    return <Card><Empty icon="requests" title="Tasdiqlangan transport yo'q" text={data.hint ?? "So'rovlarni ko'rish uchun yuk yoki texnika transportingiz tasdiqlangan bo'lishi kerak."} /></Card>;
  }
  if (!data.requests.length) {
    return <Card><Empty icon="requests" title="Hozircha mos so'rov yo'q" text="Yangi so'rov kelganda bildirishnoma olasiz." /></Card>;
  }
  return <>{data.requests.map((r) => <RequestCard key={r.id} r={r} />)}</>;
}

function Jobs() {
  const router = useRouter();
  const { data } = useJobs();
  if (!data) return null;
  const active = data.jobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const done = data.jobs.filter((j) => !['assigned', 'in_progress'].includes(j.status)).slice(0, 15);
  return (
    <>
      {active.map((r) => (
        <RequestCard key={r.id} r={r} right={<Badge text={REQUEST_STATUS[r.status]?.text ?? r.status} tone={REQUEST_STATUS[r.status]?.tone ?? 'neutral'} />} />
      ))}
      {data.pending_offers.length ? (
        <Card>
          <T kind="label">Javob kutilayotgan takliflar</T>
          {data.pending_offers.map((o) => (
            <Row key={o.id} title={o.title || SERVICE_NAMES[o.service_type] || "So'rov"} subtitle={`${o.from_address} · ${money(o.price)}`}
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(o.request_id) } })} />
          ))}
        </Card>
      ) : null}
      {!active.length && !data.pending_offers.length ? (
        <Card><Empty icon="work" title="Faol ish yo'q" text="Lentadan so'rov tanlab taklif yuboring. Mijoz tanlasa — ish shu yerda paydo bo'ladi." /></Card>
      ) : null}
      {done.length ? (
        <Card>
          <T kind="label">Tarix</T>
          {done.map((r) => (
            <Row key={r.id} title={r.title || SERVICE_NAMES[r.service_type] || "So'rov"} subtitle={r.from_address}
              right={<Badge text={REQUEST_STATUS[r.status]?.text ?? r.status} tone={REQUEST_STATUS[r.status]?.tone ?? 'neutral'} />}
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(r.id) } })} />
          ))}
        </Card>
      ) : null}
    </>
  );
}
