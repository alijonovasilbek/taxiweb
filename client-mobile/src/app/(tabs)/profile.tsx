import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { api } from '../../api/client';

import { useCredentials, useMe, useSessions } from '../../api/hooks';
import { Field, Input } from '../../components/form';
import { Button, Card, ErrorNote, Icon, Row, Screen, T } from '../../components/ui';
import { DRIVER_APP_URL, SUPPORT } from '../../config';
import { appVersion } from '../../lib/device';
import { useAuth } from '../../store/auth';
import { font, useTheme, useThemePref, type ThemePref } from '../../theme';

export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const { data: u } = useMe();
  const sessions = useSessions();
  const logout = useAuth((s) => s.logout);
  const pref = useThemePref((s) => s.pref);
  const setPref = useThemePref((s) => s.set);

  const confirmLogout = (all: boolean) =>
    Alert.alert(
      all ? 'Barcha qurilmalardan chiqish' : 'Chiqish',
      all ? "Barcha telefonlardagi ilova sessiyalari yopiladi." : 'Qayta kirish: Telegram yoki login/parol orqali.',
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
        {u?.rating ? <T kind="small">★ {Number(u.rating).toFixed(1)} · yo'lovchi reytingi</T> : null}
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

      <LoginCard />

      <Card>
        <Row icon="home" title="Mening manzillarim" subtitle="Uy va ish — taksini bir bosishda chaqirish" onPress={() => router.push('/places')} />
        <Row icon="bell" title="Bildirishnomalar" onPress={() => router.push('/notifications')} />
        <Row icon="taxi" title="Haydovchi yoki ijrochi bo'lish" subtitle="«Chortoq Ijrochi» ilovasini yuklab oling"
          onPress={() => Linking.openURL(DRIVER_APP_URL)} />
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
        <T kind="small">Chortoq {appVersion()} · Yordam: {SUPPORT}</T>
      </View>
    </Screen>
  );
}

/** Ilova logini va parolni almashtirish. Parol yo'q bo'lsa — botdagi /parol */
function LoginCard() {
  const { data, refetch } = useCredentials();
  const [open, setOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (newPw.length < 6) return setErr("Yangi parol kamida 6 belgi bo'lsin");
    setErr(null);
    setBusy(true);
    try {
      await api('/auth/app/password', { method: 'PUT', body: { old_password: oldPw, new_password: newPw } });
      setOpen(false);
      setOldPw('');
      setNewPw('');
      void refetch();
      Alert.alert('Parol almashtirildi', 'Keyingi kirishda yangi parolni ishlating.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <T kind="label">Kirish ma'lumotlari</T>
      <Row icon="shield" title={data?.login ? `Login: ${data.login}` : 'Login hali berilmagan'}
        subtitle={data?.has_password ? 'Parol o‘rnatilgan' : 'Botda /parol yozing — login va parol keladi'} />
      {data?.has_password ? (
        open ? (
          <View style={{ gap: 10 }}>
            <Field label="Joriy parol"><Input value={oldPw} onChangeText={setOldPw} secure maxLength={100} /></Field>
            <Field label="Yangi parol"><Input value={newPw} onChangeText={setNewPw} secure maxLength={100} /></Field>
            <ErrorNote error={err} />
            <Button title="Saqlash" icon="check" loading={busy} onPress={save} />
            <Button title="Bekor qilish" kind="ghost" onPress={() => { setOpen(false); setErr(null); }} />
          </View>
        ) : (
          <Button title="Parolni almashtirish" kind="secondary" onPress={() => setOpen(true)} />
        )
      ) : null}
    </Card>
  );
}
