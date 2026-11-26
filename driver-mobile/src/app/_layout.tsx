import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppVersion } from '../api/hooks';
import { Button, Icon, T } from '../components/ui';
import { appVersion } from '../lib/device';
import { useAuth } from '../store/auth';
import { isDark, useTheme, useThemePref } from '../theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 15_000 } },
});

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const t = useTheme();

  useEffect(() => {
    Promise.all([useAuth.getState().bootstrap(), useThemePref.getState().load()]).finally(() => SplashScreen.hide());
  }, []);

  if (status === 'loading') return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark(t) ? 'light' : 'dark'} />
        <VersionGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
        </VersionGate>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/** Ilova `min_version` dan eski bo'lsa — yangilamaguncha ishlatib bo'lmaydi (PLAN-ANDROID B8) */
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
          Sizdagi versiya ({appVersion()}) endi qo'llab-quvvatlanmaydi. Ishlashda davom etish uchun {data.latest} versiyasini
          o'rnating.
        </T>
        {data.changelog ? <T kind="muted" style={{ textAlign: 'center' }}>{data.changelog}</T> : null}
      </View>
      {data.apk_url ? (
        <Button title="Yangi versiyani yuklab olish" icon="refresh" onPress={() => Linking.openURL(data.apk_url!)} />
      ) : (
        <T kind="muted" style={{ textAlign: 'center' }}>Yangi versiya havolasini botdan oling: /app</T>
      )}
    </View>
  );
}
