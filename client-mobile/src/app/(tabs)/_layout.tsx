import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';

import { qk } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { Icon } from '../../components/ui';
import { askNotifications, notifyIfBackground } from '../../lib/notify';
import { useAuth } from '../../store/auth';
import { font, useTheme } from '../../theme';

/** Socket hodisasi → ma'lumotni yangilash va (ilova fonda bo'lsa) bildirishnoma */
const TAXI_EVENTS: Record<string, [string, string, boolean] | null> = {
  order_accepted: ['🚕 Haydovchi topildi', "Haydovchi yo'lingizga chiqdi", true],
  driver_arrived: ['📍 Haydovchi yetib keldi', 'Chiqishingiz mumkin', true],
  ride_started: ['🛣 Safar boshlandi', "Yo'lingiz bexatar bo'lsin", false],
  ride_completed: ['✅ Safar yakunlandi', 'Haydovchini baholang', false],
  no_drivers_found: ['Haydovchi topilmadi', "Qayta urinib ko'ring", false],
  order_cancelled: ['Buyurtma bekor qilindi', '', true],
  payment_confirmed: null,
};

export default function TabsLayout() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const qc = useQueryClient();

  useEffect(() => {
    if (status !== 'signedIn') return;
    void askNotifications();
    const socket = getSocket();
    if (!socket) return;
    const handlers: [string, (d: any) => void][] = Object.entries(TAXI_EVENTS).map(([ev, note]) => [ev, (d: any) => {
      void qc.invalidateQueries({ queryKey: qk.activeOrder });
      void qc.invalidateQueries({ queryKey: qk.rides });
      if (d?.order_id) void qc.invalidateQueries({ queryKey: qk.order(Number(d.order_id)) });
      if (note) notifyIfBackground(note[0], d?.reason || note[1], { order_id: d?.order_id }, note[2]);
    }]);
    const onNotification = (n: { title?: string; message?: string; data?: Record<string, unknown> }) => {
      void qc.invalidateQueries({ queryKey: qk.unread });
      void qc.invalidateQueries({ queryKey: qk.notifications });
      void qc.invalidateQueries({ queryKey: qk.requests });
      void qc.invalidateQueries({ queryKey: qk.bookings });
      if (n?.title) notifyIfBackground(n.title, n.message ?? '', n.data ?? {});
    };
    handlers.forEach(([ev, fn]) => socket.on(ev, fn));
    socket.on('notification', onNotification);
    return () => {
      handlers.forEach(([ev, fn]) => socket.off(ev, fn));
      socket.off('notification', onNotification);
    };
  }, [status, qc]);

  if (status !== 'signedIn') return <Redirect href="/login" />;

  const tab = (title: string, icon: string) => ({
    title,
    tabBarIcon: ({ color }: { color: ColorValue }) => <Icon n={icon} size={23} color={String(color)} />,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: { backgroundColor: t.tabBar, borderTopColor: t.line },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Asosiy', 'home')} />
      <Tabs.Screen name="orders" options={tab('Buyurtmalarim', 'orders')} />
      <Tabs.Screen name="profile" options={tab('Profil', 'profile')} />
    </Tabs>
  );
}
