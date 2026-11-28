import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';

import { qk } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { TabBar } from '../../components/ui';
import { askNotifications, notifyIfBackground } from '../../lib/notify';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../theme';

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

  return (
    <Tabs
      tabBar={(props) => <BottomBar {...(props as unknown as BarProps)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Asosiy' }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtmalar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      {/* Qidiruv menyuda yo'q (dizayn: 3 bo'lim), lekin ekran bosh sahifadan ochiladi */}
      <Tabs.Screen name="search" options={{ title: 'Qidiruv', href: null }} />
    </Tabs>
  );
}

const TAB_ICONS: Record<string, string> = { index: 'home', orders: 'orders', profile: 'profile' };

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; href?: string | null } }>;
  // Expo Router 58: `navigation` o'rniga `emitter` va `navigateToTab` beriladi
  emitter: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  navigateToTab: (routeKey: string) => void;
};

/** Apple uslubidagi suzuvchi shisha menyu (components/ui TabBar); yashirin bo'limlar ko'rinmaydi */
function BottomBar({ state, descriptors, emitter, navigateToTab }: BarProps) {
  return (
    <TabBar items={state.routes.filter((r) => TAB_ICONS[r.name]).map((r) => {
      const on = state.routes[state.index]?.key === r.key;
      return {
        key: r.key, title: descriptors[r.key]?.options.title ?? r.name, icon: TAB_ICONS[r.name], on,
        onPress: () => {
          const ev = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
          if (!on && !ev.defaultPrevented) navigateToTab(r.key);
        },
      };
    })} />
  );
}
