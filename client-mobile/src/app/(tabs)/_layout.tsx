import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { qk } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { Glass, Icon } from '../../components/ui';
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
  // Expo Router 58: `navigation` o'rniga `emitter` va `navigateToTab` beriladi
  emitter: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  navigateToTab: (routeKey: string) => void;
};

/** Web App'dagidek suzib turuvchi pastki menyu: faol bo'lim bordo "tabletka" ichida */
function FloatingBar({ state, descriptors, emitter, navigateToTab }: BarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[bar.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Glass strong rounded={28} style={[bar.bar, { shadowColor: t.shadow }]}>
        {state.routes.map((r, i) => {
          const on = state.index === i;
          const title = descriptors[r.key]?.options.title ?? r.name;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                const ev = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (!on && !ev.defaultPrevented) navigateToTab(r.key);
              }}
              style={[bar.item, on && { backgroundColor: t.hHero, borderColor: 'rgba(255,255,255,0.35)' }]}
            >
              {on ? (
                <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.12)']}
                  locations={[0, 0.5, 1]} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
              ) : null}
              <Icon n={TAB_ICONS[r.name] ?? 'home'} size={22} color={on ? '#fff' : t.muted} outline={!on} />
              <Text numberOfLines={1} style={[bar.label, { color: on ? '#fff' : t.muted, fontFamily: on ? font.bold : font.semibold }]}>{title}</Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  // strong (0.92) shisha: Android soyasi ostidan deyarli ko'rinmaydi
  bar: { flexDirection: 'row', padding: 6, gap: 4, elevation: 10, shadowOpacity: 1, shadowRadius: 20 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, paddingVertical: 8, gap: 2, overflow: 'hidden',
    borderWidth: 1, borderColor: 'transparent' },
  label: { fontSize: 11 },
});
