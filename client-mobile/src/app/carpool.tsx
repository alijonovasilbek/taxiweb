/** Po'puti: yo'nalish va sana bo'yicha qatnov qidirish (Web App'dagi Carpool → Qidirish bilan bir xil API) */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api } from '../api/client';
import type { Trip } from '../api/hooks';
import { Chips, Field, Stepper } from '../components/form';
import { PlacePicker, type Place } from '../components/PlacePicker';
import { BackHeader, Badge, Button, Card, Empty, ErrorNote, money, Screen, T } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { font, useTheme } from '../theme';

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function days() {
  const names = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000);
    return { value: isoDay(d), label: i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : `${names[d.getDay()]} ${d.getDate()}` };
  });
}

export default function Carpool() {
  const t = useTheme();
  const router = useRouter();
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [day, setDay] = useState(isoDay(new Date()));
  const [seats, setSeats] = useState(1);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Trip[]>('/carpool/trips/search', {
        query: {
          seats, date: day,
          from_lat: from?.lat, from_lng: from?.lng, to_lat: to?.lat, to_lng: to?.lng,
        },
      });
      setTrips(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  }, [seats, day, from, to]);

  // Birinchi ochilishda — bugungi barcha qatnovlar; keyin "Qidirish" tugmasi
  const first = useRef(search);
  useEffect(() => {
    const id = setTimeout(() => void first.current(), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <Screen>
      <BackHeader title="Po'puti" onBack={() => router.back()} />
      <T kind="muted">Shaharlararo va ishga qatnovlar: bo'sh o'rinni bron qiling, haydovchi tasdiqlaydi.</T>
      <PlacePicker label="Qayerdan" value={from} onChange={setFrom} />
      <PlacePicker label="Qayerga" value={to} onChange={setTo} />
      <Field label="Sana"><Chips items={days()} value={day} onChange={setDay} /></Field>
      <Field label="Necha kishi"><Stepper value={seats} onChange={setSeats} min={1} max={6} /></Field>
      <Button title="Qatnov qidirish" icon="search" loading={busy} onPress={search} />
      <ErrorNote error={error} />
      {busy && !trips ? <ActivityIndicator color={t.primary} /> : null}
      {trips && !trips.length ? <Empty icon="carpool" title="Mos qatnov topilmadi" text="Boshqa sana yoki yaqinroq manzilni tanlang" /> : null}
      {(trips ?? []).map((tr) => (
        <Card key={tr.id} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(tr.id) } })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T kind="h2">{fmtDateTime(tr.departure_at)}</T>
            <T style={{ fontFamily: font.heavy, color: t.primary }}>{money(tr.price_per_seat)}</T>
          </View>
          <T numberOfLines={1}>{tr.from_address}</T>
          <T kind="muted" numberOfLines={1}>→ {tr.to_address}</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T kind="small">{tr.driver_name}{tr.driver_rating ? ` · ★ ${Number(tr.driver_rating).toFixed(1)}` : ''}{tr.vehicle_model ? ` · ${tr.vehicle_model}` : ''}</T>
            <Badge text={`${tr.seats_available} o'rin`} tone="green" />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
