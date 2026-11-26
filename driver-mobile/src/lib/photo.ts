import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Hujjat/transport rasmi: kamera yoki galereya → 1600px gacha kichraytirish, JPEG (backend chegarasi 5 MB) */
export async function pickPhoto(source: 'camera' | 'library'): Promise<{ uri: string; name: string; type: string } | null> {
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Kameraga ruxsat berilmadi');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const ctx = ImageManipulator.manipulate(a.uri);
  if ((a.width ?? 0) > 1600 || (a.height ?? 0) > 1600) {
    if ((a.width ?? 0) >= (a.height ?? 0)) ctx.resize({ width: 1600 });
    else ctx.resize({ height: 1600 });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  return { uri: out.uri, name: `photo-${Date.now()}.jpg`, type: 'image/jpeg' };
}

/** React Native FormData fayl qismi */
export function fileForm(fields: Record<string, string>, file: { uri: string; name: string; type: string }): FormData {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  f.append('file', file as unknown as Blob);
  return f;
}
