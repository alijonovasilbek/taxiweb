import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAppStore } from '../../store/appStore';
import { Page, Empty, Spinner, Toggle, Route } from '../../components/ui';
import { I, ServiceIcon } from '../../components/icons';
import { apiError, formatPrice } from '../../utils/formatters';

const LOCATION_EVERY_MS = 12000; // Redis'da joylashuv 30 soniya yashaydi — undan tez-tez yuboramiz

const STEP = {
  accepted: { label: "Yo'lovchi oldiga boryapsiz", action: 'arrived', btn: 'Yetib keldim', icon: 'pin' },
  driver_arrived: { label: "Yo'lovchi kutmoqda", action: 'start', btn: 'Safarni boshlash', icon: 'route' },
  in_progress: { label: 'Safar davom etmoqda', action: 'complete', btn: 'Safarni yakunlash', icon: 'done' },
};

const navLink = (lat, lng) => `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;

/** Taksi haydovchisi — Mini App ijrochi rejimi (alohida driver-app o'rniga). */
export default function TaxiDriver() {
  const navigate = useNavigate();
  const toast = useAppStore((s) => s.toast);
  const [state, setState] = useState(null); // { driver, order }
  const [earn, setEarn] = useState(null);
  const [offer, setOffer] = useState(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const pos = useRef(null);
  const timer = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/orders/driver/active');
      setState(data);
      if (data.driver) api.get('/drivers/me/earnings').then(({ data: e }) => setEarn(e)).catch(() => {});
    } catch (e) { setState({ driver: null, order: null }); }
  };
  useEffect(() => { load(); }, []);

  const online = Boolean(state?.driver?.is_online);

  // Joylashuv: onlayn bo'lganda muntazam yuboriladi
  useEffect(() => {
    if (!online || !navigator.geolocation) return undefined;
    const socket = getSocket();
    const send = () => pos.current && socket.emit('driver:location_update', pos.current);
    const watch = navigator.geolocation.watchPosition(
      ({ coords }) => { pos.current = { lat: coords.latitude, lng: coords.longitude }; },
      () => {}, { enableHighAccuracy: true, maximumAge: 10000 },
    );
    timer.current = setInterval(send, LOCATION_EVERY_MS);
    return () => { navigator.geolocation.clearWatch(watch); clearInterval(timer.current); };
  }, [online]);

  // Kiruvchi buyurtmalar va bekor qilish
  useEffect(() => {
    const socket = getSocket();
    const onNew = (o) => {
      setOffer(o); setLeft(o.timeout || 15);
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning'); } catch {}
    };
    const onGone = ({ order_id }) => setOffer((cur) => (cur?.order_id === order_id ? null : cur));
    const onCancel = ({ order_id, reason }) => { toast("Yo'lovchi bekor qildi", reason, 'error'); onGone({ order_id }); load(); };
    socket.on('new_order', onNew);
    socket.on('new_order_timeout', onGone);
    socket.on('order_unavailable', onGone);
    socket.on('order_cancelled', onCancel);
    return () => {
      socket.off('new_order', onNew); socket.off('new_order_timeout', onGone);
      socket.off('order_unavailable', onGone); socket.off('order_cancelled', onCancel);
    };
  }, []);

  useEffect(() => {
    if (!offer) return undefined;
    const t = setInterval(() => setLeft((s) => { if (s <= 1) { setOffer(null); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [offer?.order_id]);

  const goOnline = (on) => {
    const socket = getSocket();
    if (!on) {
      socket.emit('driver:go_offline', {});
      setState((s) => ({ ...s, driver: { ...s.driver, is_online: false } }));
      return;
    }
    if (!navigator.geolocation) { toast('Joylashuv kerak', 'Qurilmangiz joylashuvni bermayapti', 'error'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      pos.current = { lat: coords.latitude, lng: coords.longitude };
      socket.emit('driver:go_online', pos.current);
      setState((s) => ({ ...s, driver: { ...s.driver, is_online: true } }));
      setBusy(false);
    }, () => { toast('Joylashuvga ruxsat bering', 'Onlayn bo‘lish uchun joylashuv kerak', 'error'); setBusy(false); },
    { enableHighAccuracy: true, timeout: 15000 });
  };

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); await load(); } catch (e) { toast('Xatolik', apiError(e), 'error'); }
    setBusy(false);
  };
  const accept = () => act(async () => { await api.put(`/orders/${offer.order_id}/accept`); setOffer(null); }, 'Buyurtma qabul qilindi');
  const reject = () => { api.put(`/orders/${offer.order_id}/reject`, { reason: 'Haydovchi rad etdi' }).catch(() => {}); setOffer(null); };

  if (!state) return <Page title="Taksi"><Spinner /></Page>;

  if (!state.driver) {
    return (
      <Page title="Taksi" sub="Haydovchi rejimi">
        <Empty icon="taxi" title="Taksi transporti yo'q"
          text="Yengil avtomobil yoki miniven qo'shing va hujjatlarni yuklang. Admin tasdiqlagach shu yerda buyurtma olasiz."
          action={<button className="btn" onClick={() => navigate('/vehicles/new')}><I n="plus" size={17} /> Transport qo'shish</button>} />
      </Page>
    );
  }

  const o = state.order;
  const step = o && STEP[o.status];

  return (
    <Page title="Taksi" sub={`${state.driver.car_model} · ${state.driver.car_number}`}>
      <div className="card row" style={{ gap: 14 }}>
        <ServiceIcon code="taxi" size={46} />
        <div className="grow">
          <div className="bold" style={{ fontSize: 18 }}>{online ? 'Onlaynsiz' : 'Oflaynsiz'}</div>
          <div className="faint">{online ? 'Yaqin buyurtmalar shu yerga keladi' : 'Buyurtma olish uchun onlayn bo‘ling'}</div>
        </div>
        <Toggle on={online} disabled={busy || Boolean(o)} onChange={goOnline} />
      </div>

      {earn && (
        <div className="stat-pills mb12">
          <div className="stat-pill"><div className="v" style={{ fontSize: 16 }}>{formatPrice(earn.today_earnings)}</div><div className="l">Bugun</div></div>
          <div className="stat-pill"><div className="v">{earn.total_rides}</div><div className="l">Safarlar</div></div>
          <div className="stat-pill"><div className="v" style={{ fontSize: 16 }}>{formatPrice(earn.total_earnings)}</div><div className="l">Jami</div></div>
        </div>
      )}

      {offer && !o && (
        <div className="card" style={{ boxShadow: '0 0 0 2px var(--primary)' }}>
          <div className="between mb12">
            <div className="bold" style={{ fontSize: 18 }}>Yangi buyurtma</div>
            <span className="badge orange">{left} s</span>
          </div>
          <Route from={offer.pickup.address} to={offer.dropoff.address} />
          <div className="row mt12" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="badge blue">{offer.distance_km} km · {offer.duration_min} daq</span>
            <span className="badge yellow">{formatPrice(offer.price)}</span>
            <span className="badge gray"><I n="star" size={12} /> {Number(offer.passenger_rating).toFixed(1)}</span>
          </div>
          <div className="row mt16" style={{ gap: 8 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={reject}>Rad etish</button>
            <button className="btn" style={{ flex: 2 }} disabled={busy} onClick={accept}><I n="check" size={17} stroke={2.6} /> Qabul qilish</button>
          </div>
        </div>
      )}

      {o && step && (
        <div className="card">
          <div className="row mb12" style={{ gap: 10 }}>
            <span className="app-icon" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--grad)' }}><I n={step.icon} size={18} color="#fff" /></span>
            <div className="grow">
              <div className="bold">{step.label}</div>
              <div className="faint">#{o.id} · {formatPrice(o.estimated_price)}</div>
            </div>
          </div>
          <Route from={o.pickup_address} to={o.dropoff_address} />
          <div className="row mt12" style={{ gap: 8 }}>
            <span className="grow">{o.passenger_name} <span className="faint"><I n="star" size={12} /> {Number(o.passenger_rating || 5).toFixed(1)}</span></span>
            {o.passenger_phone && <a className="btn ghost sm" href={`tel:${o.passenger_phone}`}><I n="phone" size={15} /></a>}
            <a className="btn ghost sm" target="_blank" rel="noreferrer"
              href={o.status === 'in_progress' ? navLink(o.dropoff_lat, o.dropoff_lng) : navLink(o.pickup_lat, o.pickup_lng)}>
              <I n="nav" size={15} /> Yo'l
            </a>
          </div>
          <button className="btn block mt16" disabled={busy} onClick={() => act(() => api.put(`/orders/${o.id}/${step.action}`),
            step.action === 'complete' ? 'Safar yakunlandi' : null)}>{step.btn}</button>
          {o.status !== 'in_progress' && (
            <button className="btn ghost block mt8" disabled={busy} style={{ color: 'var(--red)' }}
              onClick={() => act(() => api.put(`/orders/${o.id}/cancel?as_driver=true`, { reason: 'Haydovchi bekor qildi' }), 'Bekor qilindi')}>
              Bekor qilish
            </button>
          )}
        </div>
      )}

      {!o && !offer && online && <Empty icon="search" title="Buyurtma kutilmoqda" text="Ilovani ochiq qoldiring — yangi buyurtma shu yerda chiqadi." />}
    </Page>
  );
}
