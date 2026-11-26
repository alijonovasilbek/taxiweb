import React, { useEffect, useRef } from 'react';

const YANDEX_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY;

let ymapsPromise = null;

function loadYmaps() {
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?lang=uz_UZ&apikey=${YANDEX_KEY}`;
    script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return ymapsPromise;
}

function addMarkers(map, ymaps, markers, onDragEndRef, markersRef) {
  markersRef.current.forEach((p) => map.geoObjects.remove(p));
  markersRef.current = markers.map((m) => {
    const preset =
      m.type === 'driver'  ? 'islands#blueCarIcon' :
      m.type === 'pickup'  ? 'islands#greenIcon' :
                             'islands#redIcon';

    const placemark = new ymaps.Placemark(
      [m.lat, m.lng],
      { balloonContent: m.label || '' },
      { preset, draggable: Boolean(m.draggable) }
    );

    if (m.draggable) {
      placemark.events.add('dragend', () => {
        const [lat, lng] = placemark.geometry.getCoordinates();
        onDragEndRef.current?.({ lat, lng, type: m.type });
      });
    }

    map.geoObjects.add(placemark);
    return placemark;
  });
}

/**
 * center   — boshlang'ich/kuzatiladigan markaz (Tracking uchun).
 * focus    — { lat, lng, ts }: xaritani shu nuqtaga silliq olib borish (ts o'zgarsa qayta ishlaydi).
 * onCenterChange — foydalanuvchi xaritani surib/zoom qilib bo'lgach markaz koordinatasi (markaziy pin uchun).
 * onMoveStart    — surish boshlandi (pin "ko'tariladi").
 */
/** routeLine — [{lat, lng}, ...]: marshrut chizig'i */
export default function YandexMap({ center, focus, zoom = 14, markers = [], routeLine, onMapClick, onMarkerDragEnd, onCenterChange, onMoveStart, style }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const markersLatest = useRef(markers);       // har doim eng yangi markers
  const onClickRef    = useRef(onMapClick);    // stale closure muammosini hal qiladi
  const onDragEndRef  = useRef(onMarkerDragEnd);
  const onCenterRef   = useRef(onCenterChange);
  const onMoveRef     = useRef(onMoveStart);
  const focusRef      = useRef(focus);
  const routeObjRef   = useRef(null);
  const [ready, setReady] = React.useState(false);

  // Ref larni har renderda yangilaymiz
  markersLatest.current = markers;
  onClickRef.current    = onMapClick;
  onDragEndRef.current  = onMarkerDragEnd;
  onCenterRef.current   = onCenterChange;
  onMoveRef.current     = onMoveStart;
  focusRef.current      = focus;

  // Xaritani bir marta yaratamiz
  useEffect(() => {
    let destroyed = false;
    loadYmaps().then((ymaps) => {
      if (destroyed || !containerRef.current) return;

      const map = new ymaps.Map(containerRef.current, {
        center: center ? [center.lat, center.lng] : [41.0694, 71.8237],
        zoom,
        controls: [],
      });

      // Ref orqali chaqirish — stale closure yo'q
      map.events.add('click', (e) => {
        const [lat, lng] = e.get('coords');
        onClickRef.current?.({ lat, lng });
      });

      map.events.add('actionbegin', () => onMoveRef.current?.());
      map.events.add('actionend', () => {
        const [lat, lng] = map.getCenter();
        onCenterRef.current?.({ lat, lng });
      });

      mapRef.current = map;
      setReady(true);
      // Xarita yaratilishidan oldin kelgan focus
      if (focusRef.current) map.setCenter([focusRef.current.lat, focusRef.current.lng], 16);

      // Xarita yuklanganda mavjud markerlarni render qilamiz
      if (markersLatest.current.length > 0) {
        addMarkers(map, ymaps, markersLatest.current, onDragEndRef, markersRef);
      }
    });

    return () => {
      destroyed = true;
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; }
    };
  }, []);

  // Markerlar o'zgarganda yangilaymiz
  useEffect(() => {
    if (!mapRef.current || !window.ymaps) return;
    addMarkers(mapRef.current, window.ymaps, markers, onDragEndRef, markersRef);
  }, [markers]);

  // Markazni yangilaymiz
  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.setCenter([center.lat, center.lng]);
  }, [center]);

  // Marshrut chizig'i (backend/OSRM: ko'chalar bo'ylab). 2 nuqtali bo'lsa — taxminiy to'g'ri chiziq (punktir)
  const lineKey = (routeLine || []).length
    ? `${routeLine.length}:${routeLine[0].lat},${routeLine[0].lng}:${routeLine[routeLine.length - 1].lat},${routeLine[routeLine.length - 1].lng}`
    : '';
  useEffect(() => {
    const map = mapRef.current;
    const ymaps = window.ymaps;
    if (!ready || !map || !ymaps) return;
    if (routeObjRef.current) { map.geoObjects.remove(routeObjRef.current); routeObjRef.current = null; }
    if (!lineKey) return;
    const coords = routeLine.map((p) => [p.lat, p.lng]);
    const approx = coords.length <= 2;
    const group = new ymaps.GeoObjectCollection();
    if (!approx) group.add(new ymaps.Polyline(coords, {}, { strokeColor: '#ffffff', strokeWidth: 9, strokeOpacity: 0.9 }));
    group.add(new ymaps.Polyline(coords, {}, {
      strokeColor: '#8c1c3a', strokeWidth: approx ? 4 : 6, strokeStyle: approx ? 'dash' : 'solid', strokeOpacity: 0.95,
    }));
    map.geoObjects.add(group);
    routeObjRef.current = group;
    const bounds = group.getBounds();
    if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: [80, 40, 40, 40], duration: 300 });
  }, [lineKey, ready]);

  // Nuqtaga silliq o'tish (qidiruvdan tanlanganda, "joylashuvim" tugmasi)
  useEffect(() => {
    if (!mapRef.current || !focus) return;
    mapRef.current.setCenter([focus.lat, focus.lng], Math.max(mapRef.current.getZoom(), 16), { duration: 300 });
  }, [focus?.ts]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}
