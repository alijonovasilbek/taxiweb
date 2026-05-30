import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useUserStore } from './store/userStore';
import Home from './pages/Home';
import BookRide from './pages/BookRide';
import Tracking from './pages/Tracking';
import Payment from './pages/Payment';
import Rating from './pages/Rating';
import History from './pages/History';
import Profile from './pages/Profile';

export default function App() {
  const { tg, initData } = useTelegram();
  const { login, isLoading, token } = useUserStore();

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<BookRide />} />
        <Route path="/tracking/:orderId" element={<Tracking />} />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/rating/:orderId" element={<Rating />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
