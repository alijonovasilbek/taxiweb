import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { qk, useProviderHome } from '../../api/hooks';
import { getSocket } from '../../api/socket';
import { OfferOverlay } from '../../components/OfferOverlay';
import { money, TabBar } from '../../components/ui';
import { getItem, setItem } from '../../lib/storage';
import { useAuth } from '../../store/auth';
import { useOffer, type Offer } from '../../store/offer';
import { useTheme } from '../../theme';

/** Bosh sahifa ma'lumotini yangilaydigan real vaqt hodisalari */
const REFRESH_EVENTS = ['notification', 'new_order_timeout', 'ride_completed', 'request:new', 'driver:offline_timeout'];
const SECTIONS_KEY = 'cache.sections';

let cachedSections: string[] = [];
void getItem(SECTIONS_KEY).then((v) => {
  try {
    if (v) cachedSections = JSON.parse(v);
  } catch {
    // buzilgan kesh — e'tiborsiz
  }
});

export default function TabsLayout() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const qc = useQueryClient();
  const home = useProviderHome(status === 'signedIn');
  const showOffer = useOffer((s) => s.show);
  const closeOffer = useOffer((s) => s.close);

  // Oxirgi ma'lum bo'limlar diskda: internet yo'q yoki yuklanayotganda menyu "sakramasin" (KAMCHILIKLAR-ANDROID #13)
  const sections = home.data?.sections ?? cachedSections;
  useEffect(() => {
    if (home.data) {
      cachedSections = home.data.sections;
      void setItem(SECTIONS_KEY, JSON.stringify(home.data.sections));
    }
  }, [home.data]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: qk.home });
      void qc.invalidateQueries({ queryKey: qk.driverActive });
    };
    const onOffer = (o: Offer) => {
      if (!showOffer(o)) return;
      // Ilova fonda (ekran o'chgan, boshqa ilova ochiq) — bildirishnoma; bosilsa ilova ochiladi va oyna turgan bo'ladi
      if (AppState.currentState !== 'active') {
        void Notifications.scheduleNotificationAsync({
          content: {
            title: `🚖 Yangi buyurtma · ${money(o.price)}`,
            body: `${o.pickup.address} → ${o.dropoff.address}`,
            data: { order_id: o.order_id, type: 'new_order' },
            sound: true,
          },
          trigger: { channelId: 'orders' },
        }).catch(() => undefined);
      }
    };
    const onGone = (d: { order_id: number }) => closeOffer(d?.order_id);
    const onCancelled = (d: { order_id: number; reason?: string; cancelled_by?: string }) => {
      closeOffer(d?.order_id);
      refresh();
      if (d?.cancelled_by === 'passenger') Alert.alert("Yo'lovchi buyurtmani bekor qildi", d.reason || '');
    };
    socket.on('new_order', onOffer);
    socket.on('new_order_timeout', onGone);
    socket.on('order_cancelled', onCancelled);
    REFRESH_EVENTS.forEach((e) => socket.on(e, refresh));
    return () => {
      socket.off('new_order', onOffer);
      socket.off('new_order_timeout', onGone);
      socket.off('order_cancelled', onCancelled);
      REFRESH_EVENTS.forEach((e) => socket.off(e, refresh));
    };
  }, [status, qc, showOffer, closeOffer]);

  if (status !== 'signedIn') return <Redirect href="/login" />;

  const hasTaxi = sections.includes('taxi');
  const tab = (title: string, visible = true) => ({ title, href: visible ? undefined : null });

  return (
    <>
      <Tabs
        tabBar={(props) => <BottomBar {...(props as unknown as BarProps)} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
      >
        <Tabs.Screen name="taxi" options={tab('Xarita', hasTaxi)} />
        <Tabs.Screen name="index" options={tab(hasTaxi ? 'Daromad' : 'Bosh')} />
        <Tabs.Screen name="carpool" options={tab('Qatnovlar', sections.includes('carpool'))} />
        <Tabs.Screen name="requests" options={tab("So'rovlar", sections.includes('requests'))} />
        <Tabs.Screen name="vehicles" options={tab('Transport')} />
        <Tabs.Screen name="profile" options={tab('Profil')} />
      </Tabs>
      <OfferOverlay />
    </>
  );
}

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; href?: string | null } }>;
  // Expo Router 58: `navigation` o'rniga `emitter` va `navigateToTab` beriladi
  emitter: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  navigateToTab: (routeKey: string) => void;
};

/** Apple uslubidagi suzuvchi shisha menyu; yashirin bo'limlar (href: null) ko'rinmaydi */
function BottomBar({ state, descriptors, emitter, navigateToTab }: BarProps) {
  return (
    <TabBar items={state.routes.filter((r) => descriptors[r.key]?.options.href !== null).map((r) => {
      const on = state.routes[state.index]?.key === r.key;
      return {
        key: r.key, title: descriptors[r.key]?.options.title ?? r.name, icon: TAB_ICONS[r.name] ?? 'home', on,
        onPress: () => {
          const ev = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
          if (!on && !ev.defaultPrevented) navigateToTab(r.key);
        },
      };
    })} />
  );
}

const TAB_ICONS: Record<string, string> = {
  index: 'chart', taxi: 'map', carpool: 'carpool', requests: 'requests', vehicles: 'vehicles', profile: 'profile',
};


