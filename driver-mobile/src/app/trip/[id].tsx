import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';

import { api } from '../../api/client';
import { qk, tripKeys, useTrip, type Booking } from '../../api/hooks';
import { BackHeader, Badge, Button, Card, ErrorNote, Icon, Row, Screen, T, money } from '../../components/ui';
import { BOOKING_STATUS, TRIP_STATUS, fmtDateTime } from '../../lib/format';
import { callPhone } from '../../lib/navigator';
import { useTheme } from '../../theme';

/** Qatnov: bron so'rovlarini tasdiqlash/rad etish, yo'lovchilarga qo'ng'iroq, holatni o'zgartirish */
export default function TripDetail() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: trip, error, isRefetching, refetch } = useTrip(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(null);
      void refetch();
      void qc.invalidateQueries({ queryKey: tripKeys.my });
      void qc.invalidateQueries({ queryKey: qk.home });
    }
  };

  const setStatus = (status: string, confirm?: string) => {
    const run = () => act(status, () => api(`/carpool/trips/${id}/status`, { method: 'PUT', body: { status } }));
    if (!confirm) return run();
    Alert.alert(confirm, '', [{ text: 'Yo‘q', style: 'cancel' }, { text: 'Ha', style: 'destructive', onPress: run }]);
  };

  const bookings = trip?.bookings ?? [];
  const pending = bookings.filter((b) => b.status === 'pending');
  const confirmed = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const st = trip ? TRIP_STATUS[trip.status] : undefined;
  const live = trip && ['active', 'full', 'departed'].includes(trip.status);

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <BackHeader title="Qatnov" onBack={() => router.back()} />
      <ErrorNote error={error ?? err} />
      {trip ? (
        <>
          <Card>
            {st ? <Badge text={st.text} tone={st.tone} /> : null}
            <T kind="h2">{trip.from_address} → {trip.to_address}</T>
            <T kind="muted">
              {fmtDateTime(trip.departure_at)} · {money(trip.price_per_seat)} / o'rin · bo'sh: {trip.seats_available}/{trip.seats_total}
            </T>
            {trip.vehicle_model ? <T kind="small">{trip.vehicle_model} {trip.vehicle_plate ?? ''}</T> : null}
            {trip.note ? <T kind="small">{trip.note}</T> : null}
          </Card>

          {pending.length ? (
            <Card>
              <T kind="label">Bron so'rovlari</T>
              {pending.map((b) => (
                <BookingRow key={b.id} b={b}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Tasdiqlash" icon="check" style={{ flex: 1, height: 44 }} loading={busy === `c${b.id}`}
                      onPress={() => act(`c${b.id}`, () => api(`/carpool/bookings/${b.id}/confirm`, { method: 'POST', body: {} }))} />
                    <Button title="Rad etish" kind="danger" style={{ flex: 1, height: 44 }} loading={busy === `r${b.id}`}
                      onPress={() => act(`r${b.id}`, () => api(`/carpool/bookings/${b.id}/reject`, { method: 'POST', body: {} }))} />
                  </View>
                </BookingRow>
              ))}
            </Card>
          ) : null}

          <Card>
            <T kind="label">Yo'lovchilar ({confirmed.reduce((n, b) => n + b.seats, 0)})</T>
            {confirmed.length ? confirmed.map((b) => <BookingRow key={b.id} b={b} />) : <T kind="muted">Hali tasdiqlangan yo'lovchi yo'q</T>}
          </Card>

          {live ? (
            <Card>
              {trip.status !== 'departed' ? (
                <Button title="Jo'nab ketdim" icon="carpool" loading={busy === 'departed'} onPress={() => setStatus('departed')} />
              ) : null}
              <Button title="Qatnovni yakunlash" kind="secondary" icon="check" loading={busy === 'completed'}
                onPress={() => setStatus('completed', 'Qatnov yakunlansinmi?')} />
              {trip.status !== 'departed' ? (
                <Button title="Bekor qilish" kind="ghost" onPress={() => setStatus('cancelled', "Qatnov bekor qilinsinmi? Bron qilgan yo'lovchilarga xabar boradi.")} />
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function BookingRow({ b, children }: { b: Booking; children?: ReactNode }) {
  const t = useTheme();
  const st = BOOKING_STATUS[b.status];
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <Row
        icon="profile"
        title={`${b.first_name}${b.last_name ? ` ${b.last_name}` : ''} · ${b.seats} o'rin`}
        subtitle={[b.passenger_rating ? `★ ${Number(b.passenger_rating).toFixed(1)}` : null, b.pickup_note].filter(Boolean).join(' · ') || undefined}
        right={
          b.contact_phone && b.status !== 'rejected' ? (
            <Pressable onPress={() => callPhone(b.contact_phone!)} hitSlop={10} style={{ backgroundColor: t.greenSoft, borderRadius: 12, padding: 10 }}>
              <Icon n="phone" size={18} color={t.greenInk} />
            </Pressable>
          ) : st ? <Badge text={st.text} tone={st.tone} /> : undefined
        }
      />
      {children}
    </View>
  );
}
