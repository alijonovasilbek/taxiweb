import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { useProviderHome, useSessions } from '../../api/hooks';
import { Card, Icon, Row, Screen, T } from '../../components/ui';
import { SUPPORT } from '../../config';
import { appVersion } from '../../lib/device';
import { useAuth } from '../../store/auth';
import { font, useTheme, useThemePref, type ThemePref } from '../../theme';

const ROLE_NAMES: Record<string, string> = {
  driver: 'Haydovchi', cargo: 'Yuk tashuvchi', equipment_owner: 'Texnika egasi', company: 'Kompaniya',
};

export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const { data } = useProviderHome();
  const sessions = useSessions();
  const logout = useAuth((s) => s.logout);
  const pref = useThemePref((s) => s.pref);
  const setPref = useThemePref((s) => s.set);
  const u = data?.user;

  const confirmLogout = (all: boolean) =>
    Alert.alert(
      all ? 'Barcha qurilmalardan chiqish' : 'Chiqish',
      all ? "Barcha telefonlardagi Chortoq Ijrochi sessiyalari yopiladi." : 'Qayta kirish uchun Telegram kerak bo‘ladi.',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { text: 'Chiqish', style: 'destructive', onPress: () => void logout(all) },
      ],
    );

  return (
    <Screen>
      <T kind="title">Profil</T>
      <Card>
        <T kind="h2">{u?.first_name ?? '…'}</T>
        <T kind="muted">{u?.phone ?? 'Telefon tasdiqlanmagan'}</T>
        <T kind="small">
          {(u?.roles ?? []).filter((r) => r !== 'client').map((r) => ROLE_NAMES[r] ?? r).join(' · ') || 'Ijrochi roli hali yo‘q'}
          {u?.provider_rating ? ` · ★ ${Number(u.provider_rating).toFixed(1)}` : ''}
        </T>
      </Card>

      <Card>
        <T kind="label">Mavzu</T>
        <View style={{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: 12, padding: 3 }}>
          {(['system', 'light', 'dark'] as ThemePref[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPref(p)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: pref === p ? t.card : 'transparent' }}
            >
              <T style={{ fontFamily: pref === p ? font.bold : font.medium }}>{{ system: 'Tizim', light: 'Kunduzgi', dark: 'Tungi' }[p]}</T>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Row icon="shield" title="Ruxsatlar va telefon sozlamalari" subtitle="Joylashuv, bildirishnoma, batareya" onPress={() => router.push('/permissions')} />
      </Card>

      <Card>
        <T kind="label">Faol qurilmalar</T>
        {(sessions.data ?? []).map((s) => (
          <Row key={s.id} icon="phone" title={s.device_name || 'Android'} subtitle={s.current ? 'Shu qurilma' : `Oxirgi faollik: ${new Date(s.last_used_at).toLocaleDateString('ru-RU')}`} />
        ))}
        <Row icon="logout" title="Barcha qurilmalardan chiqish" onPress={() => confirmLogout(true)} />
      </Card>

      <Card>
        <Row icon="logout" title="Chiqish" tint={t.red} onPress={() => confirmLogout(false)} />
      </Card>

      <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
        <Icon n="shield" size={16} color={t.faint} />
        <T kind="small">Chortoq Ijrochi {appVersion()} · Yordam: {SUPPORT}</T>
      </View>
    </Screen>
  );
}
