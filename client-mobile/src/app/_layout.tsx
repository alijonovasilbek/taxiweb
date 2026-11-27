import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppVersion } from '../api/hooks';
import { queryClient } from '../api/queryClient';
import { Button, Icon, T } from '../components/ui';
import { BOT_URL } from '../config';
import { appVersion } from '../lib/device';
import { useAuth } from '../store/auth';
import { isDark, useTheme, useThemePref } from '../theme';

void SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const t = useTheme();

  useEffect(() => {
    Promise.all([useAuth.getState().bootstrap(), useThemePref.getState().load()]).finally(() => SplashScreen.hide());
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.bg).catch(() => undefined);
  }, [t.bg]);

  if (status === 'loading') return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark(t) ? 'light' : 'dark'} />
        <VersionGate>
          <NotificationTaps />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
        </VersionGate>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/** Bildirishnoma bosilsa — tegishli ekran (safar, so'rov, qatnov) */
function NotificationTaps() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  useEffect(() => {
    if (status !== 'signedIn') return;
    const open = (data: Record<string, any> | undefined) => {
      if (!data) return;
      if (data.order_id) router.push({ pathname: '/ride/[id]', params: { id: String(data.order_id) } });
      else if (data.request_id) router.push({ pathname: '/request/[id]', params: { id: String(data.request_id) } });
      else if (data.trip_id) router.push({ pathname: '/trip/[id]', params: { id: String(data.trip_id) } });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data as Record<string, any>);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      open(r.notification.request.content.data as Record<string, any>));
    return () => sub.remove();
  }, [status, router]);
  return null;
}

/** Ilova `min_version` dan eski bo'lsa — yangilamaguncha ishlatib bo'lmaydi */
function VersionGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { data } = useAppVersion();
  if (!data?.update_required) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: 'center', gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Icon n="refresh" size={44} color={t.primary} />
        <T kind="title" style={{ textAlign: 'center' }}>Yangilash kerak</T>
        <T kind="muted" style={{ textAlign: 'center' }}>
          Sizdagi versiya ({appVersion()}) endi qo'llab-quvvatlanmaydi. {data.latest} versiyasini o'rnating.
        </T>
        {data.changelog ? <T kind="muted" style={{ textAlign: 'center' }}>{data.changelog}</T> : null}
      </View>
      {data.apk_url ? (
        <Button title="Yangi versiyani yuklab olish" icon="download" onPress={() => Linking.openURL(data.apk_url!)} />
      ) : (
        <Button title="Botdan olish" icon="send" onPress={() => Linking.openURL(BOT_URL)} />
      )}
    </View>
  );
}
