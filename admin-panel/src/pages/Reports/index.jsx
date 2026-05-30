import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Reports() {
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    api.get('/reports/daily').then(({ data }) => setDaily(data)).catch(() => {});
    api.get('/reports/weekly').then(({ data }) => setWeekly(data)).catch(() => {});
  }, []);

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0) + ' so\'m';

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Hisobotlar</h1>

      <h3 style={{ marginBottom: 12 }}>Oxirgi 7 kun</h3>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Sana', 'Jami', 'Tugadi', 'Bekor', 'Daromad'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daily.map((d, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px' }}>{new Date(d.date).toLocaleDateString('uz-UZ')}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.total_orders}</td>
                <td style={{ padding: '12px 16px', color: '#4CAF50', fontWeight: 600 }}>{d.completed}</td>
                <td style={{ padding: '12px 16px', color: '#f44336' }}>{d.cancelled}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1976D2' }}>{fmt(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {daily.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Ma'lumot topilmadi</div>}
      </div>

      <h3 style={{ marginBottom: 12 }}>Haftalik hisobot</h3>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Hafta', 'Jami buyurtma', 'Tugadi', 'Daromad'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekly.map((w, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px' }}>{new Date(w.week).toLocaleDateString('uz-UZ')}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{w.total_orders}</td>
                <td style={{ padding: '12px 16px', color: '#4CAF50', fontWeight: 600 }}>{w.completed}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1976D2' }}>{fmt(w.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {weekly.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Ma'lumot topilmadi</div>}
      </div>
    </div>
  );
}
