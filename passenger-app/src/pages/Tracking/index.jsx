import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YandexMap from '../../components/Map/YandexMap';
import { useOrderStore } from '../../store/orderStore';
import { useOrderSocket } from '../../hooks/useSocket';
import api from '../../services/api';

const STATUS_MAP = {
  searching: { text: 'Haydovchi qidirilmoqda...', icon: '🔍', color: '#F59E0B', sub: 'Bir necha soniya kuting...' },
  accepted: { text: 'Haydovchi yo\'lingizga kelmoqda', icon: '🚗', color: '#2563EB', sub: null },
  driver_arrived: { text: 'Haydovchi siz yongingizdadir', icon: '📍', color: '#16A34A', sub: null },
  in_progress: { text: 'Sayohat davom etmoqda', icon: '🛣️', color: '#2563EB', sub: null },
  completed: { text: 'Sayohat tugadi', icon: '✅', color: '#16A34A', sub: null },
};

export default function Tracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { activeOrder, driver, driverLocation, clear } = useOrderStore();
  const [order, setOrder] = useState(activeOrder);

  useOrderSocket(orderId ? parseInt(orderId) : null);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data)).catch(() => {});
  }, [orderId]);

  const markers = [
    order && { lat: order.pickup_lat, lng: order.pickup_lng, type: 'pickup', label: 'Chiqish' },
    order && { lat: order.dropoff_lat, lng: order.dropoff_lng, type: 'dropoff', label: 'Borish' },
    driverLocation && { ...driverLocation, type: 'driver', label: driver?.name || 'Haydovchi' },
  ].filter(Boolean);

  const handleCancel = async () => {
    if (!confirm('Buyurtmani bekor qilasizmi?')) return;
    try {
      await api.put(`/orders/${orderId}/cancel`, { reason: 'Yo\'lovchi bekor qildi' });
      clear();
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'Bekor qilib bo\'lmadi');
    }
  };

  const status = order?.status || 'searching';
  const statusInfo = STATUS_MAP[status] || STATUS_MAP.searching;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1 }}>
        <YandexMap
          center={driverLocation || (order ? { lat: order.pickup_lat, lng: order.pickup_lng } : null)}
          markers={markers}
          style={{ height: '100%' }}
        />
      </div>

      <div style={{ background: '#fff', padding: '16px 16px 20px', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFF', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #EFF6FF' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {statusInfo.icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{statusInfo.text}</div>
            {statusInfo.sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{statusInfo.sub}</div>}
          </div>
        </div>

        {/* Driver card */}
        {driver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F1F5F9', borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, flexShrink: 0 }}>
              🚗
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1E293B' }}>{driver.name}</div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{driver.carModel} · {driver.carNumber}</div>
              <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 1 }}>⭐ {driver.rating}</div>
            </div>
            <a href={`tel:${driver.phone}`} style={{ width: 40, height: 40, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 18, flexShrink: 0 }}>
              📞
            </a>
          </div>
        )}

        {['searching', 'accepted'].includes(status) && (
          <button onClick={handleCancel} style={{
            width: '100%', padding: 13, fontSize: 15, fontWeight: 600,
            background: '#fff', color: '#DC2626', border: '1.5px solid #DC2626', borderRadius: 12, cursor: 'pointer',
          }}>
            Bekor qilish
          </button>
        )}
      </div>
    </div>
  );
}
