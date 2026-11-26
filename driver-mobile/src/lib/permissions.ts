import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export type PermState = 'granted' | 'denied' | 'undetermined';

const norm = (s: string): PermState => (s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'undetermined');

export async function locationState(): Promise<{ foreground: PermState; background: PermState }> {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return { foreground: norm(fg.status), background: norm(bg.status) };
}

export async function requestForegroundLocation(): Promise<PermState> {
  return norm((await Location.requestForegroundPermissionsAsync()).status);
}

/** Android 11+ da tizim sozlamalari ochiladi — foydalanuvchi "Har doim ruxsat berish"ni tanlashi kerak */
export async function requestBackgroundLocation(): Promise<PermState> {
  if ((await requestForegroundLocation()) !== 'granted') return 'denied';
  return norm((await Location.requestBackgroundPermissionsAsync()).status);
}

/** Bildirishnoma kanallari. Android 13+ da kanal bo'lmasa ruxsat oynasi chiqmaydi — shuning uchun avval yaratamiz. */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Yangi buyurtmalar',
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 400, 250, 400],
  });
  await Notifications.setNotificationChannelAsync('general', {
    name: 'Umumiy bildirishnomalar',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function notificationState(): Promise<PermState> {
  return norm((await Notifications.getPermissionsAsync()).status);
}

export async function requestNotifications(): Promise<PermState> {
  await ensureChannels();
  return norm((await Notifications.requestPermissionsAsync()).status);
}

/** Batareya optimizatsiyasi ro'yxati (bu yerdan ilovani "cheklanmagan" qilish mumkin) */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    await openAppSettings();
  }
}

/** Ilova sozlamalari (avtozapusk, batareya, ruxsatlar — brendga qarab shu yerda) */
export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'android' && Application.applicationId) {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
        data: `package:${Application.applicationId}`,
      });
      return;
    } catch {
      // pastdagi umumiy yo'l
    }
  }
  await Linking.openSettings();
}
