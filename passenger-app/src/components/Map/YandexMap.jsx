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

export default function YandexMap({ center, zoom = 14, markers = [], onMapClick, onMarkerDragEnd, style }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const markersLatest = useRef(markers);       // har doim eng yangi markers
  const onClickRef    = useRef(onMapClick);    // stale closure muammosini hal qiladi
  const onDragEndRef  = useRef(onMarkerDragEnd);

  // Ref larni har renderda yangilaymiz
  markersLatest.current = markers;
  onClickRef.current    = onMapClick;
  onDragEndRef.current  = onMarkerDragEnd;

  // Xaritani bir marta yaratamiz
  useEffect(() => {
    let destroyed = false;
    loadYmaps().then((ymaps) => {
      if (destroyed || !containerRef.current) return;

      const map = new ymaps.Map(containerRef.current, {
        center: center ? [center.lat, center.lng] : [41.2995, 69.2401],
        zoom,
        controls: [],
      });

      // Ref orqali chaqirish — stale closure yo'q
      map.events.add('click', (e) => {
        const [lat, lng] = e.get('coords');
        onClickRef.current?.({ lat, lng });
      });

      mapRef.current = map;

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

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}
