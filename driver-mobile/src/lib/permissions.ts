import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export type PermState = 'granted' | 'denied' | 'undetermined';

const norm = (s: string): PermState => (s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'undetermined');

export async function locationState(): Promise<PermState> {
  return norm((await Location.getForegroundPermissionsAsync()).status);
}

/** Onlayn paytida foreground service ishlaydi — "Har doim" (fon) ruxsati kerak emas (KAMCHILIKLAR-ANDROID #14) */
export async function requestLocation(): Promise<PermState> {
  return norm((await Location.requestForegroundPermissionsAsync()).status);
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

/** Batareya cheklovini olib tashlash: avval to'g'ridan-to'g'ri tizim so'rovi ("Ruxsat berish" oynasi),
 *  bo'lmasa — optimizatsiya ro'yxati, u ham bo'lmasa — ilova sozlamalari */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = Application.applicationId;
  try {
    if (!pkg) throw new Error('no package');
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${pkg}`,
    });
    return;
  } catch {
    // ba'zi brendlar bu oynani yopib qo'ygan
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    await openAppSettings();
  }
}

/** Ijrochi uchun majburiy ruxsatlar berilganmi (bosh sahifadagi eslatma uchun) */
export async function essentialsGranted(): Promise<boolean> {
  const [l, n] = await Promise.all([locationState(), notificationState()]);
  return l === 'granted' && n === 'granted';
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
