import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

/** Bildirishnoma kanallari (server push'i ham shu nomlardan foydalanadi: 'orders' — muhim, 'general') */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Safar holati',
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
  });
  await Notifications.setNotificationChannelAsync('general', {
    name: 'Umumiy bildirishnomalar',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function askNotifications(): Promise<void> {
  try {
    await ensureChannels();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.status !== 'granted' && cur.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    // ruxsatsiz ham ilova ishlaydi
  }
}

/** Ilova fonda bo'lsa (ekran o'chiq, boshqa ilova ochiq) — mahalliy bildirishnoma; ochiq bo'lsa ekranning o'zi ko'rsatadi */
export function notifyIfBackground(title: string, body: string, data: Record<string, unknown> = {}, urgent = false): void {
  if (AppState.currentState === 'active') return;
  void Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: { channelId: urgent ? 'orders' : 'general' },
  }).catch(() => undefined);
}
