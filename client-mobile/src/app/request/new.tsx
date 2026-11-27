/** Yuk tashish / maxsus texnika so'rovi (Web App'dagi RequestNew bilan bir xil: POST /requests, narx — /tariffs/estimate) */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api } from '../../api/client';
import { qk, useCatalog, useMe } from '../../api/hooks';
import { Chips, Field, Input, Stepper } from '../../components/form';
import { PlacePicker, type Place } from '../../components/PlacePicker';
import { BackHeader, Button, Card, ErrorNote, money, Screen, T } from '../../components/ui';
import { font, useTheme } from '../../theme';

const UNITS = [{ value: 'hour', label: 'soat' }, { value: 'shift', label: 'smena' }, { value: 'day', label: 'kun' }];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6).map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }));

function nextDays() {
  const names = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { value: v, label: i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : `${names[d.getDay()]} ${d.getDate()}` };
  });
}

export default function RequestNew() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { service = 'cargo' } = useLocalSearchParams<{ service?: 'cargo' | 'equipment' }>();
  const isCargo = service !== 'equipment';
  const catalog = useCatalog();
  const me = useMe();
  const cats = (catalog.data?.vehicle_categories ?? []).filter((c) => c.services.includes(isCargo ? 'cargo' : 'equipment'));

  const [category, setCategory] = useState<string | null>(null);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState(1);
  const [unit, setUnit] = useState('shift');
  const [budget, setBudget] = useState('');
  const [phoneInput, setPhone] = useState<string | null>(null);
  const phone = phoneInput ?? me.data?.phone ?? '';
  const [estimate, setEstimate] = useState<number | null>(null);
  const [later, setLater] = useState(false);
  const [day, setDay] = useState(() => nextDays()[1].value);
  const [hour, setHour] = useState(9);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEstimate = !isCargo || (!!from && !!to);
  useEffect(() => {
    if (!canEstimate) return;
    const query: Record<string, string | number | undefined> = { service: isCargo ? 'cargo' : 'equipment', category: category ?? undefined };
    if (isCargo && from && to) Object.assign(query, { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng });
    else Object.assign(query, { duration_value: duration, duration_unit: unit });
    const id = setTimeout(() => {
      api<{ price?: number; estimated_price?: number }>('/tariffs/estimate', { query })
        .then((r) => setEstimate(r.price ?? r.estimated_price ?? null))
        .catch(() => setEstimate(null));
    }, 300);
    return () => clearTimeout(id);
  }, [canEstimate, isCargo, category, from, to, duration, unit]);

  const submit = async () => {
    if (!from) return setError(isCargo ? 'Yuk olinadigan manzilni tanlang' : 'Ish joyini tanlang');
    if (isCargo && !to) return setError('Yetkazish manzilini tanlang');
    setBusy(true);
    setError(null);
    const n = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '')));
    try {
      const r = await api<{ id: number; matched_providers?: number }>('/requests', {
        method: 'POST',
        body: {
          service_type: isCargo ? 'cargo' : 'equipment',
          vehicle_category: category,
          title: title || null,
          description: description || null,
          weight_kg: isCargo ? n(weight) : null,
          duration_value: isCargo ? null : duration,
          duration_unit: isCargo ? null : unit,
          from, to: isCargo ? to : null,
          // Toshkent vaqti (backend "naive" vaqt kutadi)
          scheduled_at: later ? `${day}T${String(hour).padStart(2, '0')}:00:00` : null,
          budget: n(budget),
          phone: phone || null,
        },
      });
      void qc.invalidateQueries({ queryKey: qk.requests });
      router.replace({ pathname: '/request/[id]', params: { id: String(r.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "So'rov yuborilmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title={isCargo ? 'Yuk tashish' : 'Maxsus texnika'} onBack={() => router.back()} />
      <T kind="muted">So'rov mos ijrochilarga yuboriladi — ular narx taklif qiladi, siz eng ma'qulini tanlaysiz.</T>
      {cats.length ? (
        <Field label={isCargo ? 'Transport turi' : 'Texnika turi'}>
          <Chips items={[{ value: '', label: 'Farqi yo‘q' }, ...cats.map((c) => ({ value: c.code, label: c.name }))]}
            value={category ?? ''} onChange={(v) => setCategory(v || null)} />
        </Field>
      ) : null}
      <PlacePicker label={isCargo ? 'Qayerdan (yuk olinadigan joy)' : 'Ish joyi'} value={from} onChange={setFrom} />
      {isCargo ? <PlacePicker label="Qayerga" value={to} onChange={setTo} /> : null}
      <Field label="Qisqacha nomi (ixtiyoriy)">
        <Input value={title} onChangeText={setTitle} placeholder={isCargo ? 'Masalan: mebel ko‘chirish' : 'Masalan: zovur qazish'} maxLength={120} />
      </Field>
      {isCargo ? (
        <Field label="Og'irligi, kg (ixtiyoriy)"><Input value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="500" maxLength={7} /></Field>
      ) : (
        <Field label="Muddat">
          <View style={{ gap: 10 }}>
            <Stepper value={duration} onChange={setDuration} min={1} max={60} />
            <Chips items={UNITS} value={unit} onChange={setUnit} />
          </View>
        </Field>
      )}
      <Field label="Qachon kerak?">
        <View style={{ gap: 10 }}>
          <Chips items={[{ value: 'now', label: 'Imkon qadar tez' }, { value: 'later', label: 'Vaqtini tanlash' }]}
            value={later ? 'later' : 'now'} onChange={(v) => setLater(v === 'later')} />
          {later ? (
            <>
              <Chips items={nextDays()} value={day} onChange={setDay} />
              <Chips items={HOURS} value={hour} onChange={setHour} />
            </>
          ) : null}
        </View>
      </Field>
      <Field label="Izoh (ixtiyoriy)">
        <Input value={description} onChangeText={setDescription} multiline maxLength={1000} placeholder="Qo'shimcha ma'lumot" />
      </Field>
      <Field label="Byudjet, so'm (ixtiyoriy)"><Input value={budget} onChangeText={setBudget} keyboardType="numeric" placeholder="Taklif kutiladi" maxLength={10} /></Field>
      <Field label="Telefon"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+998 90 123 45 67" maxLength={20} /></Field>
      {estimate && canEstimate ? (
        <Card style={{ backgroundColor: t.primarySoft }}>
          <T kind="small">Taxminiy narx</T>
          <T style={{ fontFamily: font.heavy, fontSize: 22, color: t.primary }}>{money(estimate)}</T>
        </Card>
      ) : null}
      <ErrorNote error={error} />
      <Button title="So'rov yuborish" icon="send" loading={busy} onPress={submit} />
    </Screen>
  );
}
