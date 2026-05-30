import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../store/driverStore';
import { useRideStore } from '../../store/rideStore';
import { useDriverSocket } from '../../hooks/useSocket';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { getSocket } from '../../services/socket';
import api from '../../services/api';

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 60 }}>⏳</div>
      <h2 style={{ marginTop: 12 }}>Tasdiqlanmoqda</h2>
      <p style={{ color: '#888', marginTop: 8 }}>Administrator ma'lumotlaringizni tekshiradi</p>
    </div>
  );

  if (driver?.status === 'blocked') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 60 }}>🚫</div>
      <h2 style={{ marginTop: 12 }}>Hisob bloklandi</h2>
      <p style={{ color: '#888', marginTop: 8 }}>Batafsil ma'lumot uchun administrator bilan bog'laning</p>
    </div>
  );

  const toggleOnline = async () => {
    const socket = getSocket();
    if (!isOnline) {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        socket.emit('driver:go_online', { lat: coords.latitude, lng: coords.longitude });
        setOnline(true);
      });
    } else {
      socket.emit('driver:go_offline');
      setOnline(false);
    }
    await api.put('/drivers/me/status', { isOnline: !isOnline }).catch(() => {});
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Salom, {driver?.first_name}!</h2>
          <div style={{ color: '#888', fontSize: 13 }}>⭐ {driver?.rating || '5.0'} · {driver?.total_rides || 0} sayohat</div>
        </div>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#2196F3',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22,
        }}>🚗</div>
      </div>

      <div style={{
        background: isOnline ? '#E8F5E9' : '#f5f5f5',
        borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center',
        border: `2px solid ${isOnline ? '#4CAF50' : '#ddd'}`,
      }}>
        <div style={{ fontSize: 14, color: isOnline ? '#388E3C' : '#888', fontWeight: 500, marginBottom: 12 }}>
          {isOnline ? '🟢 Onlinesiz — buyurtma kutmoqdasiz' : '⚪ Offlinesiz'}
        </div>
        <button onClick={toggleOnline} style={{
          padding: '12px 32px', fontSize: 16, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: isOnline ? '#f44336' : '#4CAF50', color: '#fff',
        }}>
          {isOnline ? 'Oflayn' : 'Onlayn'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#888' }}>Jami daromad</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {new Intl.NumberFormat('uz-UZ').format(driver?.total_earnings || 0)} so'm
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#888' }}>Jami sayohat</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{driver?.total_rides || 0}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => navigate('/earnings')} style={{
          flex: 1, padding: 13, fontSize: 14, fontWeight: 500,
          background: '#fff', border: '1.5px solid #ddd', borderRadius: 12, cursor: 'pointer',
        }}>📊 Daromadlar</button>
        <button onClick={() => navigate('/profile')} style={{
          flex: 1, padding: 13, fontSize: 14, fontWeight: 500,
          background: '#fff', border: '1.5px solid #ddd', borderRadius: 12, cursor: 'pointer',
        }}>👤 Profil</button>
      </div>
    </div>
  );
}
