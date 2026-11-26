import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';

import { api, upload } from '../../api/client';
import { qk, useMyVehicles } from '../../api/hooks';
import { BackHeader, Badge, Button, Card, ErrorNote, Icon, Row, Screen, T } from '../../components/ui';
import { CATEGORY_NAMES, DOC_TYPES, VEHICLE_STATUS } from '../../lib/catalog';
import { fileForm, pickPhoto } from '../../lib/photo';
import { useTheme } from '../../theme';

const DOC_STATUS: Record<string, { text: string; tone: 'green' | 'orange' | 'red' | 'neutral' }> = {
  pending: { text: 'Tekshirilmoqda', tone: 'orange' },
  approved: { text: 'Tasdiqlangan', tone: 'green' },
  rejected: { text: 'Rad etilgan', tone: 'red' },
};

/** Transport: hujjatlarni kamera/galereyadan yuklash (siqilgan JPEG, yopiq saqlanadi), rasm, o'chirish */
export default function VehicleDetail() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, error, isRefetching, refetch } = useMyVehicles();
  const v = data?.find((x) => x.id === id);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const done = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: qk.home });
  };

  const uploadDoc = (docType: string) =>
    Alert.alert(docType === '__photo' ? 'Transport rasmi' : DOC_TYPES[docType] ?? docType, 'Hujjat rasmi aniq, to‘liq va o‘qiladigan bo‘lsin.', [
      { text: 'Bekor', style: 'cancel' },
      { text: 'Galereya', onPress: () => void doUpload(docType, 'library') },
      { text: 'Kamera', onPress: () => void doUpload(docType, 'camera') },
    ]);

  const doUpload = async (docType: string, src: 'camera' | 'library') => {
    setErr(null);
    try {
      const file = await pickPhoto(src);
      if (!file) return;
      setBusy(docType);
      if (docType === '__photo') await upload(`/vehicles/${id}/photo`, fileForm({}, file));
      else await upload(`/vehicles/${id}/documents`, fileForm({ doc_type: docType }, file));
      done();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yuklab bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    Alert.alert("Transportni o'chirish", "Unga bog'liq rol va bo'limlar ham o'chadi.", [
      { text: 'Yo‘q', style: 'cancel' },
      {
        text: "O'chirish",
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/vehicles/${id}`, { method: 'DELETE' });
            done();
            router.back();
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Xatolik');
          }
        },
      },
    ]);

  if (!v) {
    return (
      <Screen>
        <BackHeader title="Transport" onBack={() => router.back()} />
        <ErrorNote error={error} />
        {data ? <T kind="muted">Transport topilmadi</T> : null}
      </Screen>
    );
  }

  const st = VEHICLE_STATUS[v.status] ?? { text: v.status, tone: 'neutral' as const };
  const missing = v.missing_docs ?? [];
  const docs = v.documents ?? [];

  return (
    <Screen refresh={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}>
      <BackHeader title={v.model} onBack={() => router.back()} />
      <Card>
        <Badge text={st.text} tone={st.tone} />
        <T kind="muted">{[CATEGORY_NAMES[v.category] ?? v.category, v.plate_number, v.color, v.year].filter(Boolean).join(' · ')}</T>
        {v.status === 'rejected' && v.reject_reason ? <T color={t.redInk}>Sabab: {v.reject_reason}</T> : null}
        {v.status === 'pending' && !missing.length ? <T kind="small">Hujjatlar to'liq. Admin tekshiruvini kuting — tasdiqlansa bildirishnoma keladi.</T> : null}
      </Card>

      {missing.length ? (
        <Card style={{ borderWidth: 2, borderColor: t.orange }}>
          <T kind="h2">Yuklash kerak</T>
          <T kind="small">Bu hujjatlarsiz admin transportni tasdiqlay olmaydi.</T>
          {missing.map((d) => (
            <Button key={d.code} title={`${d.name} — yuklash`} kind="secondary" icon="send" loading={busy === d.code} onPress={() => uploadDoc(d.code)} />
          ))}
        </Card>
      ) : null}

      <Card>
        <T kind="label">Yuklangan hujjatlar</T>
        {docs.length ? (
          docs.map((d) => (
            <Row key={d.id} icon="shield" title={DOC_TYPES[d.doc_type] ?? d.doc_type}
              subtitle={new Date(d.created_at).toLocaleDateString('ru-RU')}
              right={<Badge text={DOC_STATUS[d.status]?.text ?? d.status} tone={DOC_STATUS[d.status]?.tone ?? 'neutral'} />} />
          ))
        ) : (
          <T kind="muted">Hali hujjat yuklanmagan</T>
        )}
        <Button title="Boshqa hujjat yuklash" kind="ghost" onPress={() =>
          Alert.alert('Hujjat turi', '', [
            ...Object.entries(DOC_TYPES).slice(0, 4).map(([code, name]) => ({ text: name, onPress: () => uploadDoc(code) })),
            { text: 'Bekor', style: 'cancel' as const },
          ])} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon n="vehicles" size={20} color={t.primary} />
          <T style={{ flex: 1 }}>Transport rasmi {v.photo_url ? '✅' : '(mijozlar ko‘radi)'}</T>
        </View>
        <Button title={v.photo_url ? 'Rasmni almashtirish' : 'Rasm yuklash'} kind="secondary" loading={busy === '__photo'} onPress={() => uploadDoc('__photo')} />
      </Card>

      <ErrorNote error={err} />
      <Button title="Transportni o'chirish" kind="ghost" onPress={remove} />
    </Screen>
  );
}
