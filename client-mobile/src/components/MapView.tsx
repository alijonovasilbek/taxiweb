/**
 * Yandex xaritasi (WebView): sahifa backend'da (/api/maps/embed) — kalit serverda qoladi, Web App bilan bir xil xarita.
 * Ilova → xarita: buyruqlar (markaz, belgilar, marshrut, ko'rinishga sig'dirish).
 * Xarita → ilova: 'ready', 'move' (surish boshlandi), 'center' (to'xtagan markaz), 'click'.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';

import { API_URL, DEFAULT_CENTER } from '../config';
import { isDark, useTheme } from '../theme';
import { T } from './ui';

// react-native-webview 14 tiplari RN 0.88 tiplari bilan "never" bo'lib qoladi — komponentni o'zimiz tiplaymiz
type WebViewRef = { injectJavaScript: (js: string) => void };
const WebView = RNWebView as unknown as ComponentType<Record<string, unknown> & { ref?: unknown }>;

export type LatLng = { lat: number; lng: number };
export type MapMarker = LatLng & { id: string; type: 'pickup' | 'dropoff' | 'driver' | 'car' | 'point' };

export type MapHandle = {
  center: (p: LatLng, zoom?: number, animate?: boolean) => void;
  fit: (bottomInset?: number) => void;
};

type Props = {
  initial?: LatLng | null;
  markers?: MapMarker[];
  route?: [number, number][] | null;
  onCenter?: (p: LatLng) => void;
  onMoveStart?: () => void;
  onReady?: () => void;
};

export const MapView = forwardRef<MapHandle, Props>(function MapView(
  { initial, markers, route, onCenter, onMoveStart, onReady }, ref,
) {
  const t = useTheme();
  const web = useRef<WebViewRef>(null);
  const ready = useRef(false);
  const queue = useRef<object[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Boshlang'ich URL bir marta hisoblanadi — markaz o'zgarsa sahifa qayta yuklanmasin
  const [uri] = useState(() => embedUrl(initial ?? DEFAULT_CENTER, isDark(t)));

  const send = useCallback((cmd: object) => {
    if (!ready.current) {
      queue.current.push(cmd);
      return;
    }
    web.current?.injectJavaScript(`window.csCmd(${JSON.stringify(cmd)});true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    center: (p, zoom, animate = true) => send({ t: 'center', lat: p.lat, lng: p.lng, zoom, animate }),
    fit: (bottom) => send({ t: 'fit', bottom }),
  }), [send]);

  useEffect(() => {
    send({ t: 'markers', items: markers ?? [] });
  }, [markers, send]);

  useEffect(() => {
    send({ t: 'route', points: route ?? [] });
  }, [route, send]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: any;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.t === 'ready') {
      ready.current = true;
      setLoaded(true);
      const q = queue.current;
      queue.current = [];
      q.forEach((c) => web.current?.injectJavaScript(`window.csCmd(${JSON.stringify(c)});true;`));
      onReady?.();
    } else if (m.t === 'error') setFailed(true);
    else if (m.t === 'move') onMoveStart?.();
    else if (m.t === 'center') onCenter?.({ lat: m.lat, lng: m.lng });
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={web}
        source={{ uri, headers: { 'ngrok-skip-browser-warning': '1' } }}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        // Tezlik: GPU bilan chizish, HTTP kesh (sahifa va Yandex skriptlari qayta yuklanmaydi)
        androidLayerType="hardware"
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        style={{ flex: 1, backgroundColor: t.bg }}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
      />
      {!loaded ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, gap: 10 }]} pointerEvents="none">
          {failed ? <T kind="muted">Xarita yuklanmadi. Manzilni qidiruv orqali tanlang.</T> : <ActivityIndicator color={t.primary} />}
        </View>
      ) : null}
    </View>
  );
});

/** Markaz yaxlitlanadi — bir xil URL bo'lsa sahifa WebView keshidan olinadi */
function embedUrl(c: LatLng, dark: boolean) {
  return `${API_URL}/api/maps/embed?lat=${c.lat.toFixed(3)}&lng=${c.lng.toFixed(3)}&dark=${dark ? 1 : 0}`;
}

/**
 * Ko'rinmas "isitish": bosh sahifa ochilgach Yandex xarita skriptlarini WebView keshiga yuklab qo'yadi,
 * shunda "Taksi" ekranida xarita bir necha soniya tezroq chiqadi. Yuklangach o'zi yopiladi.
 */
export function MapWarmup() {
  const [stage, setStage] = useState<'wait' | 'load' | 'done'>('wait');
  useEffect(() => {
    const id = setTimeout(() => setStage('load'), 1500);
    return () => clearTimeout(id);
  }, []);
  if (stage !== 'load') return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 2, height: 2, opacity: 0, left: -10, top: -10 }}>
      <WebView
        source={{ uri: embedUrl(DEFAULT_CENTER, false), headers: { 'ngrok-skip-browser-warning': '1' } }}
        javaScriptEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        onMessage={(e: WebViewMessageEvent) => {
          if (e.nativeEvent.data.includes('"ready"') || e.nativeEvent.data.includes('"error"')) setStage('done');
        }}
        onError={() => setStage('done')}
      />
    </View>
  );
}
