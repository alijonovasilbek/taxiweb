import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../api/client';
import { qk, tripKeys, useMyVehicles } from '../../api/hooks';
import { Chips, Field, Input, Stepper } from '../../components/form';
import { PlacePicker, type Place } from '../../components/PlacePicker';
import { BackHeader, Button, Card, Empty, ErrorNote, Screen, T, money } from '../../components/ui';
import { CARPOOL_CATEGORIES, CATEGORY_NAMES } from '../../lib/catalog';

const DAY_LABELS = ['Bugun', 'Ertaga', 'Indinga'];

function dayOptions() {
  const out: { value: number; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    out.push({ value: i, label: DAY_LABELS[i] ?? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  return out;
}

/** Yangi po'puti qatnovi (backend POST /carpool/trips) */
export default function NewTrip() {
  const router = useRouter();
  const qc = useQueryClient();
  const vehicles = useMyVehicles();
  const usable = useMemo(
    () => (vehicles.data ?? []).filter((v) => v.status === 'approved' && CARPOOL_CATEGORIES.includes(v.category)),
    [vehicles.data],
  );
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('08:00');
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState('');
  const [suggested, setSuggested] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicle = usable.find((v) => v.id === (vehicleId ?? usable[0]?.id));
  const maxSeats = Math.max(1, vehicle?.seats ?? 8);

  // Marshrut tanlanganda tizim tavsiya qilgan narx
  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    api<{ suggested_price_per_seat: number }>('/carpool/suggest-price', {
      query: { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng },
    })
      .then((r) => alive && setSuggested(Math.round(r.suggested_price_per_seat / 1000) * 1000))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [from, to]);

  const submit = async () => {
    setError(null);
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!vehicle) return setError('Tasdiqlangan transport tanlang');
    if (!from || !to) return setError("Qayerdan va qayerga tanlang");
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return setError('Vaqtni SS:DD ko‘rinishida yozing (masalan 08:30)');
    const p = Number(price.replace(/\s/g, '')) || suggested || 0;
    if (p <= 0) return setError("Bir o'rin narxini kiriting");
    const dep = new Date();
    dep.setDate(dep.getDate() + day);
    dep.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (dep.getTime() < Date.now() - 5 * 60_000) return setError("Jo'nash vaqti o'tib ketgan");
    setBusy(true);
    try {
      const trip = await api<{ id: number }>('/carpool/trips', {
        method: 'POST',
        body: {
          vehicle_id: vehicle.id, from, to, departure_at: dep.toISOString(), seats_total: seats,
          price_per_seat: p, note: note.trim() || null,
        },
      });
      void qc.invalidateQueries({ queryKey: tripKeys.my });
      void qc.invalidateQueries({ queryKey: qk.home });
      router.replace({ pathname: '/trip/[id]', params: { id: String(trip.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  if (vehicles.data && !usable.length) {
    return (
      <Screen>
        <BackHeader title="Yangi qatnov" onBack={() => router.back()} />
        <Card>
          <Empty icon="vehicles" title="Mos transport yo'q" text="Qatnov uchun admin tasdiqlagan yengil avtomobil, miniven, avtobus yoki Damas kerak." />
          <Button title="Orqaga" kind="secondary" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Yangi qatnov" onBack={() => router.back()} />
      {usable.length > 1 ? (
        <Field label="Transport">
          <Chips
            items={usable.map((v) => ({ value: v.id, label: `${v.model}${v.plate_number ? ` · ${v.plate_number}` : ''}` }))}
            value={vehicle?.id ?? null}
            onChange={setVehicleId}
          />
        </Field>
      ) : vehicle ? (
        <T kind="muted">{CATEGORY_NAMES[vehicle.category] ?? vehicle.category}: {vehicle.model} {vehicle.plate_number ?? ''}</T>
      ) : null}
      <PlacePicker label="Qayerdan" value={from} onChange={setFrom} />
      <PlacePicker label="Qayerga" value={to} onChange={setTo} />
      <Field label="Kun">
        <Chips items={dayOptions()} value={day} onChange={setDay} />
      </Field>
      <Field label="Jo'nash vaqti" hint="24 soatlik: 07:30, 18:00">
        <Input value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} />
      </Field>
      <Field label="O'rinlar soni">
        <Stepper value={seats} onChange={setSeats} max={maxSeats} />
      </Field>
      <Field label="Bir o'rin narxi (so'm)" hint={suggested ? `Tavsiya: ${money(suggested)}` : undefined}>
        <Input value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder={suggested ? String(suggested) : '20000'} maxLength={9} />
      </Field>
      <Field label="Izoh (ixtiyoriy)">
        <Input value={note} onChangeText={setNote} placeholder="Masalan: yukxona bo'sh, konditsioner bor" multiline maxLength={500} />
      </Field>
      <ErrorNote error={error} />
      <Button title="Qatnovni ochish" icon="check" loading={busy} onPress={submit} />
    </Screen>
  );
}
