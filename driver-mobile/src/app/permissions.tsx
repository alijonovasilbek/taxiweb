import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, View } from 'react-native';

import { Badge, Button, Card, Icon, Screen, T } from '../components/ui';
import { brand } from '../lib/device';
import {
  locationState, notificationState, openAppSettings, openBatterySettings, requestBackgroundLocation,
  requestForegroundLocation, requestNotifications, type PermState,
} from '../lib/permissions';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';

/** Brendga mos qo'llanma (PLAN-ANDROID §8): fon ilovasini "o'ldirmaslik" uchun */
const BRAND_TIPS: Record<ReturnType<typeof brand>, string[]> = {
  xiaomi: [
    "Sozlamalar → Ilovalar → Chortoq Ijrochi → «Avtozapusk»ni yoqing",
    "«Batareya tejash» → «Cheklovsiz»",
    "So'nggi ilovalar ro'yxatida ilovani pastga torting va 🔒 qulflang",
  ],
  oppo: [
    "Sozlamalar → Batareya → Chortoq Ijrochi → «Fonda ishlashga ruxsat»",
    "«Avtomatik ishga tushish»ni yoqing",
    "So'nggi ilovalar ro'yxatida ilovani qulflang",
  ],
  huawei: [
    "Sozlamalar → Batareya → Ilovalarni ishga tushirish → Chortoq Ijrochi → «Qo'lda boshqarish»",
    "Uchala tugmani ham yoqing: avtomatik ishga tushish, ikkilamchi ishga tushish, fonda ishlash",
  ],
  samsung: [
    "Sozlamalar → Batareya → Fon cheklovlari → «Hech qachon uxlamaydigan ilovalar»ga Chortoq Ijrochi'ni qo'shing",
  ],
  other: ["Batareya sozlamalarida ilova uchun «Cheklovsiz» rejimini tanlang"],
};

type Step = { key: string; icon: string; title: string; text: string; state: PermState | 'info'; action: () => Promise<unknown>; actionTitle: string };

export default function Permissions() {
  const t = useTheme();
  const router = useRouter();
  const done = useAuth((s) => s.permissionsDone);
  const setDone = useAuth((s) => s.setPermissionsDone);
  const [loc, setLoc] = useState<{ foreground: PermState; background: PermState }>({ foreground: 'undetermined', background: 'undetermined' });
  const [notif, setNotif] = useState<PermState>('undetermined');
  const [batteryVisited, setBatteryVisited] = useState(false);

  const refresh = useCallback(async () => {
    const [l, n] = await Promise.all([locationState(), notificationState()]);
    setLoc(l);
    setNotif(n);
  }, []);

  // Sozlamalardan qaytganda holatni yangilaymiz
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  const run = (fn: () => Promise<unknown>) => async () => {
    await fn();
    await refresh();
  };

  const steps: Step[] = [
    {
      key: 'location', icon: 'pin', title: 'Joylashuv',
      text: "Yaqin buyurtmalarni topish va yo'lovchiga qayerdaligingizni ko'rsatish uchun.",
      state: loc.foreground, action: run(requestForegroundLocation), actionTitle: 'Ruxsat berish',
    },
    {
      key: 'background', icon: 'shield', title: 'Fonda joylashuv — «Har doim»',
      text: "Ekran o'chganda ham onlayn qolish uchun. Ochilgan oynada «Har doim ruxsat berish»ni tanlang. Joylashuv faqat siz onlayn paytingizda yuboriladi.",
      state: loc.background, action: run(requestBackgroundLocation), actionTitle: 'Sozlash',
    },
    {
      key: 'notifications', icon: 'bell', title: 'Bildirishnomalar',
      text: "Yangi buyurtma ilova yopiq bo'lsa ham qo'ng'iroq bo'lib kelishi uchun.",
      state: notif, action: run(requestNotifications), actionTitle: 'Ruxsat berish',
    },
    {
      key: 'battery', icon: 'battery', title: 'Batareya cheklovi',
      text: "Ro'yxatdan Chortoq Ijrochi'ni topib, «Cheklanmagan» (optimallashtirmaslik) ni tanlang.",
      state: batteryVisited ? 'granted' : 'info',
      action: async () => {
        await openBatterySettings();
        setBatteryVisited(true);
      },
      actionTitle: 'Ochish',
    },
  ];

  const ready = loc.foreground === 'granted' && notif === 'granted';
  const finish = () => {
    setDone(true);
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <T kind="title">Telefonni sozlash</T>
      <T kind="muted">Buyurtmalar o'z vaqtida kelishi uchun bir martalik sozlash. Keyin Profil bo'limidan qayta ochish mumkin.</T>
      {steps.map((st) => (
        <Card key={st.key}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon n={st.icon} size={22} color={t.primary} />
            <T kind="h2" style={{ flex: 1 }}>{st.title}</T>
            {st.state === 'granted' ? <Badge text="Tayyor" tone="green" /> : st.state === 'denied' ? <Badge text="Rad etilgan" tone="red" /> : null}
          </View>
          <T kind="muted">{st.text}</T>
          {st.state !== 'granted' ? (
            <Button
              title={st.state === 'denied' ? 'Sozlamalarni ochish' : st.actionTitle}
              kind="secondary"
              onPress={st.state === 'denied' ? run(openAppSettings) : st.action}
            />
          ) : null}
        </Card>
      ))}
      <Card>
        <T kind="h2">Telefoningiz uchun maslahat</T>
        {BRAND_TIPS[brand()].map((tip) => (
          <T key={tip} kind="muted">• {tip}</T>
        ))}
        <Button title="Ilova sozlamalari" kind="secondary" onPress={openAppSettings} />
      </Card>
      <Button title={done ? 'Saqlash' : 'Davom etish'} disabled={!ready} onPress={finish} />
      {!ready ? <T kind="small" style={{ textAlign: 'center' }}>Joylashuv va bildirishnomalarga ruxsat bering</T> : null}
      {!ready && !done ? <Button title="Keyinroq" kind="ghost" onPress={finish} /> : null}
    </Screen>
  );
}
