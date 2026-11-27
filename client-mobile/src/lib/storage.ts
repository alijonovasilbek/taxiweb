import * as SecureStore from 'expo-secure-store';

/** Android Keystore bilan shifrlangan saqlash. Xato bo'lsa (masalan, kalit yo'qolgan) — bo'sh qiymat. */
export async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // saqlab bo'lmasa ham ilova ishlashda davom etadi (keyingi ochilishda qayta kirish so'raladi)
  }
}

export const KEYS = {
  refresh: 'auth.refresh',
  access: 'auth.access',
  deviceId: 'device.id',
  theme: 'ui.theme',
  recentPlaces: 'places.recent',
} as const;
