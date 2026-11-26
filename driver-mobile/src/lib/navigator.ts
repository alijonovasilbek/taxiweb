import { Linking } from 'react-native';

/** Navigatorni ochish: Yandex Navigator → Yandex Maps → brauzerdagi Yandex Xarita (PLAN-ANDROID §6) */
export async function openNavigator(lat: number, lng: number): Promise<void> {
  const urls = [
    `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`,
    `yandexmaps://maps.yandex.ru/?rtext=~${lat},${lng}&rtt=auto`,
    `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`,
  ];
  for (const u of urls) {
    try {
      await Linking.openURL(u);
      return;
    } catch {
      // ilova o'rnatilmagan — keyingisi
    }
  }
}

export function callPhone(phone: string): void {
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => undefined);
}
