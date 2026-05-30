import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import YandexMap from '../../components/Map/YandexMap';
import { useLocation } from '../../hooks/useLocation';
import { useOrderStore } from '../../store/orderStore';
import api from '../../services/api';
import { formatPrice, formatDistance, formatDuration } from '../../utils/formatters';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Naqd pul', icon: '💵' },
  { id: 'payme', label: 'Payme', icon: '💳' },
  { id: 'click', label: 'Click', icon: '💳' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
];

export default function BookRide() {
  const navigate = useNavigate();
  const { location: myLocation } = useLocation();
  const { createOrder } = useOrderStore();

  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [suggests, setSuggests] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [route, setRoute] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('pickup');

  useEffect(() => {
    if (myLocation && !pickup) {
      setPickup(myLocation);
      api.get('/maps/reverse-geocode', { params: myLocation })
        .then(({ data }) => setPickupAddress(data.address || ''))
        .catch(() => {});
    }
  }, [myLocation]);

  useEffect(() => {
    if (pickup && dropoff) {
      api.get('/maps/route', {
        params: { fromLat: pickup.lat, fromLng: pickup.lng, toLat: dropoff.lat, toLng: dropoff.lng }
      }).then(({ data }) => setRoute(data)).catch(() => {});
    }
  }, [pickup, dropoff]);

  const handleSearch = async (text, type) => {
    if (type === 'pickup') setPickupAddress(text);
    else setDropoffAddress(text);
    setActiveInput(type);
    if (text.length < 3) { setSuggests([]); return; }
    try {
      const { data } = await api.post('/maps/suggest', { text });
      setSuggests(data);
    } catch {}
  };

  const handleSelectSuggest = async (item) => {
    const query = `${item.title}${item.subtitle ? ', ' + item.subtitle : ''}`;
    try {
      const { data } = await api.get('/maps/geocode', { params: { address: query } });
      if (data.length) {
        const loc = { lat: data[0].lat, lng: data[0].lng };
        if (activeInput === 'pickup') { setPickup(loc); setPickupAddress(data[0].address); }
        else { setDropoff(loc); setDropoffAddress(data[0].address); setStep('confirm'); }
      }
    } catch {}
    setSuggests([]);
    setActiveInput(null);
  };

  const handleOrder = async () => {
    if (!pickup || !dropoff || !route) return;
    setLoading(true);
    try {
      const order = await createOrder({
        pickup: { ...pickup, address: pickupAddress },
        dropoff: { ...dropoff, address: dropoffAddress },
        paymentMethod,
      });
      navigate(`/tracking/${order.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const markers = [
    pickup && { ...pickup, type: 'pickup', label: 'Chiqish joyi' },
    dropoff && { ...dropoff, type: 'dropoff', label: 'Borish joyi' },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <YandexMap
          center={pickup || myLocation}
          markers={markers}
          onMapClick={(loc) => {
            if (step === 'pickup') setPickup(loc);
            else setDropoff(loc);
          }}
          style={{ height: '100%' }}
        />
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: 10 }}>
          <input
            placeholder="Chiqish manzili"
            value={pickupAddress}
            onChange={(e) => handleSearch(e.target.value, 'pickup')}
            onFocus={() => setActiveInput('pickup')}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 8 }}
          />
          <input
            placeholder="Borish manzili"
            value={dropoffAddress}
            onChange={(e) => handleSearch(e.target.value, 'dropoff')}
            onFocus={() => setActiveInput('dropoff')}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #ddd', fontSize: 15 }}
          />
        </div>

        {suggests.length > 0 && (
          <div style={{ background: '#f9f9f9', borderRadius: 10, marginBottom: 10, maxHeight: 160, overflow: 'auto' }}>
            {suggests.map((s, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                onClick={() => handleSelectSuggest(s)}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</div>
                {s.subtitle && <div style={{ fontSize: 12, color: '#888' }}>{s.subtitle}</div>}
              </div>
            ))}
          </div>
        )}

        {route && (
          <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#555' }}>
              {formatDistance(route.distanceKm)} · {formatDuration(route.durationMin)}
            </div>
            {route.price && <div style={{ fontSize: 18, fontWeight: 700, color: '#1976D2' }}>{formatPrice(route.price)}</div>}
          </div>
        )}

        {route && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflow: 'auto', paddingBottom: 4 }}>
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                style={{
                  padding: '8px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: paymentMethod === m.id ? '#1976D2' : '#ddd',
                  background: paymentMethod === m.id ? '#E3F2FD' : '#fff',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}

        <button
          disabled={!pickup || !dropoff || !route || loading}
          onClick={handleOrder}
          style={{
            width: '100%', padding: 15, fontSize: 16, fontWeight: 600,
            background: pickup && dropoff && route ? 'var(--tg-theme-button-color, #2196F3)' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 12, cursor: pickup && dropoff ? 'pointer' : 'default',
          }}>
          {loading ? 'Buyurtma yuborilmoqda...' : 'Taksi buyurtma qilish'}
        </button>
      </div>
    </div>
  );
}
