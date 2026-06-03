import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import YandexMap from '../../components/Map/YandexMap';
import { useLocation } from '../../hooks/useLocation';
import { useOrderStore } from '../../store/orderStore';
import api from '../../services/api';
import { formatPrice, formatDistance, formatDuration } from '../../utils/formatters';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Naqd', icon: '💵' },
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
        .then(({ data }) => {
          setPickupAddress(data.address || '');
          setStep('dropoff');
          setActiveInput('dropoff');
        })
        .catch(() => {});
    }
  }, [myLocation]);

  useEffect(() => {
    if (pickup && dropoff) {
      setRoute(null);
      api.get('/maps/route', {
        params: { fromLat: pickup.lat, fromLng: pickup.lng, toLat: dropoff.lat, toLng: dropoff.lng }
      }).then(({ data }) => setRoute(data)).catch(() => setRoute({}));
    }
  }, [pickup, dropoff]);

  const handleMapPick = async (loc) => {
    const targetType = (pickup && !dropoff) ? 'dropoff' : (activeInput || step);
    try {
      const { data } = await api.get('/maps/reverse-geocode', { params: loc });
      const address = data.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
      if (targetType === 'pickup') {
        setPickup(loc); setPickupAddress(address); setStep('dropoff'); setActiveInput('dropoff');
      } else {
        setDropoff(loc); setDropoffAddress(address); setStep('confirm'); setActiveInput(null);
      }
    } catch {
      const fallback = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
      if (targetType === 'pickup') {
        setPickup(loc); setPickupAddress(fallback); setStep('dropoff'); setActiveInput('dropoff');
      } else {
        setDropoff(loc); setDropoffAddress(fallback); setStep('confirm'); setActiveInput(null);
      }
    }
  };

  const updateAddressFromMap = async (loc, type) => {
    try {
      const { data } = await api.get('/maps/reverse-geocode', { params: loc });
      const address = data.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
      if (type === 'pickup') {
        setPickup(loc); setPickupAddress(address);
        if (!dropoff) { setStep('dropoff'); setActiveInput('dropoff'); }
      } else {
        setDropoff(loc); setDropoffAddress(address); setStep('confirm'); setActiveInput(null);
      }
    } catch {
      const fallback = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
      if (type === 'pickup') {
        setPickup(loc); setPickupAddress(fallback);
        if (!dropoff) { setStep('dropoff'); setActiveInput('dropoff'); }
      } else {
        setDropoff(loc); setDropoffAddress(fallback); setStep('confirm'); setActiveInput(null);
      }
    }
  };

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
        if (activeInput === 'pickup') {
          setPickup(loc); setPickupAddress(data[0].address); setStep('dropoff'); setActiveInput('dropoff');
        } else {
          setDropoff(loc); setDropoffAddress(data[0].address); setStep('confirm'); setActiveInput(null);
        }
      }
    } catch {}
    setSuggests([]);
  };

  const handleMarkerDrag = useCallback(
    ({ lat, lng, type }) => updateAddressFromMap({ lat, lng }, type),
    [pickup, dropoff]
  );

  const handleOrder = async () => {
    if (!pickup || !dropoff) return;
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
    pickup && { ...pickup, type: 'pickup', label: 'Chiqish joyi', draggable: true },
    dropoff && { ...dropoff, type: 'dropoff', label: 'Borish joyi', draggable: true },
  ].filter(Boolean);

  const inputBase = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box',
    color: '#1E293B', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <YandexMap
          center={pickup || myLocation}
          markers={markers}
          onMapClick={handleMapPick}
          onMarkerDragEnd={handleMarkerDrag}
          style={{ height: '100%' }}
        />
      </div>

      <div style={{ background: '#fff', padding: '14px 16px 20px', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
        {/* Address inputs */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
            <input
              placeholder="Chiqish manzili"
              value={pickupAddress}
              onChange={(e) => handleSearch(e.target.value, 'pickup')}
              onFocus={() => { setActiveInput('pickup'); setStep('pickup'); }}
              style={{ ...inputBase, borderColor: activeInput === 'pickup' ? '#2563EB' : '#E2E8F0' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
            <input
              placeholder="Borish manzili"
              value={dropoffAddress}
              onChange={(e) => handleSearch(e.target.value, 'dropoff')}
              onFocus={() => { setActiveInput('dropoff'); setStep('dropoff'); }}
              style={{ ...inputBase, borderColor: activeInput === 'dropoff' ? '#2563EB' : '#E2E8F0' }}
            />
          </div>
        </div>

        {/* Suggestions */}
        {suggests.length > 0 && (
          <div style={{ background: '#F8FAFC', borderRadius: 10, marginBottom: 10, maxHeight: 150, overflow: 'auto', border: '1px solid #E2E8F0' }}>
            {suggests.map((s, i) => (
              <div key={i}
                style={{ padding: '9px 14px', borderBottom: i < suggests.length - 1 ? '1px solid #F1F5F9' : 'none', cursor: 'pointer' }}
                onClick={() => handleSelectSuggest(s)}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}>{s.title}</div>
                {s.subtitle && <div style={{ fontSize: 12, color: '#94A3B8' }}>{s.subtitle}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Route info */}
        {route && route.distance_km > 0 && (
          <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              {formatDistance(route.distance_km)} · {formatDuration(route.duration_min)}
            </div>
            {route.price && <div style={{ fontSize: 18, fontWeight: 700, color: '#2563EB' }}>{formatPrice(route.price)}</div>}
          </div>
        )}

        {/* Payment methods */}
        {route && route.distance_km > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflow: 'auto', paddingBottom: 2 }}>
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                style={{
                  padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: paymentMethod === m.id ? '#2563EB' : '#E2E8F0',
                  background: paymentMethod === m.id ? '#EFF6FF' : '#fff',
                  color: paymentMethod === m.id ? '#2563EB' : '#64748B',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}

        <button
          disabled={!pickup || !dropoff || loading}
          onClick={handleOrder}
          style={{
            width: '100%', padding: 15, fontSize: 16, fontWeight: 700,
            background: pickup && dropoff ? '#2563EB' : '#CBD5E1',
            color: '#fff', border: 'none', borderRadius: 12,
            cursor: pickup && dropoff ? 'pointer' : 'default',
            boxShadow: pickup && dropoff ? '0 4px 16px rgba(37,99,235,0.35)' : 'none',
          }}>
          {loading ? 'Buyurtma yuborilmoqda...' : '🚕 Taksi buyurtma qilish'}
        </button>
      </div>
    </div>
  );
}
