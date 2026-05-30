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
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h2>Daromadlar</h2>
      </div>

      {earnings && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#E3F2FD', borderRadius: 14, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#555' }}>Bugun</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{fmt(earnings.todayEarnings)}</div>
          </div>
          <div style={{ background: '#E8F5E9', borderRadius: 14, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#555' }}>Jami</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{fmt(earnings.totalEarnings)}</div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 10 }}>Oxirgi sayohatlar</h3>
      {rides.map((r) => (
        <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13 }}>{r.dropoff_address?.slice(0, 30)}...</div>
            <div style={{ fontWeight: 600, color: '#1976D2' }}>{fmt(r.final_price)}</div>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{new Date(r.completed_at || r.created_at).toLocaleDateString('uz-UZ')}</div>
        </div>
      ))}
    </div>
  );
}
