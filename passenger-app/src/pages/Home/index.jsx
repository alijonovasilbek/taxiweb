import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { useOrderStore } from '../../store/orderStore';
import { useAppStore } from '../../store/appStore';
import { NavBar, StatusBadge, Route } from '../../components/ui';
import api from '../../services/api';
import { SERVICE_ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';

const TILE_BG = { taxi: '#FEF9C3', carpool: '#DCFCE7', cargo: '#DBEAFE', equipment: '#FFEDD5' };

export default function Home() {
  const navigate = useNavigate();
  const { user, fetchMe } = useUserStore();
  const { activeOrder, fetchActive } = useOrderStore();
  const { catalog, unread, loadCatalog } = useAppStore();
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    fetchMe();
    fetchActive();
    loadCatalog();
    api.get('/requests/my').then(({ data }) => setRequests(data.filter((r) => ['open', 'assigned', 'in_progress'].includes(r.status)))).catch(() => {});
    api.get('/carpool/bookings/my').then(({ data }) => setBookings(data.filter((b) => ['pending', 'confirmed'].includes(b.status)))).catch(() => {});
  }, []);

  const services = catalog?.services || [];
  const active = services.filter((s) => s.is_active);
  const upcoming = services.filter((s) => !s.is_active);
  const isProvider = user?.roles?.some((r) => r !== 'client');

  return (
    <div className="page">
      <div className="page-header tall">
        <div className="between">
          <div>
            <div className="sub" style={{ marginTop: 0 }}>Assalomu alaykum 👋</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{user?.first_name || 'Foydalanuvchi'}</div>
          </div>
          <div className="row">
            <button className="icon-btn" onClick={() => navigate('/notifications')} aria-label="Bildirishnomalar">
              🔔{unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
            </button>
          </div>
        </div>
        <div className="row mt12" style={{ gap: 8 }}>
          <span className="badge" style={{ background: 'var(--accent)', color: 'var(--navy)' }}>CHORTOQ SERVICES</span>
          <span className="sub" style={{ marginTop: 0 }}>Yagona transport va texnika platformasi</span>
        </div>
      </div>

      <div className="content overlap">
        <button className="card clickable row" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => navigate('/search')}>
          <span style={{ fontSize: 20 }}>🔎</span>
          <span className="muted grow">Nima kerak? Labo, ekskavator, Namangan...</span>
          <span className="badge blue">Smart</span>
        </button>

        {activeOrder && (
          <div className="card clickable row" onClick={() => navigate(`/tracking/${activeOrder.id}`)} style={{ border: '1.5px solid #BFDBFE' }}>
            <div className="icon-box" style={{ background: 'var(--primary)' }}>🚕</div>
            <div className="grow">
              <div className="bold">Faol taksi buyurtmasi</div>
              <div className="faint ellipsis">{activeOrder.pickup_address} → {activeOrder.dropoff_address}</div>
            </div>
            <span>›</span>
          </div>
        )}

        <div className="grid2">
          {active.map((s) => (
            <button key={s.code} className="service-tile" onClick={() => navigate(SERVICE_ROUTES[s.code] || '/')}>
              <div className="icon-box" style={{ background: TILE_BG[s.code] || '#F1F5F9' }}>{s.icon}</div>
              <div className="name">{s.name}</div>
              <div className="desc">{s.description}</div>
            </button>
          ))}
        </div>

        {(requests.length > 0 || bookings.length > 0) && (
          <>
            <div className="section-title">Faol buyurtmalarim</div>
            {requests.slice(0, 3).map((r) => (
              <div key={`r${r.id}`} className="card clickable" onClick={() => navigate(`/requests/${r.id}`)}>
                <div className="between mb8">
                  <div className="bold">{r.service_type === 'cargo' ? '🚚' : '🚜'} {r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Spets texnika')}</div>
                  <StatusBadge status={r.status} />
                </div>
                <Route from={r.from_address} to={r.to_address} />
                {r.status === 'open' && <div className="faint mt8">💬 {r.offers_count || 0} ta taklif</div>}
              </div>
            ))}
            {bookings.slice(0, 2).map((b) => (
              <div key={`b${b.id}`} className="card clickable" onClick={() => navigate(`/carpool/trips/${b.trip_id}`)}>
                <div className="between mb8">
                  <div className="bold">🚐 {formatDateTime(b.departure_at)}</div>
                  <StatusBadge status={b.status} />
                </div>
                <Route from={b.from_address} to={b.to_address} />
              </div>
            ))}
          </>
        )}

        <div className="section-title">Xizmat ko'rsatish</div>
        <div className="card clickable row" onClick={() => navigate(isProvider ? '/provider' : '/vehicles/new')}>
          <div className="icon-box" style={{ background: 'var(--accent-soft)' }}>🧰</div>
          <div className="grow">
            <div className="bold">{isProvider ? 'Ijrochi paneli' : 'Transportingizni qo\'shing'}</div>
            <div className="faint">
              {isProvider ? 'Mos so\'rovlar, takliflar va ishlaringiz' : 'Taksi, po\'puti, yuk yoki texnika bilan daromad qiling'}
            </div>
          </div>
          <span>›</span>
        </div>

        {upcoming.length > 0 && (
          <>
            <div className="section-title">Tez kunda</div>
            <div className="grid2">
              {upcoming.map((s) => (
                <div key={s.code} className="service-tile disabled">
                  <div className="row">
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                    <span className="badge gray">Tez kunda</span>
                  </div>
                  <div className="name" style={{ fontSize: 13 }}>{s.name}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <NavBar />
    </div>
  );
}
