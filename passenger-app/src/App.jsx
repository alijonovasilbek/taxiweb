import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useUserStore } from './store/userStore';
import { useAppStore } from './store/appStore';
import { getSocket } from './services/socket';
import { Toasts, Spinner } from './components/ui';
import Home from './pages/Home';
import BookRide from './pages/BookRide';
import Tracking from './pages/Tracking';
import Payment from './pages/Payment';
import Rating from './pages/Rating';
import History from './pages/History';
import Profile from './pages/Profile';
import Carpool from './pages/Carpool';
import CarpoolNew from './pages/CarpoolNew';
import TripDetail from './pages/TripDetail';
import RequestNew from './pages/RequestNew';
import RequestDetail from './pages/RequestDetail';
import Orders from './pages/Orders';
import Provider from './pages/Provider';
import Vehicles from './pages/Vehicles';
import VehicleForm from './pages/VehicleForm';
import Schedule from './pages/Schedule';
import Search from './pages/Search';
import Notifications from './pages/Notifications';
import PublicProfile from './pages/PublicProfile';

const NOTIFY_LINK = (n) => {
  const d = n.data || {};
  if (d.request_id) return `/requests/${d.request_id}`;
  if (d.trip_id) return `/carpool/trips/${d.trip_id}`;
  if (d.vehicle_id) return '/vehicles';
  return '/notifications';
};

function RealtimeBridge() {
  const { toast, incUnread, refreshUnread, loadCatalog } = useAppStore();
  useEffect(() => {
    loadCatalog();
    refreshUnread();
    const socket = getSocket();
    const onNotification = (n) => {
      incUnread();
      toast(n.title, n.message, 'info', NOTIFY_LINK(n));
      window.dispatchEvent(new CustomEvent('cs:notification', { detail: n }));
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, []);
  return null;
}

export default function App() {
  const { tg, initData } = useTelegram();
  const { login, isLoading, token, error } = useUserStore();

  useEffect(() => {
    tg.expand();
    tg.ready();
    if (initData) login(initData);
  }, [initData]);

  if (isLoading || (!token && initData && !error)) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 8 }}>
      <div style={{ fontSize: 44 }}>🚖</div>
      <div className="bold">Chortoq Services</div>
      <Spinner />
    </div>
  );

  if (!token) return (
    <div style={{ padding: 24, textAlign: 'center', marginTop: '30vh' }}>
      <div style={{ fontSize: 44 }}>🔐</div>
      <p className="bold mt8">{error || 'Telegram orqali kirish kerak'}</p>
      <p className="muted mt8">Ilovani Telegram bot orqali oching</p>
    </div>
  );

  return (
    <BrowserRouter>
      <RealtimeBridge />
      <Toasts />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Taksi */}
        <Route path="/book" element={<BookRide />} />
        <Route path="/tracking/:orderId" element={<Tracking />} />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/rating/:orderId" element={<Rating />} />
        <Route path="/history" element={<History />} />
        {/* Po'puti */}
        <Route path="/carpool" element={<Carpool />} />
        <Route path="/carpool/new" element={<CarpoolNew />} />
        <Route path="/carpool/bookings" element={<Navigate to="/carpool?tab=bookings" replace />} />
        <Route path="/carpool/trips/:tripId" element={<TripDetail />} />
        {/* Yuk tashish / Spets texnika */}
        <Route path="/requests/new/:service" element={<RequestNew />} />
        <Route path="/requests/:requestId" element={<RequestDetail />} />
        {/* Umumiy */}
        <Route path="/orders" element={<Orders />} />
        <Route path="/provider" element={<Provider />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/vehicles/new" element={<VehicleForm />} />
        <Route path="/vehicles/:vehicleId/edit" element={<VehicleForm />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/search" element={<Search />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users/:userId" element={<PublicProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
