import React, { useRef, useState } from 'react';
import api from '../../services/api';
import { I } from '../icons';

const fmtKm = (km) => (km === undefined || km === null ? '' : km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);

/** Qidiruv natijasini koordinataga aylantiradi (Geosuggest — uri, geocoder/mashhur joy — tayyor lat/lng). */
export async function resolvePlace(item, bias) {
  if (item.lat && item.lng) return { lat: item.lat, lng: item.lng, address: item.address || item.title, title: item.title };
  const params = item.uri
    ? { uri: item.uri }
    : { address: [item.title, item.subtitle].filter(Boolean).join(', '), ...(bias || {}) };
  const { data } = await api.get('/maps/geocode', { params });
  if (!data.length) return null;
  return { lat: data[0].lat, lng: data[0].lng, address: item.title || data[0].address, title: item.title || data[0].title };
}

/**
 * Xarita ustidagi qidiruv (Yandex Go / Oqtepa kabi): joy nomini yozing → ro'yxatdan tanlang → onPick({lat,lng,address}).
 * bias — qidiruv markazi (yaqin joylar birinchi). Joylashuvi: ota-element ichida `position: absolute`.
 */
export default function MapSearch({ bias, onPick, placeholder = 'Joy nomi yoki manzil', style, onFocusChange }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const req = useRef(0);

  const focus = (v) => { setOpen(v); onFocusChange?.(v); };

  const onText = (t) => {
    setText(t);
    clearTimeout(timer.current);
    if (t.trim().length < 2) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const id = ++req.current;
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/maps/suggest', { text: t, lat: bias?.lat, lng: bias?.lng });
        if (id === req.current) setItems(data);
      } catch { if (id === req.current) setItems([]); }
      if (id === req.current) setBusy(false);
    }, 300);
  };

  const choose = async (item) => {
    setBusy(true);
    try {
      const place = await resolvePlace(item, bias);
      if (place) {
        onPick(place);
        setText(''); setItems([]); focus(false);
        document.activeElement?.blur?.();
      }
    } catch {}
    setBusy(false);
  };

  return (
    <div className="map-search" style={style}>
      <div className="bar">
        <I n="search" size={19} stroke={2.4} />
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => onText(e.target.value)}
          onFocus={() => focus(true)}
          onBlur={() => setTimeout(() => focus(false), 180)}
          enterKeyHint="search"
        />
        {text && (
          <button className="clear" onMouseDown={(e) => { e.preventDefault(); setText(''); setItems([]); }} aria-label="Tozalash">
            <I n="close" size={12} stroke={3} />
          </button>
        )}
      </div>
      {open && text.trim().length >= 2 && (
        <div className="list">
          {busy && items.length === 0 && <div className="empty">Qidirilmoqda…</div>}
          {!busy && items.length === 0 && <div className="empty">Hech narsa topilmadi</div>}
          {items.map((s, i) => (
            <button key={i} className="item" onMouseDown={(e) => { e.preventDefault(); choose(s); }}>
              <span className="grow">
                <span className="t">{s.title}</span>
                {s.subtitle && <span className="s">{s.subtitle}</span>}
              </span>
              {(s.distance || s.distance_km !== undefined) && <span className="km">{s.distance || fmtKm(s.distance_km)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
