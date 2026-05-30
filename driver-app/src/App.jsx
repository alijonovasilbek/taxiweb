import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useDriverStore } from './store/driverStore';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import ActiveRide from './pages/ActiveRide';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';

export default function App() {
  const { tg, initData } = useTelegram();
  const { login, driver, isLoading, token } = useDriverStore();

  useEffect(() => {
    tg.expand();
    tg.ready();
    if (initData) login(initData);
  }, [initData]);

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Yuklanmoqda...</p>
    </div>
  );

  if (!token) return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <p>Telegram orqali kirish kerak</p>
    </div>
  );

  const isRegistered = driver && driver.status !== undefined;

  return (
    <BrowserRouter>
      <Routes>
        {!isRegistered ? (
          <Route path="*" element={<Register />} />
        ) : (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/active-ride" element={<ActiveRide />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
