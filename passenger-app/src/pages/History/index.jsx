import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatPrice } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

const STATUS_COLOR = { completed: '#4CAF50', cancelled: '#f44336', in_progress: '#2196F3' };
const STATUS_LABEL = { completed: 'Tugadi', cancelled: 'Bekor', in_progress: 'Davom etmoqda' };

export default function History() {
  const [rides, setRides] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/users/me/rides').then(({ data }) => setRides(data)).catch(() => {});
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h2>Sayohatlar tarixi</h2>
      </div>

      {rides.length === 0 && <div style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>Hali buyurtmalar yo'q</div>}

      {rides.map((ride) => (
        <div key={ride.id} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: STATUS_COLOR[ride.status] || '#888', fontWeight: 600 }}>
              {STATUS_LABEL[ride.status] || ride.status}
            </span>
            <span style={{ fontSize: 12, color: '#aaa' }}>
              {new Date(ride.created_at).toLocaleDateString('uz-UZ')}
            </span>
          </div>
          <div style={{ fontSize: 14, marginBottom: 4 }}><b>Chiqish:</b> {ride.pickup_address}</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}><b>Borish:</b> {ride.dropoff_address}</div>
          {ride.final_price && <div style={{ fontWeight: 600, color: '#1976D2' }}>{formatPrice(ride.final_price)}</div>}
        </div>
      ))}
    </div>
  );
}
