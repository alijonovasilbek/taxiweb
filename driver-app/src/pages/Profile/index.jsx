import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../store/driverStore';

export default function Profile() {
  const navigate = useNavigate();
  const { driver } = useDriverStore();

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h2>Profil</h2>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: '#fff', margin: '0 auto 12px' }}>
          🚗
        </div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{driver?.first_name} {driver?.last_name}</div>
        <div style={{ color: '#888', marginTop: 4 }}>{driver?.phone}</div>
        <div style={{ marginTop: 6 }}>⭐ {driver?.rating || '5.0'}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        {[
          { label: 'Mashina', value: `${driver?.car_model} (${driver?.car_color})` },
          { label: 'Davlat raqami', value: driver?.car_number },
          { label: 'Jami sayohat', value: driver?.total_rides || 0 },
          { label: 'Holat', value: driver?.status === 'approved' ? '✅ Tasdiqlangan' : '⏳ Kutilmoqda' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ color: '#888' }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
