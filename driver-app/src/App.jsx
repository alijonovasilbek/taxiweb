import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { useDriverStore } from './store/driverStore';

function DevLogin({ onLogin }) {
  const [tgId, setTgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: parseInt(tgId), role: 'driver' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Xatolik');
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F1F5F9' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 300, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 12px' }}>🚗</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Haydovchi kirish</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>TaxiGo haydovchi paneli</div>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 6 }}>Telegram ID</label>
          <input
            type="number"
            value={tgId}
            onChange={(e) => setTgId(e.target.value)}
            placeholder="5737465114"
            required
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 15, marginBottom: 14, boxSizing: 'border-box', color: '#1E293B', outline: 'none' }}
          />
          {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
          <button type="submit" disabled={loading || !tgId} style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none',
            background: loading || !tgId ? '#CBD5E1' : '#2563EB',
            color: '#fff', fontSize: 16, fontWeight: 600, cursor: loading || !tgId ? 'default' : 'pointer',
            boxShadow: loading || !tgId ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
          }}>
            {loading ? 'Kirish...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import ActiveRide from './pages/ActiveRide';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';

export default function App() {
  const { tg, initData } = useTelegram();
  const { login, fetchMe, driver, isLoading, token } = useDriverStore();

  useEffect(() => {
    tg.expand();
    tg.ready();
    if (initData) login(initData);
    else if (token && !driver) fetchMe();
  }, [initData]);

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Yuklanmoqda...</p>
    </div>
  );

  if (!token) return <DevLogin onLogin={(t) => { localStorage.setItem('taxigo_driver_token', t); window.location.reload(); }} />;


  const isRegistered = driver && driver.status !== undefined;

  return (
    <BrowserRouter basename="/driver">
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
