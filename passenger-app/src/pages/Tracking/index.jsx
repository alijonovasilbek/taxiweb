import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YandexMap from '../../components/Map/YandexMap';
import { useOrderStore } from '../../store/orderStore';
import { useAppStore } from '../../store/appStore';
import { useOrderSocket } from '../../hooks/useSocket';
import { getSocket } from '../../services/socket';
import api from '../../services/api';
import { I } from '../../components/icons';
import { Route } from '../../components/ui';
import { apiError, formatPrice } from '../../utils/formatters';

const STATUS_MAP = {
  searching: { text: 'Haydovchi qidirilmoqda…', icon: 'search', tone: 'orange', sub: 'Yaqin haydovchilarga yuborildi' },
  accepted: { text: "Haydovchi yo'lingizga kelmoqda", icon: 'car', tone: 'primary' },
  driver_arrived: { text: 'Haydovchi yetib keldi', icon: 'pin', tone: 'green', sub: 'Chiqishingiz mumkin' },
  in_progress: { text: 'Safar davom etmoqda', icon: 'route', tone: 'primary' },
  completed: { text: 'Safar tugadi', icon: 'done', tone: 'green' },
  no_drivers: { text: 'Haydovchi topilmadi', icon: 'user-x', tone: 'red', sub: "Hozir yaqin atrofda bo'sh haydovchi yo'q" },
  cancelled: { text: 'Buyurtma bekor qilindi', icon: 'close', tone: 'red' },
};
const TONE = {
  orange: ['var(--orange-soft)', 'var(--orange)'], primary: ['var(--primary-soft)', 'var(--primary)'],
  green: ['var(--green-soft)', 'var(--green)'], red: ['var(--red-soft)', 'var(--red)'],
};
const CANCELLABLE = ['searching', 'accepted', 'driver_arrived'];
const FINISHED = ['completed', 'no_drivers', 'cancelled'];

function confirmTg(text) {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && tg.showConfirm) return new Promise((resolve) => tg.showConfirm(text, resolve));
  return Promise.resolve(window.confirm(text));
}

export default function Tracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { activeOrder, driver, driverLocation, clear, createOrder } = useOrderStore();
  const toast = useAppStore((s) => s.toast);
  const [order, setOrder] = useState(activeOrder);
  const [busy, setBusy] = useState(false);

  useOrderSocket(orderId ? parseInt(orderId, 10) : null);

  const load = () => api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data)).catch(() => {});
  useEffect(() => { load(); }, [orderId]);

  // Holat o'zgarishlari: socket hodisalari + qidiruv paytida zaxira so'rov (socket uzilsa ham yangilanadi)
  useEffect(() => {
    const socket = getSocket();
    const refresh = (d) => { if (!d?.order_id || String(d.order_id) === String(orderId)) load(); };
    const events = ['no_drivers_found', 'order_accepted', 'driver_arrived', 'ride_started', 'ride_completed', 'order_cancelled'];
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [orderId]);
  const status = order?.status || 'searching';
  useEffect(() => {
    if (FINISHED.includes(status)) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [status, orderId]);

  const markers = [
    order && { lat: order.pickup_lat, lng: order.pickup_lng, type: 'pickup', label: 'Chiqish' },
    order && { lat: order.dropoff_lat, lng: order.dropoff_lng, type: 'dropoff', label: 'Borish' },
    driverLocation && { ...driverLocation, type: 'driver', label: driver?.name || 'Haydovchi' },
  ].filter(Boolean);

  const leave = () => { if (FINISHED.includes(status)) clear(); navigate('/', { replace: true }); };

  const cancel = async () => {
    if (!(await confirmTg('Buyurtmani bekor qilasizmi?'))) return;
    setBusy(true);
    try {
      await api.put(`/orders/${orderId}/cancel`, { reason: "Yo'lovchi bekor qildi" });
      clear();
      toast('Buyurtma bekor qilindi');
      navigate('/', { replace: true });
    } catch (err) { toast("Bekor qilib bo'lmadi", apiError(err), 'error'); }
    setBusy(false);
  };

  const retry = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const o = await createOrder({
        pickup: { lat: order.pickup_lat, lng: order.pickup_lng, address: order.pickup_address },
        dropoff: { lat: order.dropoff_lat, lng: order.dropoff_lng, address: order.dropoff_address },
        paymentMethod: order.payment_method || 'cash',
      });
      navigate(`/tracking/${o.id}`, { replace: true });
    } catch (err) { toast('Buyurtma yuborilmadi', apiError(err), 'error'); }
    setBusy(false);
  };

  const info = STATUS_MAP[status] || STATUS_MAP.searching;
  const [bg, fg] = TONE[info.tone];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--tg-viewport-stable-height, 100dvh)', minHeight: 0 }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <YandexMap
          center={driverLocation || (order ? { lat: order.pickup_lat, lng: order.pickup_lng } : null)}
          markers={markers}
          style={{ height: '100%' }}
        />
        <button className="map-fab" style={{ top: 12, left: 12 }} onClick={leave} aria-label="Orqaga">
          <I n="back" size={22} stroke={2.4} />
        </button>
      </div>

      <div className="track-sheet">
        <div className="row" style={{ gap: 12 }}>
          <span className={`track-ic${status === 'searching' ? ' pulse' : ''}`} style={{ background: bg, color: fg }}>
            <I n={info.icon} size={21} stroke={2.2} />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold" style={{ fontSize: 17 }}>{info.text}</div>
            {info.sub && <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>{info.sub}</div>}
          </div>
          {order?.estimated_price && <span className="bold" style={{ color: 'var(--primary)' }}>{formatPrice(order.final_price || order.estimated_price)}</span>}
        </div>

        {order && <div className="mt12"><Route from={order.pickup_address} to={order.dropoff_address} /></div>}

        {driver && !FINISHED.includes(status) && (
          <div className="track-driver mt12">
            <span className="app-icon" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--grad)' }}><I n="car" size={21} color="#fff" /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="bold">{driver.name}</div>
              <div className="faint" style={{ fontSize: 13 }}>{driver.carModel} · {driver.carNumber}{driver.carColor ? ` · ${driver.carColor}` : ''}</div>
            </div>
            {driver.phone && <a className="btn green sm" href={`tel:${driver.phone}`} aria-label="Qo'ng'iroq"><I n="phone" size={17} color="#fff" /></a>}
          </div>
        )}

        <div className="mt16" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {status === 'no_drivers' && (
            <button className="btn block" disabled={busy} onClick={retry}><I n="repeat" size={17} /> Qayta qidirish</button>
          )}
          {status === 'completed' && !order?.passenger_rated && (
            <button className="btn block" onClick={() => navigate(`/rating/${orderId}`)}><I n="star" size={17} /> Haydovchini baholash</button>
          )}
          {CANCELLABLE.includes(status) && (
            <button className="btn red-soft block" disabled={busy} onClick={cancel}>Buyurtmani bekor qilish</button>
          )}
          {(FINISHED.includes(status) || status === 'searching') && (
            <button className="btn ghost block" onClick={leave}>
              {FINISHED.includes(status) ? 'Asosiy sahifaga' : 'Orqaga (qidiruv davom etadi)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
