import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../../api/client';
import { useAppVersion, useEarnings, useProviderHome, type Earnings } from '../../api/hooks';
import { BOT_URL } from '../../config';
import { essentialsGranted } from '../../lib/permissions';
import { Badge, Button, Card, Empty, ErrorNote, Icon, IconTile, Row, Screen, T, money } from '../../components/ui';
import { SERVICE_NAMES } from '../../lib/catalog';
import { font, useTheme } from '../../theme';

const ORDER_STATUS: Record<string, string> = {
  accepted: "Yo'lovchi oldiga boryapsiz",
  driver_arrived: 'Yetib keldingiz — kutyapsiz',
  in_progress: 'Safarda',
};

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const { data, error, isLoading, isRefetching, refetch } = useProviderHome();
  const version = useAppVersion();
  const [permsOk, setPermsOk] = useState(true);
  useFocusEffect(
    useCallback(() => {
      void essentialsGranted().then(setPermsOk);
    }, []),
  );
  const offline = error instanceof ApiError && error.status === 0;
  const earn = useEarnings(!!data?.taxi);

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Xayrli tun' : hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching || earn.isRefetching}
      onRefresh={() => { void refetch(); void earn.refetch(); }} tintColor={t.primary} />}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.greet, { color: t.muted }]}>{greet}, {data?.user.first_name ?? '…'}</Text>
          <T kind="title">{data?.taxi ? 'Daromad' : 'Bosh sahifa'}</T>
        </View>
        {data?.taxi ? (
          <View style={[s.period, { borderColor: t.line, backgroundColor: t.card }]}>
            <Text style={[s.periodText, { color: t.text }]}>Shu hafta</Text>
          </View>
        ) : null}
      </View>

      {data?.taxi && earn.data ? <EarningsCard e={earn.data} /> : (
        <View style={[s.dark, { backgroundColor: t.ink }]}>
          <Text style={s.darkLabel}>Bugungi daromad</Text>
          <Text style={[s.darkValue, { color: t.onInk }]}>{money(data?.earnings_today)}</Text>
        </View>
      )}

      {data?.taxi && earn.data ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MiniStat label="Safarlar" value={String(earn.data.today_rides)} />
          <MiniStat label="Liniyada" value={fmtOnline(earn.data.online_min_today)} />
          <MiniStat label="Reyting" value={Number(earn.data.rating).toFixed(2).replace('.', ',')} />
        </View>
      ) : null}

      {data?.taxi && earn.data?.recent.length ? (
        <View style={[s.list, { backgroundColor: t.card }]}>
          {earn.data.recent.slice(0, 5).map((r, i, arr) => (
            <View key={r.id} style={[s.trip, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.lineSoft }]}>
              <IconTile n="pin" />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[s.tripTitle, { color: t.text }]} numberOfLines={1}>{short(r.pickup_address)} → {short(r.dropoff_address)}</Text>
                <Text style={[s.tripSub, { color: t.muted }]}>
                  {new Date(r.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}{r.tariff_name ? ` · ${r.tariff_name}` : ''}
                </Text>
              </View>
              <Text style={[s.tripPrice, { color: t.text }]}>{Math.round(Number(r.final_price || 0)).toLocaleString('ru-RU').replace(/,/g, ' ')}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {offline ? (
        <Card style={{ backgroundColor: t.orangeSoft }}>
          <T color={t.orangeInk}>Internet aloqasi yo'q — oxirgi ma'lumotlar ko'rsatilmoqda.</T>
        </Card>
      ) : (
        <ErrorNote error={error} />
      )}

      {data?.phone_required ? (
        <Card style={{ backgroundColor: t.orangeSoft }}>
          <T color={t.orangeInk}>
            Telefon raqamingiz tasdiqlanmagan. Yo'lovchi va mijozlar siz bilan bog'lana olishi uchun botda «📱 Raqamni
            ulashish» tugmasini bosing.
          </T>
          <Button title="Botni ochish" kind="secondary" icon="send" onPress={() => Linking.openURL(BOT_URL)} />
        </Card>
      ) : null}

      {!permsOk ? (
        <Card onPress={() => router.push('/permissions')} style={{ backgroundColor: t.redSoft }}>
          <Row icon="shield" title="Telefon to'liq sozlanmagan" subtitle="Joylashuv yoki bildirishnomaga ruxsat yo'q — buyurtmalar kelmasligi mumkin" onPress={() => router.push('/permissions')} />
        </Card>
      ) : null}

      {version.data?.update_available && version.data.apk_url ? (
        <Card onPress={() => Linking.openURL(version.data!.apk_url!)}>
          <Row icon="refresh" title={`Yangi versiya: ${version.data.latest}`} subtitle={version.data.changelog ?? 'Yuklab olish uchun bosing'} onPress={() => Linking.openURL(version.data!.apk_url!)} />
        </Card>
      ) : null}

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

const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const short = (a: string) => (a || '').split(',')[0];
const fmtOnline = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} s ${m % 60} d` : `${m} d`);

/** Qora karta: bugungi daromad va oxirgi 7 kun ustunlari (bugungisi bordo) */
function EarningsCard({ e }: { e: Earnings }) {
  const t = useTheme();
  const max = Math.max(1, ...e.week.map((d) => d.total));
  return (
    <View style={[s.dark, { backgroundColor: t.ink }]}>
      <View style={{ gap: 4 }}>
        <Text style={[s.darkLabel, { color: t.scheme === 'dark' ? '#5f5f5f' : '#cfcfcf' }]}>Bugungi daromad</Text>
        <Text style={[s.darkValue, { color: t.onInk }]}>{money(e.today_earnings)}</Text>
      </View>
      <View style={s.bars}>
        {e.week.map((d, i) => {
          const today = i === e.week.length - 1;
          return (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: '100%', height: Math.max(4, Math.round((d.total / max) * 88)), borderRadius: 8,
                backgroundColor: today ? t.primary : t.scheme === 'dark' ? '#cfcfca' : '#3a3a38' }} />
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: today ? t.onInk : '#a8a8a3' }}>{DAYS[d.weekday]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[s.mini, { backgroundColor: t.card }]}>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: t.muted }}>{label}</Text>
      <Text style={{ fontFamily: font.heavy, fontSize: 20, color: t.text }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greet: { fontFamily: font.medium, fontSize: 14 },
  period: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  periodText: { fontFamily: font.semibold, fontSize: 14 },
  dark: { borderRadius: 24, padding: 20, gap: 18 },
  darkLabel: { fontFamily: font.medium, fontSize: 14, color: '#cfcfcf' },
  darkValue: { fontFamily: font.heavy, fontSize: 38, letterSpacing: -1.2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 110 },
  mini: { flex: 1, borderRadius: 18, padding: 14, gap: 4 },
  list: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  trip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tripTitle: { fontFamily: font.semibold, fontSize: 15 },
  tripSub: { fontFamily: font.medium, fontSize: 13 },
  tripPrice: { fontFamily: font.bold, fontSize: 15 },
});
