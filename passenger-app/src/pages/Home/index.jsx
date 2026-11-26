import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { useOrderStore } from '../../store/orderStore';
import { useAppStore } from '../../store/appStore';
import { NavBar, StatusBadge, Route, useMode } from '../../components/ui';
import { I, ServiceIcon } from '../../components/icons';
import api from '../../services/api';
import { SERVICE_ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';
import { resolveTheme, setTheme } from '../../utils/theme';

/** Asosiy sahifa — dizayn maketi bo'yicha (kunduzgi va tungi mavzu: styles.css → .home-*) */
export default function Home() {
  const navigate = useNavigate();
  const { user, fetchMe } = useUserStore();
  const { activeOrder, fetchActive } = useOrderStore();
  const { catalog, unread, loadCatalog } = useAppStore();
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme || resolveTheme());

  // Ijrochi rejimida ilova ochilganda — ijrochi paneli
  const { mode } = useMode();
  useEffect(() => { if (mode === 'provider') navigate('/provider', { replace: true }); }, [mode]);

  useEffect(() => {
    fetchMe();
    fetchActive();
    loadCatalog();
    api.get('/requests/my').then(({ data }) => setRequests(data.filter((r) => ['open', 'assigned', 'in_progress'].includes(r.status)))).catch(() => {});
    api.get('/carpool/bookings/my').then(({ data }) => setBookings(data.filter((b) => ['pending', 'confirmed'].includes(b.status)))).catch(() => {});
  }, []);

  // Katalogda o'chirilgan servis kartasi ko'rsatilmaydi (katalog yuklanmaguncha — hammasi)
  // Foydalanuvchi Profil → "Asosiy sahifa vidjetlari" da yashirganlari ko'rsatilmaydi
  const hidden = user?.preferences?.home_hidden || [];
  const on = (code) => !hidden.includes(code) && (!catalog || (catalog.services || []).some((s) => s.code === code && s.is_active));
  const allHidden = ['taxi', 'carpool', 'cargo', 'equipment'].every((c) => hidden.includes(c));
  const go = (code) => navigate(SERVICE_ROUTES[code] || '/');

  return (
    <div className="page home">
      <div className="home-hero">
        <div className="between">
          <div className="row" style={{ gap: 10 }}>
            <span className="home-logo">C</span>
            <span className="home-brand">Chortoq Services</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="home-bell" onClick={() => setThemeState(setTheme(theme === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}>
              <I n={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>
            <button className="home-bell" onClick={() => navigate('/notifications')} aria-label="Bildirishnomalar">
              <I n="bell" size={19} />
              {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
            </button>
          </div>
        </div>
        <h1>Salom, {user?.first_name || 'mehmon'}</h1>
        <button className="home-search" onClick={() => navigate('/search')}>
          <I n="search" size={18} />
          <span>Labo, ekskavator, Namangan…</span>
        </button>
      </div>

      <div className="content home-content">
        {activeOrder && (
          <div className="card clickable row accent-left" onClick={() => navigate(`/tracking/${activeOrder.id}`)}>
            <ServiceIcon code="taxi" size={40} />
            <div className="grow">
              <div className="bold">Faol taksi buyurtmasi</div>
              <div className="faint ellipsis">{activeOrder.pickup_address} → {activeOrder.dropoff_address}</div>
            </div>
            <I n="next" size={18} className="chev" />
          </div>
        )}

        {on('taxi') && (
          <button className="home-taxi" onClick={() => go('taxi')}>
            <span className="t">Taksi</span>
            <span className="s">Qayerga boramiz?</span>
            <span className="go"><I n="arrow-ur" size={20} stroke={2.6} /></span>
            <span className="art"><I n="taxi" size={150} stroke={1.6} /></span>
          </button>
        )}

        <div className="home-grid">
          {on('carpool') && (
            <button className="home-tile green" onClick={() => go('carpool')}>
              <span className="ic"><I n="users" size={19} stroke={2.2} /></span>
              <span className="t">Po'puti</span>
              <span className="d">Doimiy qatnov, bo'sh o'rinlarni baham ko'rish</span>
            </button>
          )}
          {on('cargo') && (
            <button className="home-tile blue" onClick={() => go('cargo')}>
              <span className="ic"><I n="truck" size={19} stroke={2.2} /></span>
              <span className="t">Yuk tashish</span>
              <span className="d">Labo, Gazel, Isuzu va boshqalar bilan yuk tashish</span>
            </button>
          )}
        </div>

        {on('equipment') && (
          <button className="home-equip" onClick={() => go('equipment')}>
            <span className="ic"><I n="excavator" size={21} stroke={2.1} /></span>
            <span className="grow">
              <span className="t">Maxsus texnika</span>
              <span className="d">Ekskavator va boshqa texnikalar</span>
            </span>
            <I n="arrow-ur" size={20} stroke={2.4} />
          </button>
        )}

        {allHidden && (
          <button className="card clickable row" style={{ border: 'none', textAlign: 'left', width: '100%', fontFamily: 'inherit', color: 'var(--text)' }}
            onClick={() => navigate('/profile')}>
            <I n="sparkles" size={22} color="var(--primary)" />
            <span className="grow">
              <b>Barcha vidjetlar yashirilgan</b>
              <span className="faint" style={{ display: 'block', fontSize: 13 }}>Profil → Asosiy sahifa vidjetlari</span>
            </span>
            <I n="next" size={18} className="chev" />
          </button>
        )}

        {(requests.length > 0 || bookings.length > 0) && (
          <>
            <div className="section-title">Faol buyurtmalarim</div>
            {requests.slice(0, 3).map((r) => (
              <div key={`r${r.id}`} className="card clickable" onClick={() => navigate(`/requests/${r.id}`)}>
                <div className="between mb12">
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <ServiceIcon code={r.service_type} size={30} />
                    <div className="bold ellipsis">{r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Maxsus texnika')}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <Route from={r.from_address} to={r.to_address} />
                {r.status === 'open' && (
                  <div className="faint mt12 row" style={{ gap: 5 }}><I n="chat" size={14} /> {r.offers_count || 0} ta taklif</div>
                )}
              </div>
            ))}
            {bookings.slice(0, 2).map((b) => (
              <div key={`b${b.id}`} className="card clickable" onClick={() => navigate(`/carpool/trips/${b.trip_id}`)}>
                <div className="between mb12">
                  <div className="row" style={{ gap: 10 }}>
                    <ServiceIcon code="carpool" size={30} />
                    <div className="bold">{formatDateTime(b.departure_at)}</div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <Route from={b.from_address} to={b.to_address} />
              </div>
            ))}
          </>
        )}
      </div>
      <NavBar />
    </div>
  );
}
