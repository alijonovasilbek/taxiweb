import React, { useEffect, useState } from 'react';

export default function Login({ onLogin }) {
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) {
      handleTelegramLogin(initData);
    }
  }, []);

  const handleTelegramLogin = async (initData) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Xatolik');
      if (data.role !== 'admin') throw new Error('Admin huquqi yo\'q');
      localStorage.setItem('taxigo_admin_token', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: parseInt(telegramId), role: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Xatolik');
      localStorage.setItem('taxigo_admin_token', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚕</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>TaxiGo Admin</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>Boshqaruv paneli</p>
        </div>

        {loading && !error ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>Tekshirilmoqda...</div>
        ) : (
          <form onSubmit={handleDevLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>
                Telegram ID
              </label>
              <input
                type="number"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="Masalan: 123456789"
                required
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                ADMIN_TELEGRAM_IDS ro'yxatida bo'lishi kerak
              </p>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !telegramId}
              style={{ width: '100%', padding: 13, fontSize: 15, fontWeight: 600, background: loading || !telegramId ? '#cbd5e1' : '#2563EB', color: '#fff', border: 'none', borderRadius: 10, cursor: loading || !telegramId ? 'default' : 'pointer' }}
            >
              {loading ? 'Kirish...' : 'Kirish'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
