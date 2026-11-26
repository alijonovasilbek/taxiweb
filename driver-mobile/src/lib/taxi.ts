/**
 * Taksi: onlayn bo'lish va fondagi GPS (PLAN-ANDROID §7, B5).
 *
 * - Onlayn paytida Android foreground service ishlaydi (doimiy bildirishnoma) — ekran o'chganda ham joylashuv
 *   keladi. Buning uchun "Har doim" (fon) ruxsati kerak emas, ilova ishlayotgandagi ruxsat yetarli.
 * - Nuqtalar navbatga yoziladi va paket qilib POST /drivers/me/locations ga yuboriladi; internet bo'lmasa
 *   oxirgi 500 tasi saqlanadi va keyin yuboriladi.
 * - Harakat bo'lmasa ham har 20 soniyada nuqta keladi (distanceInterval: 0) — backend 90 soniya jimlikda
 *   haydovchini oflayn qiladi.
 *
 * MUHIM: TaskManager.defineTask modul yuklanganda (top-level) chaqiriladi — bu fayl ildiz layout'da import qilinadi.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { api, ApiError, getAccessToken, loadSession, onSessionChange } from '../api/client';
import { ensureChannels } from './permissions';

export const LOCATION_TASK = 'chortoq-taxi-location';
const MAX_QUEUE = 500;
const BATCH = 20;

type Point = { lat: number; lng: number; ts: string; heading?: number; speed?: number; accuracy?: number };

let queue: Point[] = [];
let flushing = false;

function toPoint(l: Location.LocationObject): Point {
  const c = l.coords;
  return {
    lat: c.latitude,
    lng: c.longitude,
    ts: new Date(l.timestamp).toISOString(),
    heading: c.heading != null && c.heading >= 0 && c.heading <= 360 ? c.heading : undefined,
    speed: c.speed != null && c.speed >= 0 && c.speed <= 100 ? c.speed : undefined,
    accuracy: c.accuracy != null && c.accuracy >= 0 ? c.accuracy : undefined,
  };
}

export function enqueue(locs: Location.LocationObject[]): void {
  queue.push(...locs.map(toPoint));
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
}

/** Navbatdagi nuqtalarni yuboradi. Tarmoq xatosida navbatda qoladi. */
export async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    // Ilova yopilib, faqat fon xizmati qolgan bo'lsa xotiradagi token bo'sh — saqlanganidan o'qiymiz
    if (!getAccessToken()) await loadSession();
    while (queue.length) {
      const part = queue.slice(0, BATCH);
      try {
        await api('/drivers/me/locations', { method: 'POST', body: { points: part } });
        queue = queue.slice(part.length);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
          // Endi taksi haydovchisi emas yoki sessiya tugagan — fon xizmatini to'xtatamiz
          queue = [];
          await stopUpdates();
        } else if (e instanceof ApiError && e.status === 422) {
          queue = queue.slice(part.length); // yaroqsiz paketni tashlab, davom etamiz
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  enqueue(data.locations);
  await flush();
});

export async function isTracking(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

async function startUpdates(): Promise<void> {
  if (await isTracking()) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 20_000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Chortoq Ijrochi: onlaynsiz',
      notificationBody: 'Yangi buyurtmalar kutilmoqda. Oflayn bo‘lish — ilovada.',
      notificationColor: '#8c1c3a',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopUpdates(): Promise<void> {
  if (await isTracking()) {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    } catch {
      // allaqachon to'xtagan
    }
  }
}

export class OnlineError extends Error {
  constructor(message: string, public kind: 'permission' | 'server' | 'location') {
    super(message);
  }
}

/** Onlayn bo'lish: ruxsat → server → hozirgi joylashuv (dispetcher darhol topishi uchun) → fon xizmati */
export async function goOnline(): Promise<void> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new OnlineError("Onlayn bo'lish uchun joylashuvga ruxsat bering (Profil → Ruxsatlar)", 'permission');
  }
  await ensureChannels();
  let first: Location.LocationObject | null = null;
  try {
    first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    first = await Location.getLastKnownPositionAsync();
  }
  if (!first) throw new OnlineError("Joylashuvni aniqlab bo'lmadi. GPS yoqilganini tekshiring.", 'location');
  try {
    await api('/drivers/me/status', { method: 'PUT', body: { is_online: true } });
  } catch (e) {
    throw new OnlineError(e instanceof Error ? e.message : 'Server xatosi', 'server');
  }
  enqueue([first]);
  await flush();
  await startUpdates();
}

export async function goOffline(): Promise<void> {
  await stopUpdates();
  queue = [];
  await api('/drivers/me/status', { method: 'PUT', body: { is_online: false } });
}

/** Server holati bilan moslash: serverda onlayn, lekin fon xizmati yo'q (ilova qayta ishga tushgan) — tiklaymiz */
export async function syncTracking(serverOnline: boolean): Promise<void> {
  const tracking = await isTracking();
  if (serverOnline && !tracking) {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      try {
        await startUpdates();
      } catch {
        // Android 12+: fon holatida foreground service boshlab bo'lmaydi — ilova ochilganda qayta urinadi
      }
    }
  } else if (!serverOnline && tracking) {
    await stopUpdates();
  }
}

// Sessiya tugasa (chiqish, bloklash, boshqa qurilmadan yopish) — GPS ham to'xtaydi
onSessionChange((signedIn) => {
  if (!signedIn) {
    queue = [];
    void stopUpdates();
  }
});
