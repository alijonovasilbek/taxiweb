import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';

const Row = ({ label, value, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #F1F5F9' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 14, color: '#64748B' }}>{label}</span>
    </div>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{value}</span>
  </div>
);

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '20px 20px 60px', borderRadius: '0 0 28px 28px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: 16, marginBottom: 12 }}>
          ← Orqaga
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 10px', color: '#fff', fontWeight: 700 }}>
            {user?.first_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{user?.first_name} {user?.last_name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>@{user?.telegram_username || 'telegram'}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px', marginTop: -28 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2563EB' }}>{user?.total_rides || 0}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Jami sayohatlar</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>⭐ {user?.rating || '5.0'}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Reyting</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 16, padding: '0 16px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <Row icon="📱" label="Telefon" value={user?.phone || 'Kiritilmagan'} />
        <Row icon="🆔" label="Telegram" value={`@${user?.telegram_username || '—'}`} />
        <Row icon="🚕" label="Sayohatlar" value={`${user?.total_rides || 0} ta`} />
        <div style={{ padding: '13px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>Holat</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', background: '#F0FDF4', padding: '4px 10px', borderRadius: 20 }}>Faol</span>
          </div>
        </div>
      </div>
    </div>
  );
}
