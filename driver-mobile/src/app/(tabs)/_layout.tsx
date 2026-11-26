import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';

import { qk, useProviderHome } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { Icon } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { font, useTheme } from '../../theme';

/** Bosh sahifa ma'lumotini yangilaydigan real vaqt hodisalari */
const REFRESH_EVENTS = ['notification', 'new_order', 'new_order_timeout', 'order_cancelled', 'ride_completed', 'request:new'];

export default function TabsLayout() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const qc = useQueryClient();
  const home = useProviderHome(status === 'signedIn');
  const sections = home.data?.sections ?? [];

  useEffect(() => {
    if (status !== 'signedIn') return;
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => qc.invalidateQueries({ queryKey: qk.home });
    REFRESH_EVENTS.forEach((e) => socket.on(e, refresh));
    return () => REFRESH_EVENTS.forEach((e) => socket.off(e, refresh));
  }, [status, qc]);

  if (status !== 'signedIn') return <Redirect href="/login" />;

  const tab = (title: string, icon: string, visible = true) => ({
    title,
    href: visible ? undefined : null,
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
      <Tabs.Screen name="index" options={tab('Bosh', 'home')} />
      <Tabs.Screen name="taxi" options={tab('Taksi', 'taxi', sections.includes('taxi'))} />
      <Tabs.Screen name="carpool" options={tab('Qatnovlar', 'carpool', sections.includes('carpool'))} />
      <Tabs.Screen name="requests" options={tab("So'rovlar", 'requests', sections.includes('requests'))} />
      <Tabs.Screen name="vehicles" options={tab('Transport', 'vehicles')} />
      <Tabs.Screen name="profile" options={tab('Profil', 'profile')} />
    </Tabs>
  );
}
