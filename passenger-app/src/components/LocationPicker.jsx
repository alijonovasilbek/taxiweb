import React, { useRef, useState } from 'react';
import api from '../services/api';
import YandexMap from './Map/YandexMap';
import { Modal } from './ui';
import { CHORTOQ, PRESET_PLACES } from '../utils/constants';

const HAS_MAP_KEY = Boolean(import.meta.env.VITE_YANDEX_MAPS_KEY);

async function reverse(loc) {
  try {
    const { data } = await api.get('/maps/reverse-geocode', { params: loc });
    return data.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  } catch {
    return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  }
}

/**
 * Manzil tanlash: matn bo'yicha qidiruv (Yandex suggest), tayyor joylar,
 * joriy joylashuv va xaritadan belgilash.
 * value: {address, lat, lng} | null
 */
export default function LocationPicker({ label, value, onChange, placeholder = 'Manzilni kiriting', dot = 'green' }) {
  const [text, setText] = useState(value?.address || '');
  const [items, setItems] = useState([]);
  const [focused, setFocused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState(null);
  const [locating, setLocating] = useState(false);
  const timer = useRef(null);

  const pick = (p) => {
    setText(p.address);
    setItems([]);
    setFocused(false);
    onChange(p);
  };

  const onText = (t) => {
    setText(t);
    clearTimeout(timer.current);
    if (t.trim().length < 3) { setItems([]); return; }
    timer.current = setTimeout(async () => {
      const local = PRESET_PLACES.filter((p) => p.address.toLowerCase().includes(t.toLowerCase()));
      let remote = [];
      try {
        const { data } = await api.post('/maps/suggest', { text: t });
        remote = data.map((s) => ({ title: s.title, subtitle: s.subtitle }));
      } catch {}
      setItems([...local.map((p) => ({ preset: p, title: p.address })), ...remote]);
    }, 350);
  };

  const choose = async (item) => {
    if (item.preset) return pick(item.preset);
    const query = `${item.title}${item.subtitle ? ', ' + item.subtitle : ''}`;
    try {
      const { data } = await api.get('/maps/geocode', { params: { address: query } });
      if (data.length) pick({ address: data[0].address, lat: data[0].lat, lng: data[0].lng });
    } catch {}
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        pick({ ...loc, address: await reverse(loc) });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const confirmMap = async () => {
    if (!mapPoint) return;
    pick({ ...mapPoint, address: await reverse(mapPoint) });
    setMapOpen(false);
  };

  const showPresets = focused && text.trim().length < 3;

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="row">
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot === 'red' ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
        <input
          className="input"
          value={text}
          placeholder={placeholder}
          onChange={(e) => onText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
      </div>
      {(items.length > 0 || showPresets) && (
        <div className="suggest">
          {showPresets && (
            <div className="suggest-item" onMouseDown={useMyLocation}>📍 {locating ? 'Aniqlanmoqda...' : 'Joriy joylashuvim'}</div>
          )}
          {showPresets && HAS_MAP_KEY && (
            <div className="suggest-item" onMouseDown={() => { setMapPoint(value || null); setMapOpen(true); }}>🗺️ Xaritadan tanlash</div>
          )}
          {(showPresets ? PRESET_PLACES.map((p) => ({ preset: p, title: p.address })) : items).map((it, i) => (
            <div key={i} className="suggest-item" onMouseDown={() => choose(it)}>
              {it.title}
              {it.subtitle && <small>{it.subtitle}</small>}
            </div>
          ))}
        </div>
      )}
      {mapOpen && (
        <Modal title="Xaritadan belgilang" onClose={() => setMapOpen(false)}>
          <div style={{ height: 360, borderRadius: 14, overflow: 'hidden' }}>
            <YandexMap
              center={mapPoint || value || CHORTOQ}
              zoom={13}
              markers={mapPoint ? [{ ...mapPoint, type: dot === 'red' ? 'dropoff' : 'pickup' }] : []}
              onMapClick={setMapPoint}
            />
          </div>
          <button className="btn block mt12" disabled={!mapPoint} onClick={confirmMap}>Tanlash</button>
        </Modal>
      )}
    </div>
  );
}
