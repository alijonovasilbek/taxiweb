import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { useDriverSocket } from '../../hooks/useSocket';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { getSocket } from '../../services/socket';
import api from '../../services/api';

const StatusScreen = ({ icon, title, subtitle }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center', background: '#F1F5F9' }}>
    <div style={{ fontSize: 64, marginBottom: 16 }}>{icon}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 14, color: '#94A3B8' }}>{subtitle}</div>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { driver, fetchMe } = useDriverStore();
  const { isOnline, setOnline, activeRide } = useRideStore();

  useDriverSocket();
  useDriverLocation();

  useEffect(() => { fetchMe(); }, []);

  if (activeRide) {
    navigate('/active-ride');
    return null;
  }

  if (driver?.status === 'pending') return (
    <StatusScreen icon="⏳" title="Tasdiqlanmoqda" subtitle="Administrator ma'lumotlaringizni tekshiradi" />
  );

  if (driver?.status === 'blocked') return (
    <StatusScreen icon="🚫" title="Hisob bloklandi" subtitle="Batafsil ma'lumot uchun administrator bilan bog'laning" />
  );

  const toggleOnline = async () => {
    const socket = getSocket();
    if (!isOnline) {
      const go = (lat, lng) => {
        socket.emit('driver:go_online', { lat, lng });
        setOnline(true);
        api.put('/drivers/me/status', { isOnline: true }).catch(() => {});
      };
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => go(coords.latitude, coords.longitude),
        () => go(41.2995, 69.2401),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      socket.emit('driver:go_offline');
      setOnline(false);
      api.put('/drivers/me/status', { isOnline: false }).catch(() => {});
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '24px 20px 60px', borderRadius: '0 0 28px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginBottom: 2 }}>Xush kelibsiz 👋</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{driver?.first_name || 'Haydovchi'}</div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🚗
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>⭐</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{driver?.rating || '5.0'}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>🚕</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{driver?.total_rides || 0} sayohat</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -28 }}>

        {/* Online toggle card */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, textAlign: 'center',
          boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
          border: `2px solid ${isOnline ? '#16A34A' : '#E2E8F0'}`,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: isOnline ? '#F0FDF4' : '#F1F5F9', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
            {isOnline ? '🟢' : '⚫'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: isOnline ? '#16A34A' : '#94A3B8', marginBottom: 14 }}>
            {isOnline ? 'Onlinesiz — buyurtma kutmoqdasiz' : 'Offlinesiz'}
          </div>
          <button onClick={toggleOnline} style={{
            padding: '12px 40px', fontSize: 16, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: isOnline ? '#DC2626' : '#16A34A', color: '#fff',
            boxShadow: `0 4px 14px ${isOnline ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`,
          }}>
            {isOnline ? 'Oflayn' : 'Onlayn'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Jami daromad</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
              {new Intl.NumberFormat('uz-UZ').format(driver?.total_earnings || 0)}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>so'm</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Jami sayohat</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2563EB' }}>{driver?.total_rides || 0}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>ta</div>
          </div>
        </div>

        {/* Menu */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => navigate('/earnings')} style={{
            background: '#fff', borderRadius: 16, padding: '18px 16px', cursor: 'pointer',
            border: 'none', textAlign: 'left', boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B' }}>Daromadlar</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Kunlik hisobot</div>
          </button>
          <button onClick={() => navigate('/profile')} style={{
            background: '#fff', borderRadius: 16, padding: '18px 16px', cursor: 'pointer',
            border: 'none', textAlign: 'left', boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B' }}>Profil</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Ma'lumotlarim</div>
          </button>
        </div>
      </div>
    </div>
  );
}
