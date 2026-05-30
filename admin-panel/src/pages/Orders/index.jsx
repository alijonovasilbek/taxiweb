import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_COLOR = { completed: '#4CAF50', cancelled: '#f44336', searching: '#FF9800', in_progress: '#2196F3' };
const STATUS_LABEL = { completed: 'Tugadi', cancelled: 'Bekor', searching: 'Qidirilmoqda', accepted: 'Qabul qilindi', in_progress: 'Sayohat', driver_arrived: 'Keldi', no_drivers: 'Haydovchi yo\'q' };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/orders', { params: { page, limit: 20 } }).then(({ data }) => {
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    }).catch(() => {});
  }, [page]);

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0) + ' so\'m';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Buyurtmalar</h1>
        <span style={{ color: '#888', fontSize: 14 }}>Jami: {total}</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['#', 'Chiqish', 'Borish', 'Narx', 'To\'lov', 'Holat', 'Sana'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#888' }}>#{o.id}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.pickup_address}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.dropoff_address}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{fmt(o.final_price || o.estimated_price)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{o.payment_method}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: (STATUS_COLOR[o.status] || '#888') + '20', color: STATUS_COLOR[o.status] || '#888', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#aaa' }}>{new Date(o.created_at).toLocaleDateString('uz-UZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Buyurtmalar topilmadi</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #ddd', cursor: 'pointer', background: '#fff' }}>← Oldingi</button>
        <span style={{ padding: '8px 16px', fontSize: 14, color: '#888' }}>Sahifa {page}</span>
        <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #ddd', cursor: 'pointer', background: '#fff' }}>Keyingi →</button>
      </div>
    </div>
  );
}
