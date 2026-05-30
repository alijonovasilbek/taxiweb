import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h2>Profil</h2>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: '#fff', margin: '0 auto 12px' }}>
          {user?.first_name?.[0] || '?'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{user?.first_name} {user?.last_name}</div>
        <div style={{ color: '#888', marginTop: 4 }}>@{user?.telegram_username || 'telegram'}</div>
        <div style={{ marginTop: 8, fontSize: 16 }}>⭐ {user?.rating || '5.0'}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ color: '#888' }}>Jami sayohatlar</span>
          <span style={{ fontWeight: 600 }}>{user?.total_rides || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ color: '#888' }}>Telefon</span>
          <span style={{ fontWeight: 600 }}>{user?.phone || 'Kiritilmagan'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
          <span style={{ color: '#888' }}>Reyting</span>
          <span style={{ fontWeight: 600 }}>⭐ {user?.rating || '5.0'}</span>
        </div>
      </div>
    </div>
  );
}
