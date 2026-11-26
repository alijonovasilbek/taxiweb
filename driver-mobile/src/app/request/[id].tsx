import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';

import { api } from '../../api/client';
import { qk, reqKeys, useRequest, useRequestFeed } from '../../api/hooks';
import { Chips, Field, Input } from '../../components/form';
import { BackHeader, Badge, Button, Card, ErrorNote, Row, Screen, T, money } from '../../components/ui';
import { CATEGORY_NAMES, SERVICE_CATEGORIES, SERVICE_NAMES } from '../../lib/catalog';
import { OFFER_STATUS, REQUEST_STATUS, fmtDateTime } from '../../lib/format';
import { callPhone, openNavigator } from '../../lib/navigator';
import { useTheme } from '../../theme';

/** So'rov: tafsilot → taklif berish / yangilash / qaytarib olish; tanlangan bo'lsa — boshlash, yakunlash */
export default function RequestDetail() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: r, error, isRefetching, refetch } = useRequest(id);
  const feed = useRequestFeed();
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const vehicles = useMemo(() => {
    if (!r) return [];
    const cats = r.vehicle_category ? [r.vehicle_category] : SERVICE_CATEGORIES[r.service_type] ?? [];
    return (feed.data?.vehicles ?? []).filter((v) => cats.includes(v.category));
  }, [r, feed.data]);
  const vehicle = vehicles.find((v) => v.id === (vehicleId ?? r?.my_offer?.vehicle_id ?? vehicles[0]?.id));

  const refreshAll = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: reqKeys.feed });
    void qc.invalidateQueries({ queryKey: reqKeys.jobs });
    void qc.invalidateQueries({ queryKey: qk.home });
  };

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(null);
      refreshAll();
    }
  };

  const sendOffer = () => {
    const p = Number(price.replace(/\s/g, '')) || Number(r?.my_offer?.price ?? 0);
    if (!vehicle) return setErr('Mos tasdiqlangan transport yo‘q');
    if (p <= 0) return setErr('Narxni kiriting');
    void act('offer', () => api(`/requests/${id}/offers`, {
      method: 'POST', body: { vehicle_id: vehicle.id, price: p, message: message.trim() || null },
    }));
  };

  const withdraw = () =>
    Alert.alert('Taklifni qaytarib olish', '', [
      { text: 'Yo‘q', style: 'cancel' },
      { text: 'Ha', style: 'destructive', onPress: () => act('withdraw', () => api(`/offers/${r!.my_offer!.id}/withdraw`, { method: 'POST' })) },
    ]);

  const st = r ? REQUEST_STATUS[r.status] : undefined;
  const offer = r?.my_offer;
  const canOffer = r?.status === 'open' && (!offer || offer.status === 'pending' || offer.status === 'withdrawn');

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <BackHeader title={r ? SERVICE_NAMES[r.service_type] ?? "So'rov" : "So'rov"} onBack={() => router.back()} />
      <ErrorNote error={error ?? err} />
      {r ? (
        <>
          <Card>
            {st ? <Badge text={st.text} tone={st.tone} /> : null}
            {r.title ? <T kind="h2">{r.title}</T> : null}
            {r.vehicle_category ? <T kind="small">Transport: {CATEGORY_NAMES[r.vehicle_category] ?? r.vehicle_category}</T> : null}
            <T kind="muted">📍 {r.from_address}</T>
            {r.to_address ? <T kind="muted">🏁 {r.to_address}</T> : null}
            <T kind="small">
              {[r.scheduled_at ? fmtDateTime(r.scheduled_at) : 'Vaqti kelishiladi', r.weight_kg ? `${r.weight_kg} kg` : null,
                r.work_volume, r.budget ? `byudjet ${money(r.budget)}` : null].filter(Boolean).join(' · ')}
            </T>
            {r.description ? <T>{r.description}</T> : null}
            <T kind="small">Mijoz: {r.client_name}{r.client_rating ? ` · ★ ${Number(r.client_rating).toFixed(1)}` : ''}</T>
          </Card>

          {r.is_provider ? (
            <Card>
              <T kind="h2">Siz tanlandingiz ✅</T>
              {r.client_phone ? <Row icon="phone" title={r.client_phone} subtitle="Mijozga qo'ng'iroq" onPress={() => callPhone(r.client_phone!)} /> : null}
              <Button title="Navigator" kind="secondary" icon="pin"
                onPress={() => openNavigator(Number(r.from_lat), Number(r.from_lng))} />
              {r.status === 'assigned' ? (
                <Button title="Ishni boshlash" icon="check" loading={busy === 'start'}
                  onPress={() => act('start', () => api(`/requests/${id}/start`, { method: 'POST' }))} />
              ) : null}
              {r.status === 'assigned' || r.status === 'in_progress' ? (
                <Button title="Ishni yakunlash" kind={r.status === 'in_progress' ? 'primary' : 'secondary'} icon="check" loading={busy === 'complete'}
                  onPress={() => Alert.alert('Ish yakunlandimi?', '', [
                    { text: 'Yo‘q', style: 'cancel' },
                    { text: 'Ha', onPress: () => act('complete', () => api(`/requests/${id}/complete`, { method: 'POST' })) },
                  ])} />
              ) : null}
            </Card>
          ) : null}

          {offer && offer.status !== 'withdrawn' ? (
            <Card>
              <T kind="label">Taklifingiz</T>
              <Row title={money(offer.price)} subtitle={offer.message ?? undefined}
                right={<Badge text={OFFER_STATUS[offer.status]?.text ?? offer.status} tone={OFFER_STATUS[offer.status]?.tone ?? 'neutral'} />} />
              {offer.status === 'pending' ? <Button title="Qaytarib olish" kind="ghost" loading={busy === 'withdraw'} onPress={withdraw} /> : null}
            </Card>
          ) : null}

          {canOffer ? (
            <Card>
              <T kind="h2">{offer?.status === 'pending' ? 'Taklifni yangilash' : 'Taklif berish'}</T>
              {vehicles.length > 1 ? (
                <Field label="Transport">
                  <Chips items={vehicles.map((v) => ({ value: v.id, label: `${v.model}${v.plate_number ? ` · ${v.plate_number}` : ''}` }))}
                    value={vehicle?.id ?? null} onChange={setVehicleId} />
                </Field>
              ) : vehicle ? (
                <T kind="muted">Transport: {vehicle.model} {vehicle.plate_number ?? ''}</T>
              ) : (
                <T color={t.redInk}>Bu so'rovga mos tasdiqlangan transportingiz yo'q</T>
              )}
              <Field label="Narx (so'm)" hint={r.estimated_price ? `Tizim bahosi: ${money(r.estimated_price)}` : undefined}>
                <Input value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder={offer ? String(Math.round(Number(offer.price))) : r.budget ? String(Math.round(Number(r.budget))) : '300000'} maxLength={10} />
              </Field>
              <Field label="Izoh (ixtiyoriy)">
                <Input value={message} onChangeText={setMessage} placeholder="Masalan: 30 daqiqada yetib boraman" multiline maxLength={500} />
              </Field>
              <Button title={offer?.status === 'pending' ? 'Yangilash' : 'Taklif yuborish'} icon="send" loading={busy === 'offer'} disabled={!vehicle} onPress={sendOffer} />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
