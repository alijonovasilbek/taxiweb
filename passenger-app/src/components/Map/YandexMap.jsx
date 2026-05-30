import React, { useEffect, useRef } from 'react';

const YANDEX_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY;

let ymapsReady = false;
let ymapsPromise = null;

function loadYmaps() {
  if (ymapsReady) return Promise.resolve(window.ymaps);
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?lang=uz_UZ&apikey=${YANDEX_KEY}`;
    script.onload = () => {
      window.ymaps.ready(() => { ymapsReady = true; resolve(window.ymaps); });
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return ymapsPromise;
}

export default function YandexMap({ center, zoom = 14, markers = [], route = null, onMapClick, style }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    let destroyed = false;
    loadYmaps().then((ymaps) => {
      if (destroyed || !containerRef.current) return;
      mapRef.current = new ymaps.Map(containerRef.current, {
        center: center ? [center.lat, center.lng] : [41.2995, 69.2401],
        zoom,
        controls: [],
      });

      if (onMapClick) {
        mapRef.current.events.add('click', (e) => {
          const [lat, lng] = e.get('coords');
          onMapClick({ lat, lng });
        });
      }
    });

    return () => {
      destroyed = true;
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const ymaps = window.ymaps;
    markersRef.current.forEach((m) => mapRef.current.geoObjects.remove(m));
    markersRef.current = markers.map((m) => {
      const placemark = new ymaps.Placemark(
        [m.lat, m.lng],
        { balloonContent: m.label || '' },
        { preset: m.type === 'driver' ? 'islands#blueCarIcon' : m.type === 'pickup' ? 'islands#greenIcon' : 'islands#redIcon' }
      );
      mapRef.current.geoObjects.add(placemark);
      return placemark;
    });
  }, [markers]);

  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.setCenter([center.lat, center.lng]);
  }, [center]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}
