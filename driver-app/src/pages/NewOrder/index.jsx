import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRideStore } from '../../store/rideStore';
import { getSocket } from '../../services/socket';

export default function NewOrder() {
  const navigate = useNavigate();
  const { pendingOrder, clearPending, setActiveRide } = useRideStore();
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
    socket.emit('driver:accept_order', { order_id: pendingOrder.order_id });
    setActiveRide(pendingOrder);
    clearPending();
    navigate('/active-ride');
  };

  const handleReject = () => {
    const socket = getSocket();
    socket.emit('driver:reject_order', { order_id: pendingOrder.order_id });
    clearPending();
    navigate('/dashboard');
  };

  if (!pendingOrder) return null;

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v) + ' so\'m';
  const urgent = countdown < 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Countdown header */}
      <div style={{ background: urgent ? '#DC2626' : '#2563EB', padding: '24px 20px 60px', borderRadius: '0 0 28px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>Yangi buyurtma!</div>
        <div style={{ fontSize: 64, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{countdown}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>soniya qoldi</div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 16 }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#fff',
            width: `${(countdown / (pendingOrder?.timeout || 30)) * 100}%`,
            transition: 'width 1s linear',
          }} />
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -28, flex: 1 }}>
        {/* Order card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Chiqish joyi</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: '#1E293B', lineHeight: 1.4 }}>{pendingOrder.pickup?.address}</div>
              </div>
            </div>

            <div style={{ height: 1, background: '#F1F5F9', marginLeft: 18 }} />

            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Borish joyi</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: '#1E293B', lineHeight: 1.4 }}>{pendingOrder.dropoff?.address}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Masofa</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{pendingOrder.distance_km?.toFixed(1)}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>km</div>
          </div>
          <div style={{ background: '#EFF6FF', borderRadius: 14, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, color: '#2563EB', marginBottom: 4 }}>Narx</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2563EB' }}>{new Intl.NumberFormat('uz-UZ').format(pendingOrder.price)}</div>
            <div style={{ fontSize: 11, color: '#2563EB' }}>so'm</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Reyting</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>⭐ {pendingOrder.passenger_rating}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleReject} style={{
            flex: 1, padding: 16, fontSize: 16, fontWeight: 600,
            background: '#fff', color: '#DC2626', border: '2px solid #DC2626', borderRadius: 14, cursor: 'pointer',
          }}>
            Rad etish
          </button>
          <button onClick={handleAccept} style={{
            flex: 2, padding: 16, fontSize: 16, fontWeight: 700,
            background: '#16A34A', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
          }}>
            Qabul qilish ✓
          </button>
        </div>
      </div>
    </div>
  );
}
