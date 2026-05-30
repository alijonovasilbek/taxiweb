import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRideStore } from '../../store/rideStore';
import { getSocket } from '../../services/socket';
import { useDriverStore } from '../../store/driverStore';

export default function NewOrder() {
  const navigate = useNavigate();
  const { pendingOrder, clearPending, setActiveRide } = useRideStore();
  const { driver } = useDriverStore();
  const [countdown, setCountdown] = useState(pendingOrder?.timeout || 30);

  useEffect(() => {
    if (!pendingOrder) { navigate('/dashboard'); return; }
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          clearPending();
          navigate('/dashboard');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingOrder]);

  const handleAccept = () => {
    const socket = getSocket();
    socket.emit('driver:accept_order', { driverId: driver.id, orderId: pendingOrder.orderId });
    setActiveRide(pendingOrder);
    clearPending();
    navigate('/active-ride');
  };

  const handleReject = () => {
    const socket = getSocket();
    socket.emit('driver:reject_order', { driverId: driver.id, orderId: pendingOrder.orderId });
    clearPending();
    navigate('/dashboard');
  };

  if (!pendingOrder) return null;

  const formatPrice = (v) => new Intl.NumberFormat('uz-UZ').format(v) + ' so\'m';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 48, color: countdown < 10 ? '#f44336' : '#2196F3', fontWeight: 700 }}>{countdown}</div>
        <div style={{ color: '#888', fontSize: 13 }}>soniya qoldi</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', flex: 1 }}>
        <h3 style={{ marginBottom: 16 }}>Yangi buyurtma!</h3>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Chiqish joyi</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{pendingOrder.pickup?.address}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Borish joyi</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{pendingOrder.dropoff?.address}</div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888' }}>Masofa</div>
            <div style={{ fontWeight: 600 }}>{pendingOrder.distanceKm?.toFixed(1)} km</div>
          </div>
          <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888' }}>Narx</div>
            <div style={{ fontWeight: 600, color: '#1976D2' }}>{formatPrice(pendingOrder.price)}</div>
          </div>
          <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888' }}>Reyting</div>
            <div style={{ fontWeight: 600 }}>⭐ {pendingOrder.passengerRating}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={handleReject} style={{
          flex: 1, padding: 16, fontSize: 16, fontWeight: 600,
          background: '#fff', color: '#f44336', border: '2px solid #f44336', borderRadius: 14, cursor: 'pointer',
        }}>Rad etish</button>
        <button onClick={handleAccept} style={{
          flex: 2, padding: 16, fontSize: 16, fontWeight: 600,
          background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer',
        }}>Qabul qilish ✓</button>
      </div>
    </div>
  );
}
