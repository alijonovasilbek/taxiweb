import React, { useEffect, useState } from 'react';
import { I } from '../../components/icons';

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Xatolik');
  return data;
}

/**
 * Admin kirishi:
 *  1) Telegram ichida ochilsa — initData orqali avtomatik (ADMIN_TELEGRAM_IDS).
 *  2) Brauzerda — Telegram ID → bot shu admin chatiga 6 xonali bir martalik kod yuboradi → kod kiritiladi.
 */
export default function Login({ onLogin }) {
  const [telegramId, setTelegramId] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finish = (data) => {
    localStorage.setItem('taxigo_admin_token', data.token);
    onLogin(data.token);
  };

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    setLoading(true);
    post('/api/auth/verify-telegram', { initData })
      .then((data) => {
        if (data.role !== 'admin') throw new Error('Admin huquqi yo\'q');
        finish(data);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const requestCode = async (e) => {
    e?.preventDefault();
    setLoading(true); setError('');
    try {
      await post('/api/auth/admin/request-code', { telegram_id: Number(telegramId) });
      setStep('code'); setCode('');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      finish(await post('/api/auth/admin/verify-code', { telegram_id: Number(telegramId), code }));
    } catch (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'radial-gradient(1200px 600px at 80% -10%, rgba(232,176,75,.25), transparent 60%), linear-gradient(160deg, #a8284e 0%, #6e1330 55%, #3d0816 100%)' }}>
      <div className="card" style={{ padding: 36, width: 380, maxWidth: '100%', borderRadius: 22, boxShadow: '0 30px 80px rgba(40,5,15,.45)' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <span className="brand-mark" style={{ width: 60, height: 60, borderRadius: 15, margin: '0 auto 14px' }}><I n="taxi" size={30} /></span>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Chortoq Services</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Boshqaruv paneliga kirish</p>
        </div>

        {step === 'id' ? (
          <form onSubmit={requestCode}>
            <label className="lbl">Telegram ID</label>
            <input className="field" type="number" inputMode="numeric" value={telegramId} onChange={(e) => setTelegramId(e.target.value)}
              placeholder="Masalan: 123456789" required autoFocus style={{ width: '100%', padding: '11px 13px', fontSize: 15 }} />
            <p className="faint" style={{ fontSize: 12, marginTop: 7, marginBottom: 18 }}>
              Kirish kodi bot orqali Telegram'ingizga keladi. Avval botga /start yozgan bo'lishingiz kerak.
            </p>
            {error && <div className="login-err">{error}</div>}
            <button type="submit" className="btn primary" disabled={loading || !telegramId} style={{ width: '100%', padding: 12, fontSize: 15, borderRadius: 11 }}>
              {loading ? 'Yuborilmoqda…' : 'Kod olish'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <label className="lbl">Telegram'ga kelgan 6 xonali kod</label>
            <input className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••"
              style={{ width: '100%', padding: '11px 13px', fontSize: 22, letterSpacing: '.4em', textAlign: 'center' }} />
            <p className="faint" style={{ fontSize: 12, marginTop: 7, marginBottom: 18 }}>
              Kod 5 daqiqa amal qiladi. Kelmadimi? <a href="#" onClick={(e) => { e.preventDefault(); requestCode(); }}>Qayta yuborish</a>
              {' · '}<a href="#" onClick={(e) => { e.preventDefault(); setStep('id'); setError(''); }}>ID'ni o'zgartirish</a>
            </p>
            {error && <div className="login-err">{error}</div>}
            <button type="submit" className="btn primary" disabled={loading || code.length !== 6} style={{ width: '100%', padding: 12, fontSize: 15, borderRadius: 11 }}>
              {loading ? 'Tekshirilmoqda…' : 'Kirish'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
