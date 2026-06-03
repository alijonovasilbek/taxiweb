import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../store/driverStore';

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
  const { driver } = useDriverStore();

  const statusLabel = driver?.status === 'approved' ? 'Tasdiqlangan' : driver?.status === 'blocked' ? 'Bloklangan' : 'Kutilmoqda';
  const statusColor = driver?.status === 'approved' ? '#16A34A' : driver?.status === 'blocked' ? '#DC2626' : '#F59E0B';
  const statusBg = driver?.status === 'approved' ? '#F0FDF4' : driver?.status === 'blocked' ? '#FEF2F2' : '#FFFBEB';

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '20px 20px 60px', borderRadius: '0 0 28px 28px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: 16, marginBottom: 12 }}>
          ← Orqaga
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 10px', color: '#fff', fontWeight: 700 }}>
            {driver?.first_name?.[0]?.toUpperCase() || '🚗'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{driver?.first_name} {driver?.last_name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{driver?.phone || '—'}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px', marginTop: -28 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2563EB' }}>{driver?.total_rides || 0}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Jami sayohatlar</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>⭐ {driver?.rating || '5.0'}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Reyting</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 16, padding: '0 16px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <Row icon="🚗" label="Mashina" value={`${driver?.car_model || '—'} (${driver?.car_color || '—'})`} />
        <Row icon="🔢" label="Davlat raqami" value={driver?.car_number || '—'} />
        <Row icon="📅" label="Yili" value={driver?.car_year || '—'} />
        <Row icon="📱" label="Telefon" value={driver?.phone || 'Kiritilmagan'} />
        <div style={{ padding: '13px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>Holat</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, background: statusBg, padding: '4px 10px', borderRadius: 20 }}>{statusLabel}</span>
          </div>
        </div>
      </div>

      <div style={{ margin: '12px 16px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Jami daromad</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1E293B' }}>
            {new Intl.NumberFormat('uz-UZ').format(driver?.total_earnings || 0)} <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 400 }}>so'm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
