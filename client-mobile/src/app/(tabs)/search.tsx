/** Aqlli qidiruv (Web App'dagi Search bilan bir xil: GET /search) — ijrochilar, qatnovlar, yaqin taksilar */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { api } from '../../api/client';
import type { Trip } from '../../api/hooks';
import { Chips } from '../../components/form';
import { BackHeader, Card, Empty, Icon, money, Screen, T } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';
import { font, radius, useTheme } from '../../theme';

type Provider = {
  id: number; first_name: string; last_name?: string | null; model?: string | null; category: string; category_name?: string;
  provider_rating?: number | string | null; distance_km?: number | null; expected_price?: number | null; service_type: 'cargo' | 'equipment';
};
type Result = { trips?: Trip[]; providers?: Provider[]; taxi_nearby?: number };

const SERVICES = [
  { value: '', label: 'Hammasi' }, { value: 'taxi', label: 'Taksi' }, { value: 'carpool', label: "Po'puti" },
  { value: 'cargo', label: 'Yuk' }, { value: 'equipment', label: 'Texnika' },
];

export default function Search() {
  const t = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [service, setService] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 400);
    return () => clearTimeout(id);
  }, [text]);

  const res = useQuery({
    queryKey: ['search', q, service],
    queryFn: () => api<Result>('/search', { query: { q: q || undefined, service: service || undefined } }),
  });
  const r = res.data;

  return (
    <Screen>
      <BackHeader title="Qidiruv" onBack={() => router.back()} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: radius.md, paddingHorizontal: 14, borderWidth: 1, borderColor: t.line }}>
        <Icon n="search" size={19} color={t.muted} />
        <TextInput value={text} onChangeText={setText} placeholder="Labo, ekskavator, Namangan…" placeholderTextColor={t.faint}
          style={{ flex: 1, height: 50, color: t.text, fontFamily: font.medium, fontSize: 16 }} />
      </View>
      <Chips items={SERVICES} value={service} onChange={setService} />
      {res.isLoading ? <ActivityIndicator color={t.primary} /> : null}

      {r?.taxi_nearby !== undefined ? (
        <Card onPress={() => router.push('/taxi')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon n="taxi" size={21} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: font.bold }}>Taksi</T>
              <T kind="small">Yaqin atrofda {r.taxi_nearby} ta bo'sh haydovchi</T>
            </View>
            <Icon n="next" size={18} color={t.faint} />
          </View>
        </Card>
      ) : null}

      {(r?.providers ?? []).length ? <T kind="label">Ijrochilar</T> : null}
      {(r?.providers ?? []).slice(0, 15).map((p) => (
        <Pressable key={`p${p.id}`} onPress={() => router.push({ pathname: '/request/new', params: { service: p.service_type } })}
          style={({ pressed }) => [{ backgroundColor: t.card, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }, pressed && { opacity: 0.7 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.service_type === 'cargo' ? t.blueSoft : t.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon n={p.service_type === 'cargo' ? 'truck' : 'equipment'} size={20} color={p.service_type === 'cargo' ? t.blueInk : t.orangeInk} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.text }} numberOfLines={1}>{p.model || p.category_name || p.category}</Text>
            <T kind="small" numberOfLines={1}>
              {p.first_name}{p.provider_rating ? ` · ★ ${Number(p.provider_rating).toFixed(1)}` : ''}
              {p.distance_km !== null && p.distance_km !== undefined ? ` · ${Number(p.distance_km).toFixed(1)} km` : ''}
            </T>
          </View>
          {p.expected_price ? <T style={{ fontFamily: font.bold, color: t.primary }}>{money(p.expected_price)}</T> : null}
        </Pressable>
      ))}

      {(r?.trips ?? []).length ? <T kind="label">Po'puti qatnovlari</T> : null}
      {(r?.trips ?? []).slice(0, 10).map((tr) => (
        <Card key={`t${tr.id}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(tr.id) } })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T style={{ fontFamily: font.bold }}>{fmtDateTime(tr.departure_at)}</T>
            <T style={{ fontFamily: font.heavy, color: t.primary }}>{money(tr.price_per_seat)}</T>
          </View>
          <T kind="small" numberOfLines={1}>{tr.from_address} → {tr.to_address}</T>
        </Card>
      ))}

      {r && !(r.providers ?? []).length && !(r.trips ?? []).length && r.taxi_nearby === undefined ? (
        <Empty icon="search" title="Hech narsa topilmadi" text="Boshqa so'z yoki xizmatni tanlang" />
      ) : null}
    </Screen>
  );
}
