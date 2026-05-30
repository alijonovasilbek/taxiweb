import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPrice } from '../../utils/formatters';

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data)).catch(() => {});
  }, [orderId]);

  const handlePay = async (method) => {
    if (method === 'cash') { navigate(`/rating/${orderId}`); return; }
    setLoading(true);
    try {
      if (method === 'payme') {
        const { data } = await api.post('/payments/payme/create', { orderId });
        window.open(data.url, '_blank');
      } else if (method === 'click') {
        const { data } = await api.post('/payments/click/create', { orderId });
        window.open(data.url, '_blank');
      }
    } catch { alert('To\'lov yaratishda xatolik'); }
    finally { setLoading(false); }
  };

  if (!order) return <div style={{ padding: 20, textAlign: 'center' }}>Yuklanmoqda...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>To'lov</h2>

      <div style={{ background: '#f0f7ff', borderRadius: 14, padding: 16, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#555' }}>Sayohat narxi</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1976D2', marginTop: 4 }}>
          {formatPrice(order.final_price || order.estimated_price)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { id: 'cash', label: 'Naqd pul', icon: '💵', sub: 'Haydovchiga to\'g\'ridan-to\'g\'ri' },
          { id: 'payme', label: 'Payme', icon: '💳', sub: 'Online to\'lov' },
          { id: 'click', label: 'Click', icon: '💳', sub: 'Online to\'lov' },
        ].map((m) => (
          <button key={m.id} onClick={() => handlePay(m.id)} disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: '#fff', border: '1.5px solid #ddd', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
            }}>
            <span style={{ fontSize: 28 }}>{m.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{m.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
