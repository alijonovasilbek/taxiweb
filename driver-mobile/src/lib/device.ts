import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getItem, KEYS, setItem } from './storage';

let cached: string | null = null;

/** Qurilmaning barqaror ID'si: Android ID (bo'lmasa — bir marta yaratilib saqlanadi). Backend: [A-Za-z0-9_.:-]{8,100} */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await getItem(KEYS.deviceId);
  if (!id) {
    let androidId = '';
    try {
      androidId = Platform.OS === 'android' ? Application.getAndroidId() : '';
    } catch {
      androidId = '';
    }
    id = androidId && androidId.length >= 8 ? `and-${androidId}` : `gen-${randomHex(16)}`;
    await setItem(KEYS.deviceId, id);
  }
  cached = id;
  return id;
}

function randomHex(bytes: number): string {
  let s = '';
  for (let i = 0; i < bytes; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return s;
}

export function deviceName(): string {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'Android qurilma';
}

export function deviceInfo() {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    model: deviceName().slice(0, 120),
    os_version: Device.osVersion ?? undefined,
    app_version: Application.nativeApplicationVersion ?? undefined,
  };
}

export const appVersion = () => Application.nativeApplicationVersion ?? '0.0.0';

/** Fon ilovalarini "o'ldiradigan" brendlar (PLAN-ANDROID §8) */
export function brand(): 'xiaomi' | 'oppo' | 'huawei' | 'samsung' | 'other' {
  const m = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
  if (/xiaomi|redmi|poco/.test(m)) return 'xiaomi';
  if (/oppo|realme|oneplus|vivo/.test(m)) return 'oppo';
  if (/huawei|honor/.test(m)) return 'huawei';
  if (/samsung/.test(m)) return 'samsung';
  return 'other';
}
