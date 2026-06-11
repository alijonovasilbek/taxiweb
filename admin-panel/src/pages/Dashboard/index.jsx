import React, { useEffect, useState } from 'react';
import api from '../../services/api';

function StatCard({ label, value, icon, color = '#1976D2' }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
        </div>
        <div style={{ fontSize: 36 }}>{icon}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setStats(data)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/dashboard').then(({ data }) => setStats(data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0);

  return (
    <div>
      <h1 style={{ marginBottom: 20, fontSize: 22 }}>Dashboard</h1>

      {stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="Bugungi buyurtmalar" value={stats.today_orders} icon="📋" />
          <StatCard label="Faol haydovchilar" value={stats.active_drivers} icon="🚗" color="#4CAF50" />
          <StatCard label="Bugungi daromad" value={fmt(stats.today_revenue) + " so'm"} icon="💰" color="#FF9800" />
          <StatCard label="O'rtacha reyting" value={'⭐ ' + stats.avg_driver_rating} icon="⭐" color="#9C27B0" />
        </div>
      ) : (
        <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>Yuklanmoqda...</div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <h3 style={{ marginBottom: 16 }}>Tizim holati</h3>
        <div style={{ color: '#4CAF50', fontWeight: 600 }}>✅ Barcha tizimlar ishlayapti</div>
        <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Oxirgi yangilanish: {new Date().toLocaleTimeString('uz-UZ')}</div>
      </div>
    </div>
  );
}
