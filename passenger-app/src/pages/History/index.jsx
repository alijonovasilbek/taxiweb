import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatPrice } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

const STATUS_MAP = {
  completed: { label: 'Tugadi', color: '#16A34A', bg: '#F0FDF4' },
  cancelled: { label: 'Bekor', color: '#DC2626', bg: '#FEF2F2' },
  in_progress: { label: 'Davom etmoqda', color: '#2563EB', bg: '#EFF6FF' },
};

export default function History() {
  const [rides, setRides] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/users/me/rides').then(({ data }) => setRides(data)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '20px 20px 60px', borderRadius: '0 0 28px 28px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: 16, marginBottom: 12 }}>
          ← Orqaga
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Sayohatlar tarixi</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{rides.length} ta sayohat</div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -28 }}>
        {rides.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚕</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Hali buyurtmalar yo'q</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Birinchi sayohatingizni buyurtma qiling</div>
          </div>
        )}

        {rides.map((ride) => {
          const s = STATUS_MAP[ride.status] || { label: ride.status, color: '#64748B', bg: '#F1F5F9' };
          return (
            <div key={ride.id} style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, padding: '3px 10px', borderRadius: 20 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(ride.created_at).toLocaleDateString('uz-UZ')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#1E293B', lineHeight: 1.4 }}>{ride.pickup_address}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#1E293B', lineHeight: 1.4 }}>{ride.dropoff_address}</span>
                </div>
              </div>
              {ride.final_price && (
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2563EB' }}>{formatPrice(ride.final_price)}</div>
              )}
            </div>
          );
        })}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
