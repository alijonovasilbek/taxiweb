import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

import { api } from '../../api/client';
import { qk, useTrip } from '../../api/hooks';
import { Field, Input, Stepper } from '../../components/form';
import { BackHeader, Badge, Button, Card, ErrorNote, money, Row, Screen, T } from '../../components/ui';
import { BOOKING_STATUS, fmtDateTime, TRIP_STATUS } from '../../lib/format';
import { font, useTheme } from '../../theme';

export default function TripDetail() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const q = useTrip(tripId);
  const trip = q.data;
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await q.refetch();
      void qc.invalidateQueries({ queryKey: qk.bookings });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  if (!trip) {
    return (
      <Screen>
        <BackHeader title="Qatnov" onBack={() => router.back()} />
        {q.isError ? <ErrorNote error={q.error} /> : <ActivityIndicator color={t.primary} />}
      </Screen>
    );
  }

  const my = trip.my_booking;
  const canBook = !trip.is_owner && trip.status === 'active' && (!my || !['pending', 'confirmed'].includes(my.status));

  return (
    <Screen>
      <BackHeader title="Qatnov" onBack={() => router.back()} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge text={TRIP_STATUS[trip.status]?.text ?? trip.status} tone={TRIP_STATUS[trip.status]?.tone ?? 'neutral'} />
          <T style={{ fontFamily: font.heavy, color: t.primary, fontSize: 20 }}>{money(trip.price_per_seat)} <T kind="small">/ o'rin</T></T>
        </View>
        <T>{trip.from_address}</T>
        <T kind="muted">→ {trip.to_address}</T>
        <T kind="small">Jo'nash: {fmtDateTime(trip.departure_at)} · Bo'sh o'rin: {trip.seats_available}/{trip.seats_total}</T>
        {trip.note ? <T kind="muted">{trip.note}</T> : null}
      </Card>

      <Card>
        <T kind="label">Haydovchi</T>
        <Row icon="taxi" title={`${trip.driver_name} ${trip.driver_last_name || ''}`.trim()}
          subtitle={[trip.driver_rating ? `★ ${Number(trip.driver_rating).toFixed(1)}` : null, trip.vehicle_model, trip.vehicle_color, trip.vehicle_plate].filter(Boolean).join(' · ')} />
        {trip.driver_phone && my && ['pending', 'confirmed'].includes(my.status) ? (
          <Button title={trip.driver_phone} icon="call" kind="secondary" onPress={() => Linking.openURL(`tel:${trip.driver_phone}`)} />
        ) : null}
      </Card>

      {my ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T kind="h2">Mening bronim · {my.seats} o'rin</T>
            <Badge text={BOOKING_STATUS[my.status]?.text ?? my.status} tone={BOOKING_STATUS[my.status]?.tone ?? 'neutral'} />
          </View>
          {my.status === 'pending' ? <T kind="small">Haydovchi tasdiqlashi kutilmoqda — tasdiqlansa xabar keladi.</T> : null}
          {['pending', 'confirmed'].includes(my.status) ? (
            <Button title="Bronni bekor qilish" kind="danger" loading={busy}
              onPress={() => act(() => api(`/carpool/bookings/${my.id}/cancel`, { method: 'POST' }))} />
          ) : null}
        </Card>
      ) : null}

      {canBook ? (
        <Card>
          <T kind="label">Joy bron qilish</T>
          <Field label="O'rinlar soni"><Stepper value={seats} onChange={setSeats} min={1} max={Math.max(1, trip.seats_available)} /></Field>
          <Field label="Izoh (ixtiyoriy)"><Input value={note} onChangeText={setNote} placeholder="Masalan: bozor oldidan olib keting" maxLength={200} /></Field>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T kind="muted">Jami</T>
            <T style={{ fontFamily: font.heavy, color: t.primary }}>{money(Number(trip.price_per_seat) * seats)}</T>
          </View>
          <Button title="Bron qilish" icon="check" loading={busy}
            onPress={() => act(() => api(`/carpool/trips/${trip.id}/book`, { method: 'POST', body: { seats, pickup_note: note || null } }))} />
        </Card>
      ) : null}
      <ErrorNote error={error} />
    </Screen>
  );
}
