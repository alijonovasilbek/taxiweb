import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDriverStore } from './store/driverStore';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import ActiveRide from './pages/ActiveRide';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';

function DriverLogin() {
  const { login } = useDriverStore();
  const [driverLogin, setDriverLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(driverLogin, password);
    if (!result?.success) {
      setError(result?.message || 'Login yoki parol noto\'g\'ri');
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F1F5F9' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 12px' }}>рџљ—</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Haydovchi kirish</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Admin bergan login va parol bilan kiring</div>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 6 }}>Login</label>
          <input
            type="text"
            value={driverLogin}
            onChange={(e) => setDriverLogin(e.target.value)}
            placeholder="driver01"
            required
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 15, marginBottom: 14, boxSizing: 'border-box', color: '#1E293B', outline: 'none' }}
          />
          <label style={{ fontSize: 13, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 6 }}>Parol</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 15, marginBottom: 14, boxSizing: 'border-box', color: '#1E293B', outline: 'none' }}
          />
          {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
          <button type="submit" disabled={loading || !driverLogin || !password} style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none',
            background: loading || !driverLogin || !password ? '#CBD5E1' : '#2563EB',
            color: '#fff', fontSize: 16, fontWeight: 600, cursor: loading || !driverLogin || !password ? 'default' : 'pointer',
            boxShadow: loading || !driverLogin || !password ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
          }}>
            {loading ? 'Kirish...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const { fetchMe, driver, isLoading, token, clearSession } = useDriverStore();

  useEffect(() => {
    if (token && !driver) fetchMe();
  }, [driver, fetchMe, token]);

  useEffect(() => {
    const handleExpired = () => clearSession();
    window.addEventListener('driver-auth-expired', handleExpired);
    return () => window.removeEventListener('driver-auth-expired', handleExpired);
  }, [clearSession]);

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Yuklanmoqda...</p>
    </div>
  );

  if (!token) return <DriverLogin />;
  if (!driver) return null;

  return (
    <BrowserRouter basename="/driver">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new-order" element={<NewOrder />} />
        <Route path="/active-ride" element={<ActiveRide />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
