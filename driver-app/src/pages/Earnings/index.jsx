import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Earnings() {
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState(null);
  const [rides, setRides] = useState([]);

  useEffect(() => {
    api.get('/drivers/me/earnings').then(({ data }) => setEarnings(data)).catch(() => {});
    api.get('/drivers/me/rides').then(({ data }) => setRides(data.slice(0, 10))).catch(() => {});
  }, []);

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0) + ' so\'m';

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '20px 20px 60px', borderRadius: '0 0 28px 28px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: 16, marginBottom: 12 }}>
          ← Orqaga
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Daromadlar</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>Moliyaviy hisobot</div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -28 }}>

        {/* Stats grid */}
        {earnings && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Bugun</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2563EB' }}>{fmt(earnings.todayEarnings)}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Jami</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A' }}>{fmt(earnings.totalEarnings)}</div>
            </div>
          </div>
        )}

        {/* Ride list */}
        {rides.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748B', marginBottom: 10, paddingLeft: 4 }}>Oxirgi sayohatlar</div>
            {rides.map((r) => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626', marginTop: 5, flexShrink: 0 }} />
                    <div style={{ fontSize: 14, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.dropoff_address}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 5, paddingLeft: 15 }}>
                    {new Date(r.completed_at || r.created_at).toLocaleDateString('uz-UZ')}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#16A34A', fontSize: 14, marginLeft: 12, flexShrink: 0 }}>{fmt(r.final_price)}</div>
              </div>
            ))}
          </>
        )}

        {rides.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Hali sayohatlar yo'q</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Birinchi buyurtmangizni qabul qiling</div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
