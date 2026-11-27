import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { RefreshControl, View } from 'react-native';

import { api } from '../api/client';
import { qk, useNotifications, type Notification } from '../api/hooks';
import { BackHeader, Button, Card, Empty, Screen, T } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { useTheme } from '../theme';

export default function Notifications() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const list = useNotifications();
  const items = useMemo(() => list.data ?? [], [list.data]);

  // Ochilganda hammasi o'qilgan deb belgilanadi
  useEffect(() => {
    if (!items.some((n) => !n.is_read)) return;
    void api('/notifications/read-all', { method: 'PUT' })
      .then(() => qc.invalidateQueries({ queryKey: qk.unread }))
      .catch(() => undefined);
  }, [items, qc]);

  const open = (n: Notification) => {
    const d = n.data || {};
    if (d.order_id) router.push({ pathname: '/ride/[id]', params: { id: String(d.order_id) } });
    else if (d.request_id) router.push({ pathname: '/request/[id]', params: { id: String(d.request_id) } });
    else if (d.trip_id) router.push({ pathname: '/trip/[id]', params: { id: String(d.trip_id) } });
  };

  return (
    <Screen refresh={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} colors={[t.primary]} />}>
      <BackHeader title="Bildirishnomalar" onBack={() => router.back()} />
      {list.isError ? <Button title="Qayta yuklash" kind="secondary" onPress={() => list.refetch()} /> : null}
      {!items.length && !list.isLoading ? <Empty icon="bell" title="Bildirishnomalar yo'q" /> : null}
      {items.map((n) => (
        <Card key={n.id} onPress={() => open(n)} style={!n.is_read ? { borderLeftWidth: 4, borderLeftColor: t.primary } : undefined}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T kind="h2" style={{ flex: 1, fontSize: 16 }}>{n.title}</T>
            <T kind="small">{fmtDateTime(n.created_at)}</T>
          </View>
          {n.message ? <T kind="muted">{n.message}</T> : null}
        </Card>
      ))}
    </Screen>
  );
}
