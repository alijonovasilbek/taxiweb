import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRideStore } from '../../store/rideStore';
import { useDriverStore } from '../../store/driverStore';
import { getSocket } from '../../services/socket';
import api from '../../services/api';
import YandexMap from '../../components/Map/YandexMap';

const RIDE_STEPS = [
  { status: 'accepted', label: 'Yo\'lovchiga boring', btnLabel: 'Keldim', nextStatus: 'driver_arrived', action: 'driver:arrived' },
  { status: 'driver_arrived', label: 'Yo\'lovchini kuting', btnLabel: 'Sayohat boshlandi', nextStatus: 'in_progress', action: 'driver:start_ride' },
  { status: 'in_progress', label: 'Sayohat davom etmoqda', btnLabel: 'Sayohat tugadi', nextStatus: 'completed', action: 'driver:complete_ride' },
];

export default function ActiveRide() {
  const navigate = useNavigate();
  const { activeRide, clearRide } = useRideStore();
  const { driver } = useDriverStore();
  const [rideStatus, setRideStatus] = useState('accepted');
  const [loading, setLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [route, setRoute] = useState(null);

  if (!activeRide) { navigate('/dashboard'); return null; }

  const currentStep = RIDE_STEPS.find((s) => s.status === rideStatus) || RIDE_STEPS[0];
  const targetPoint = rideStatus === 'accepted' ? activeRide.pickup : activeRide.dropoff;

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setDriverLocation({ lat: coords.latitude, lng: coords.longitude }),
      () => setDriverLocation({ lat: driver?.lat || 41.2995, lng: driver?.lng || 69.2401 }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [driver?.lat, driver?.lng]);

  useEffect(() => {
    if (!driverLocation || !targetPoint?.lat || !targetPoint?.lng) return;
    api.get('/maps/route', {
      params: {
        fromLat: driverLocation.lat,
        fromLng: driverLocation.lng,
        toLat: targetPoint.lat,
        toLng: targetPoint.lng,
      },
    }).then(({ data }) => setRoute(data)).catch(() => setRoute(null));
  }, [driverLocation, targetPoint?.lat, targetPoint?.lng, rideStatus]);

  const markers = useMemo(() => ([
    driverLocation && { ...driverLocation, type: 'driver', label: 'Siz' },
    activeRide.pickup && { ...activeRide.pickup, type: 'pickup', label: 'Yo‘lovchi' },
    activeRide.dropoff && { ...activeRide.dropoff, type: 'dropoff', label: 'Manzil' },
  ].filter(Boolean)), [driverLocation, activeRide]);

  const handleAction = async () => {
    setLoading(true);
    const socket = getSocket();

    try {
      const oid = activeRide.order_id;
      if (rideStatus === 'accepted') {
        await api.put(`/orders/${oid}/arrived`);
        socket.emit('driver:arrived', { order_id: oid });
        setRideStatus('driver_arrived');
      } else if (rideStatus === 'driver_arrived') {
        await api.put(`/orders/${oid}/start`);
        socket.emit('driver:start_ride', { order_id: oid });
        setRideStatus('in_progress');
      } else if (rideStatus === 'in_progress') {
        await api.put(`/orders/${oid}/complete`);
        socket.emit('driver:complete_ride', { order_id: oid });
        clearRide();
        navigate('/dashboard');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const openNavigation = () => {
    const { lat, lng } = rideStatus === 'accepted'
      ? { lat: activeRide.pickup?.lat, lng: activeRide.pickup?.lng }
      : { lat: activeRide.dropoff?.lat, lng: activeRide.dropoff?.lng };
    window.open(`yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`, '_blank');
    setTimeout(() => window.open(`https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`, '_blank'), 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>Faol sayohat</h2>

      <div style={{ height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <YandexMap
          center={driverLocation || targetPoint}
          markers={markers}
          polyline={route?.polyline || []}
          style={{ height: '100%' }}
        />
      </div>

      <div style={{ background: '#E8F5E9', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#388E3C' }}>{currentStep.label}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flex: 1 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888' }}>Chiqish joyi</div>
          <div style={{ fontWeight: 500 }}>{activeRide.pickup?.address}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888' }}>Borish joyi</div>
          <div style={{ fontWeight: 500 }}>{activeRide.dropoff?.address}</div>
        </div>
        {route?.distance_km > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#888' }}>Masofa</div>
              <div style={{ fontWeight: 600 }}>{route.distance_km.toFixed(1)} km</div>
            </div>
            <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#888' }}>Vaqt</div>
              <div style={{ fontWeight: 600 }}>{route.duration_min} min</div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1976D2', marginTop: 8 }}>
          {new Intl.NumberFormat('uz-UZ').format(activeRide.price)} so'm
        </div>
      </div>

      <button onClick={openNavigation} style={{
        marginTop: 12, width: '100%', padding: 13, fontSize: 15, fontWeight: 500,
        background: '#fff', border: '1.5px solid #2196F3', color: '#2196F3', borderRadius: 12, cursor: 'pointer',
      }}>
        🗺️ Navigatsiyani ochish
      </button>

      <button disabled={loading} onClick={handleAction} style={{
        marginTop: 10, width: '100%', padding: 15, fontSize: 16, fontWeight: 600,
        background: rideStatus === 'in_progress' ? '#4CAF50' : '#2196F3',
        color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
      }}>
        {loading ? 'Yuklanmoqda...' : currentStep.btnLabel}
      </button>
    </div>
  );
}
