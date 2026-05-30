import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YandexMap from '../../components/Map/YandexMap';
import { useOrderStore } from '../../store/orderStore';
import { useOrderSocket } from '../../hooks/useSocket';
import api from '../../services/api';

const STATUS_TEXT = {
  searching: 'Haydovchi qidirilmoqda...',
  accepted: 'Haydovchi yo\'lingizga kelmoqda',
  driver_arrived: 'Haydovchi siz yongingizdadir',
  in_progress: 'Sayohat davom etmoqda',
  completed: 'Sayohat tugadi',
};

export default function Tracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { activeOrder, driver, driverLocation, setActiveOrder } = useOrderStore();
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
    await api.put(`/orders/${orderId}/cancel`, { reason: 'Yo\'lovchi bekor qildi' });
    navigate('/');
  };

  const status = order?.status || 'searching';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1 }}>
        <YandexMap
          center={driverLocation || (order ? { lat: order.pickup_lat, lng: order.pickup_lng } : null)}
          markers={markers}
          style={{ height: '100%' }}
        />
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{STATUS_TEXT[status] || 'Yuklanmoqda...'}</div>
          {status === 'searching' && (
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Bir necha soniya kuting...</div>
          )}
        </div>

        {driver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
              🚗
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{driver.name}</div>
              <div style={{ fontSize: 13, color: '#555' }}>{driver.carModel} · {driver.carNumber}</div>
              <div style={{ fontSize: 13, color: '#888' }}>⭐ {driver.rating}</div>
            </div>
            <a href={`tel:${driver.phone}`} style={{ marginLeft: 'auto', fontSize: 24, textDecoration: 'none' }}>📞</a>
          </div>
        )}

        {['searching', 'accepted'].includes(status) && (
          <button onClick={handleCancel} style={{
            width: '100%', padding: 13, fontSize: 15, fontWeight: 500,
            background: '#fff', color: '#f44336', border: '1.5px solid #f44336', borderRadius: 12, cursor: 'pointer',
          }}>
            Bekor qilish
          </button>
        )}
      </div>
    </div>
  );
}
