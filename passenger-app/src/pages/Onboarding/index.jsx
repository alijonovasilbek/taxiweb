import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserStore } from '../../store/userStore';
import { usePhoneShare } from '../../hooks/usePhoneShare';
import { I, ServiceIcon } from '../../components/icons';
import { apiError } from '../../utils/formatters';

function Shell({ step, children }) {
  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 20px 28px' }}>
      <div className="row" style={{ justifyContent: 'center', gap: 6, padding: '18px 0 8px' }}>
        {[1, 2].map((n) => (
          <span key={n} style={{ width: n === step ? 22 : 7, height: 7, borderRadius: 4, transition: 'width .2s',
            background: n <= step ? 'var(--primary)' : 'rgba(60,60,67,.18)' }} />
        ))}
      </div>
      {children}
    </div>
  );
}

function PhoneStep() {
  const { user } = useUserStore();
  const { canShare, share, saveManual, busy, error } = usePhoneShare();
  const [manual, setManual] = useState('');

  return (
    <Shell step={1}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginBottom: 22 }}>
          {['taxi', 'carpool', 'cargo', 'equipment'].map((c) => <ServiceIcon key={c} code={c} size={52} />)}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em' }}>
          Xush kelibsiz{user?.first_name ? `, ${user.first_name}` : ''}
        </h1>
        <p className="faint" style={{ fontSize: 17, marginTop: 10, lineHeight: 1.4 }}>
          Taksi, po'puti, yuk tashish va spets texnika — barchasi bitta ilovada.
        </p>

        <div className="group" style={{ marginTop: 28, textAlign: 'left' }}>
          {[
            ['phone', '#34c759', 'Haydovchi va mijoz bir-biriga qo\'ng\'iroq qila oladi'],
            ['lock', '#8c1c3a', 'Raqam Telegram orqali tasdiqlanadi, SMS kerak emas'],
            ['users', '#ff9500', 'Raqamingizni faqat buyurtma ishtirokchilari ko\'radi'],
          ].map(([icon, bg, text]) => (
            <div key={icon} className="group-item" style={{ cursor: 'default' }}>
              <span className="app-icon" style={{ width: 30, height: 30, borderRadius: 7, background: bg }}>
                <I n={icon} size={17} color="#fff" />
              </span>
              <div className="body"><div className="grow" style={{ fontSize: 15 }}>{text}</div></div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="hint" style={{ color: 'var(--red)', textAlign: 'center', marginBottom: 10 }}>{error}</div>}

      {canShare ? (
        <button className="btn block" disabled={busy} onClick={share}>
          <I n="phone" size={18} /> {busy ? 'Kutilmoqda…' : 'Telefon raqamni ulashish'}
        </button>
      ) : (
        <>
          <input className="input" inputMode="tel" placeholder="+998 90 123 45 67" value={manual}
            onChange={(e) => setManual(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn block" disabled={busy || manual.trim().length < 7} onClick={() => saveManual(manual)}>
            {busy ? 'Saqlanmoqda…' : 'Davom etish'}
          </button>
          <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>Telegram'dan tashqarida: faqat lokal sinov uchun</div>
        </>
      )}
    </Shell>
  );
}

const CHOICES = [
  {
    intent: 'client', icon: 'search', bg: 'linear-gradient(180deg,#a8284e,#5e0f26)',
    title: 'Xizmatdan foydalanaman', text: 'Taksi chaqirish, po\'putiga yo\'l topish, yuk yoki texnika buyurtma qilish',
  },
  {
    intent: 'provider', icon: 'provider', bg: 'linear-gradient(180deg,#f0bf5c,#c98a1f)',
    title: 'Xizmat ko\'rsataman', text: 'Haydovchi, yuk tashuvchi yoki texnika egasi sifatida daromad qilish',
  },
];

function IntentStep() {
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const [choice, setChoice] = useState('client');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/users/me/onboard', { intent: choice });
      setUser(data);
      navigate(choice === 'provider' ? '/vehicles/new' : '/', { replace: true });
    } catch (e) {
      setError(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Shell step={2}>
      <div style={{ flex: 1, paddingTop: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em' }}>Ilovadan qanday foydalanasiz?</h1>
        <p className="faint" style={{ fontSize: 16, marginTop: 8 }}>Keyinroq Profil'dan istalgan vaqtda o'zgartirasiz.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {CHOICES.map((c) => {
            const on = choice === c.intent;
            return (
              <button key={c.intent} onClick={() => setChoice(c.intent)} className="card row"
                style={{ textAlign: 'left', gap: 14, padding: 16, margin: 0, cursor: 'pointer', width: '100%',
                  border: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, transition: 'border-color .15s' }}>
                <span className="app-icon" style={{ width: 46, height: 46, borderRadius: 11, background: c.bg, flexShrink: 0 }}>
                  <I n={c.icon} size={24} color="#fff" />
                </span>
                <div className="grow">
                  <div className="bold" style={{ fontSize: 17 }}>{c.title}</div>
                  <div className="faint" style={{ fontSize: 14, marginTop: 2 }}>{c.text}</div>
                </div>
                <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? 'var(--primary)' : 'transparent', border: on ? 'none' : '1.5px solid rgba(60,60,67,.3)' }}>
                  {on && <I n="check" size={15} color="#fff" stroke={3} />}
                </span>
              </button>
            );
          })}
        </div>
        {choice === 'provider' && (
          <div className="hint" style={{ marginTop: 14 }}>
            Keyingi qadamda transportingiz va hujjatlarini qo'shasiz. Admin tasdiqlagach buyurtma olishni boshlaysiz.
          </div>
        )}
      </div>

      {error && <div className="hint" style={{ color: 'var(--red)', textAlign: 'center', marginBottom: 10 }}>{error}</div>}
      <button className="btn block" disabled={busy} onClick={finish}>{busy ? 'Saqlanmoqda…' : 'Boshlash'}</button>
    </Shell>
  );
}

export default function Onboarding() {
  const { user } = useUserStore();
  return user?.phone_verified ? <IntentStep /> : <PhoneStep />;
}
