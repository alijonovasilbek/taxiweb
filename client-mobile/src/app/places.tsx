/** Saqlangan manzillar: Uy va Ish (Web App bilan umumiy — users.saved_places) */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api } from '../api/client';
import { qk, useMe } from '../api/hooks';
import { PlacePicker, type Place } from '../components/PlacePicker';
import { BackHeader, Button, Card, ErrorNote, Screen, T } from '../components/ui';

export default function Places() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const saved = me.data?.saved_places ?? {};
  const [error, setError] = useState<string | null>(null);

  const save = async (kind: 'home' | 'work', p: Place | null) => {
    setError(null);
    try {
      if (p) await api(`/users/me/places/${kind}`, { method: 'PUT', body: { address: p.address, lat: p.lat, lng: p.lng } });
      else await api(`/users/me/places/${kind}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: qk.me });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlab bo‘lmadi');
    }
  };

  return (
    <Screen>
      <BackHeader title="Mening manzillarim" onBack={() => router.back()} />
      <T kind="muted">Uy va ish manzilini saqlang — taksini bir bosishda chaqirasiz. Telegram'dagi Chortoq Services bilan umumiy.</T>
      <Card>
        <T kind="label">Uy</T>
        <PlacePicker label="Uy manzili" value={saved.home ?? null} onChange={(p) => void save('home', p)} />
        {saved.home ? <Button title="O'chirish" kind="ghost" onPress={() => void save('home', null)} /> : null}
      </Card>
      <Card>
        <T kind="label">Ish</T>
        <PlacePicker label="Ish manzili" value={saved.work ?? null} onChange={(p) => void save('work', p)} />
        {saved.work ? <Button title="O'chirish" kind="ghost" onPress={() => void save('work', null)} /> : null}
      </Card>
      <ErrorNote error={error} />
    </Screen>
  );
}
