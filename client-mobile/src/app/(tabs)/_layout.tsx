import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  return (
    <Tabs
      tabBar={(props) => <FloatingBar {...(props as unknown as BarProps)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Asosiy' }} />
      <Tabs.Screen name="search" options={{ title: 'Qidiruv' }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtmalar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}

const TAB_ICONS: Record<string, string> = { index: 'home', search: 'search', orders: 'orders', profile: 'profile' };

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

/** Web App'dagidek suzib turuvchi pastki menyu: faol bo'lim bordo "tabletka" ichida */
function FloatingBar({ state, descriptors, navigation }: BarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[bar.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[bar.bar, { backgroundColor: t.tabBar, borderColor: t.line, shadowColor: t.shadow }]}>
        {state.routes.map((r, i) => {
          const on = state.index === i;
          const title = descriptors[r.key]?.options.title ?? r.name;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (!on && !ev.defaultPrevented) navigation.navigate(r.name);
              }}
              style={[bar.item, on && { backgroundColor: t.hHero }]}
            >
              <Icon n={TAB_ICONS[r.name] ?? 'home'} size={21} color={on ? '#fff' : t.muted} stroke={on ? 2.3 : 2} />
              <Text numberOfLines={1} style={[bar.label, { color: on ? '#fff' : t.muted, fontFamily: on ? font.bold : font.semibold }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: { flexDirection: 'row', borderRadius: 26, borderWidth: 1, padding: 6, gap: 4, elevation: 12, shadowOpacity: 1, shadowRadius: 18 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingVertical: 8, gap: 2 },
  label: { fontSize: 11 },
});
