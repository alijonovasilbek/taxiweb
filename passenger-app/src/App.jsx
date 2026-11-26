import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useUserStore } from './store/userStore';
import { useAppStore } from './store/appStore';
import { getSocket } from './services/socket';
import { applyTheme } from './utils/theme';
import { Toasts, Spinner } from './components/ui';
import Home from './pages/Home';
const BookRide = lazy(() => import('./pages/BookRide'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Payment = lazy(() => import('./pages/Payment'));
const Rating = lazy(() => import('./pages/Rating'));
const History = lazy(() => import('./pages/History'));
const Profile = lazy(() => import('./pages/Profile'));
const Carpool = lazy(() => import('./pages/Carpool'));
const CarpoolNew = lazy(() => import('./pages/CarpoolNew'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const RequestNew = lazy(() => import('./pages/RequestNew'));
const RequestDetail = lazy(() => import('./pages/RequestDetail'));
const Orders = lazy(() => import('./pages/Orders'));
const Provider = lazy(() => import('./pages/Provider'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const VehicleForm = lazy(() => import('./pages/VehicleForm'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Search = lazy(() => import('./pages/Search'));
const Notifications = lazy(() => import('./pages/Notifications'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const TaxiDriver = lazy(() => import('./pages/TaxiDriver'));
import Onboarding from './pages/Onboarding';
import { I, ServiceIcon } from './components/icons';

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
  const { login, fetchMe, isLoading, token, user, error } = useUserStore();

  useEffect(() => {
    tg.expand();
    tg.ready();
    // Mavzu: Telegram tungi/kunduzgi rejimi (Telegram'dan tashqarida — tizim sozlamasi)
    applyTheme();
    try { tg.onEvent?.('themeChanged', applyTheme); } catch {}
    if (initData) login(initData);
    else if (token) fetchMe();
  }, [initData]);

  if (isLoading || (!token && initData && !error) || (token && !user && !error)) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 8 }}>
      <ServiceIcon code="taxi" size={64} />
      <div className="bold">Chortoq Services</div>
      <Spinner />
    </div>
  );

  if (!token || !user) return (
    <div style={{ padding: 24, textAlign: 'center', marginTop: '30vh' }}>
      <I n="lock" size={44} color="var(--muted)" />
      <p className="bold mt8">{error || 'Telegram orqali kirish kerak'}</p>
      <p className="muted mt8">Ilovani Telegram bot orqali oching</p>
    </div>
  );

  return (
    <BrowserRouter>
      <RealtimeBridge />
      <Toasts />
      {!user.phone_verified || !user.onboarded_at ? <Onboarding /> : (
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', paddingTop: '40vh' }}><Spinner /></div>}>
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
        <Route path="/taxi-driver" element={<TaxiDriver />} />
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
      </Suspense>
      )}
    </BrowserRouter>
  );
}
