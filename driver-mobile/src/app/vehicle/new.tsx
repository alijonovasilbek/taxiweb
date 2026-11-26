import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api } from '../../api/client';
import { qk } from '../../api/hooks';
import { Chips, Field, Input } from '../../components/form';
import { BackHeader, Button, ErrorNote, Screen, T } from '../../components/ui';
import { CARGO_CATS, CATEGORY_GROUPS, CATEGORY_NAMES, PASSENGER_CATS } from '../../lib/catalog';

/** Yangi transport (backend POST /vehicles). Saqlangach — hujjatlarni yuklash sahifasiga o'tiladi. */
export default function NewVehicle() {
  const router = useRouter();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  const [seats, setSeats] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPlate = category !== null && !['excavator', 'bulldozer', 'loader', 'tractor'].includes(category);
  const num = (v: string) => (v.trim() ? Number(v.replace(/\s/g, '')) : null);

  const submit = async () => {
    setError(null);
    if (!category) return setError('Transport turini tanlang');
    if (!model.trim()) return setError('Modelini yozing (masalan: Cobalt, Labo, JCB 3CX)');
    if (needsPlate && !plate.trim()) return setError('Davlat raqamini yozing (taksi va yuk uchun shart)');
    const y = num(year);
    if (y !== null && (y < 1950 || y > new Date().getFullYear() + 1)) return setError("Yil noto'g'ri");
    setBusy(true);
    try {
      const v = await api<{ id: number }>('/vehicles', {
        method: 'POST',
        body: {
          category, model: model.trim(), plate_number: plate.trim().toUpperCase().replace(/\s+/g, '') || null,
          color: color.trim() || null, year: y, seats: num(seats), capacity_kg: num(capacity),
        },
      });
      void qc.invalidateQueries({ queryKey: qk.vehicles });
      void qc.invalidateQueries({ queryKey: qk.home });
      router.replace({ pathname: '/vehicle/[id]', params: { id: String(v.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Transport qo'shish" onBack={() => router.back()} />
      {CATEGORY_GROUPS.map((g) => (
        <Field key={g.title} label={g.title}>
          <Chips items={g.items.map((c) => ({ value: c, label: CATEGORY_NAMES[c] ?? c }))} value={category} onChange={setCategory} />
        </Field>
      ))}
      {category ? (
        <>
          <Field label="Model">
            <Input value={model} onChangeText={setModel} placeholder="Cobalt, Nexia 3, Labo, JCB 3CX…" maxLength={100} />
          </Field>
          <Field label="Davlat raqami" hint={needsPlate ? 'Masalan: 50A123BC' : 'Ixtiyoriy'}>
            <Input value={plate} onChangeText={setPlate} placeholder="50A123BC" maxLength={20} />
          </Field>
          <Field label="Rangi">
            <Input value={color} onChangeText={setColor} placeholder="Oq" maxLength={50} />
          </Field>
          <Field label="Ishlab chiqarilgan yili">
            <Input value={year} onChangeText={setYear} keyboardType="number-pad" placeholder="2020" maxLength={4} />
          </Field>
          {PASSENGER_CATS.includes(category) ? (
            <Field label="Yo'lovchi o'rinlari (haydovchisiz)">
              <Input value={seats} onChangeText={setSeats} keyboardType="number-pad" placeholder="4" maxLength={2} />
            </Field>
          ) : null}
          {CARGO_CATS.includes(category) ? (
            <Field label="Yuk sig'imi (kg)">
              <Input value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="1000" maxLength={6} />
            </Field>
          ) : null}
          <ErrorNote error={error} />
          <Button title="Saqlash va hujjatlarni yuklash" icon="check" loading={busy} onPress={submit} />
          <T kind="small">Keyingi qadamda pasport, guvohnoma va texpasport rasmlarini yuklaysiz. Admin tekshirgach transport tasdiqlanadi.</T>
        </>
      ) : null}
    </Screen>
  );
}
