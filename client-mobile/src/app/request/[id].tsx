import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, View } from 'react-native';

import { api } from '../../api/client';
import { qk, useRequest } from '../../api/hooks';
import { Input } from '../../components/form';
import { BackHeader, Badge, Button, Card, Empty, ErrorNote, Icon, money, Screen, T } from '../../components/ui';
import { fmtDateTime, REQUEST_STATUS } from '../../lib/format';
import { font, useTheme } from '../../theme';

export default function RequestDetail() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRequest(Number(id));
  const r = q.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await q.refetch();
      void qc.invalidateQueries({ queryKey: qk.requests });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  const confirm = (title: string, fn: () => Promise<unknown>) =>
    Alert.alert(title, '', [{ text: "Yo'q", style: 'cancel' }, { text: 'Ha', onPress: () => void act(fn) }]);

  if (!r) {
    return (
      <Screen>
        <BackHeader title="So'rov" onBack={() => router.back()} />
        {q.isError ? <ErrorNote error={q.error} /> : <ActivityIndicator color={t.primary} />}
      </Screen>
    );
  }

  const accepted = (r.offers ?? []).filter((o) => o.status === 'accepted');
  const pending = (r.offers ?? []).filter((o) => o.status === 'pending');

  return (
    <Screen>
      <BackHeader title={r.service_type === 'cargo' ? 'Yuk tashish' : 'Maxsus texnika'} onBack={() => router.back()} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <T kind="h2" style={{ flex: 1 }}>{r.title || `So'rov #${r.id}`}</T>
          <Badge text={REQUEST_STATUS[r.status]?.text ?? r.status} tone={REQUEST_STATUS[r.status]?.tone ?? 'neutral'} />
        </View>
        <T>{r.from_address}</T>
        {r.to_address ? <T kind="muted">→ {r.to_address}</T> : null}
        <T kind="small">
          {r.scheduled_at ? fmtDateTime(r.scheduled_at) : 'Imkon qadar tez'}
          {r.budget ? ` · Byudjet: ${money(r.budget)}` : r.estimated_price ? ` · Taxminan ${money(r.estimated_price)}` : ''}
        </T>
        {r.description ? <T kind="muted">{r.description}</T> : null}
      </Card>

      {accepted.map((o) => (
        <Card key={o.id}>
          <T kind="label">Tanlangan ijrochi</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: font.bold }}>{o.first_name} {o.last_name || ''}</T>
              <T kind="small">{[o.provider_rating ? `★ ${Number(o.provider_rating).toFixed(1)}` : null, o.vehicle_model, o.vehicle_plate].filter(Boolean).join(' · ')}</T>
            </View>
            <T style={{ fontFamily: font.heavy, color: t.primary }}>{money(o.price)}</T>
          </View>
          {o.provider_phone ? <Button title={o.provider_phone} icon="call" kind="secondary" onPress={() => Linking.openURL(`tel:${o.provider_phone}`)} /> : null}
        </Card>
      ))}

      {['assigned', 'in_progress'].includes(r.status) ? (
        <Button title="Ish bajarildi" icon="check" loading={busy} onPress={() => confirm('Ish bajarildimi?', () => api(`/requests/${r.id}/complete`, { method: 'POST' }))} />
      ) : null}

      {r.status === 'open' ? (
        <>
          <T kind="label">Takliflar ({pending.length})</T>
          {!pending.length ? <Empty icon="clock" title="Takliflar kutilmoqda" text="Mos ijrochilarga xabar yuborildi. Taklif kelganda bildirishnoma olasiz." /> : null}
          {pending.map((o) => (
            <Card key={o.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontFamily: font.bold }}>{o.first_name} {o.last_name || ''}</T>
                  <T kind="small">{[o.provider_rating ? `★ ${Number(o.provider_rating).toFixed(1)}` : null, o.vehicle_model].filter(Boolean).join(' · ')}</T>
                  {o.available_at ? <T kind="small">Kelish vaqti: {fmtDateTime(o.available_at)}</T> : null}
                  {o.message ? <T kind="muted">{o.message}</T> : null}
                </View>
                <T style={{ fontFamily: font.heavy, color: t.primary, fontSize: 17 }}>{money(o.price)}</T>
              </View>
              <Button title="Tanlash" icon="check" loading={busy}
                onPress={() => confirm(`${o.first_name} taklifini ${money(o.price)} ga qabul qilasizmi?`,
                  () => api(`/requests/${r.id}/offers/${o.id}/accept`, { method: 'POST' }))} />
            </Card>
          ))}
        </>
      ) : null}

      {['open', 'assigned'].includes(r.status) ? (
        <Button title="So'rovni bekor qilish" kind="danger" loading={busy}
          onPress={() => confirm("So'rovni bekor qilasizmi?", () => api(`/requests/${r.id}/cancel`, { method: 'POST', body: {} }))} />
      ) : null}

      {r.status === 'completed' && !reviewed ? (
        <Card>
          <T kind="label">Ijrochini baholang</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Icon n="star" size={34} color={n <= rating ? '#ff9f0a' : t.faint} />
              </Pressable>
            ))}
          </View>
          <Input value={comment} onChangeText={setComment} placeholder="Izoh (ixtiyoriy)" multiline maxLength={300} />
          <Button title="Baholash" icon="star" loading={busy} onPress={() => act(async () => {
            await api('/reviews', { method: 'POST', body: { service_type: r.service_type, ref_id: r.id, rating, comment: comment || null } });
            setReviewed(true);
          })} />
        </Card>
      ) : null}
      <ErrorNote error={error} />
    </Screen>
  );
}
