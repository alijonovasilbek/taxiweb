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

function fitMapToContent(map, ymaps, points) {
  if (!points.length) return;
  const bounds = ymaps.util.bounds.fromPoints(points.map((p) => [p.lat, p.lng]));
  map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 24 });
}

export default function YandexMap({ center, zoom = 14, markers = [], polyline = [], style }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);

  useEffect(() => {
    let destroyed = false;
    loadYmaps().then((ymaps) => {
      if (destroyed || !containerRef.current) return;
      mapRef.current = new ymaps.Map(containerRef.current, {
        center: center ? [center.lat, center.lng] : [41.2995, 69.2401],
        zoom,
        controls: [],
      });
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.ymaps) return;
    const ymaps = window.ymaps;

    markersRef.current.forEach((item) => mapRef.current.geoObjects.remove(item));
    markersRef.current = markers.map((marker) => {
      const preset =
        marker.type === 'driver' ? 'islands#blueCarIcon' :
        marker.type === 'pickup' ? 'islands#greenIcon' :
        'islands#redIcon';

      const placemark = new ymaps.Placemark(
        [marker.lat, marker.lng],
        { balloonContent: marker.label || '' },
        { preset }
      );
      mapRef.current.geoObjects.add(placemark);
      return placemark;
    });

    if (routeRef.current) {
      mapRef.current.geoObjects.remove(routeRef.current);
      routeRef.current = null;
    }

    if (polyline.length > 1) {
      routeRef.current = new ymaps.Polyline(
        polyline.map((point) => [point.lat, point.lng]),
        {},
        { strokeColor: '#2563EB', strokeWidth: 5, strokeOpacity: 0.8 }
      );
      mapRef.current.geoObjects.add(routeRef.current);
      fitMapToContent(mapRef.current, ymaps, [...markers, ...polyline]);
    } else if (markers.length) {
      fitMapToContent(mapRef.current, ymaps, markers);
    }
  }, [markers, polyline]);

  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.setCenter([center.lat, center.lng]);
  }, [center]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}
