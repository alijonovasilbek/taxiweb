import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_COLOR = { completed: '#4CAF50', pending: '#FF9800', failed: '#f44336', processing: '#2196F3' };

export default function Payments() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get('/payments').then(({ data }) => setPayments(data)).catch(() => {});
  }, []);

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0) + ' so\'m';

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>To'lovlar</h1>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Buyurtma #', 'Miqdor', 'Usul', 'Holat', 'Tashqi ID', 'Sana'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{p.order_id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1976D2' }}>{fmt(p.amount)}</td>
                <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: 12 }}>{p.method}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: (STATUS_COLOR[p.status] || '#888') + '20', color: STATUS_COLOR[p.status] || '#888', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: '#aaa' }}>{p.external_id?.slice(0, 16) || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#aaa' }}>{new Date(p.created_at).toLocaleDateString('uz-UZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>To'lovlar topilmadi</div>}
      </div>
    </div>
  );
}
