import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Tabs, Empty, Spinner, StatusBadge, Route, Rating, Chips, NavBar } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { formatDateTime, formatPrice, formatDistance, timeAgo } from '../../utils/formatters';
import { RequestCard } from '../Orders';
import { TripCard } from '../Carpool';

function FeedTab() {
  const navigate = useNavigate();
  const { category } = useAppStore();
  const [service, setService] = useState(null);
  const [data, setData] = useState(null);
  const load = useCallback(() => api.get('/requests/feed', { params: { service: service || undefined } }).then(({ data }) => setData(data)).catch(() => setData({ requests: [], vehicles: [] })), [service]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e) => { if (e.detail?.type === 'request_new') load(); };
    window.addEventListener('cs:notification', h);
    return () => window.removeEventListener('cs:notification', h);
  }, [load]);

  if (!data) return <Spinner />;
  if (!data.vehicles.length) {
    return <Empty icon="🚚" title="Tasdiqlangan transport yo'q" text={data.hint || 'Transport qo\'shing va admin tasdiqlashini kuting'}
      action={<button className="btn" onClick={() => navigate('/vehicles')}>Transportlarim</button>} />;
  }
  return (
    <>
      <Chips value={service} onChange={setService} allLabel="Barchasi" items={[{ value: 'cargo', label: '🚚 Yuk' }, { value: 'equipment', label: '🚜 Texnika' }]} />
      <div className="mt12" />
      {data.requests.length === 0 && <Empty icon="🔕" title="Hozircha mos so'rov yo'q" text="Yangi so'rov tushishi bilan xabar olasiz" />}
      {data.requests.map((r) => (
        <div key={r.id} className="card clickable" onClick={() => navigate(`/requests/${r.id}`)}>
          <div className="between mb8">
            <div className="bold ellipsis">{r.service_type === 'cargo' ? '🚚' : '🚜'} {r.title || category(r.vehicle_category)?.name || 'So\'rov'}</div>
            {r.my_offer_status ? <StatusBadge status={r.my_offer_status} /> : <span className="faint">{timeAgo(r.created_at)}</span>}
          </div>
          <Route from={r.from_address} to={r.to_address} />
          <div className="row mt12" style={{ flexWrap: 'wrap', gap: 6 }}>
            {r.vehicle_category && <span className="badge blue">{category(r.vehicle_category)?.name}</span>}
            {r.distance_km !== null && <span className="badge gray">📍 {formatDistance(r.distance_km)}</span>}
            {r.weight_kg && <span className="badge gray">{r.weight_kg} kg</span>}
            {r.duration_value && <span className="badge gray">{Number(r.duration_value)} {r.duration_unit === 'hour' ? 'soat' : r.duration_unit === 'shift' ? 'smena' : 'kun'}</span>}
            {r.scheduled_at && <span className="badge yellow">🕒 {formatDateTime(r.scheduled_at)}</span>}
          </div>
          <div className="between mt12">
            <span className="faint">👤 {r.client_name} · ⭐ {Number(r.client_rating || 5).toFixed(1)}</span>
            <span className="price">{r.budget ? formatPrice(r.budget) : r.estimated_price ? `~${formatPrice(r.estimated_price)}` : 'Kelishiladi'}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function JobsTab() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/requests/jobs').then(({ data }) => setData(data)).catch(() => setData({ jobs: [], pending_offers: [] })); }, []);
  if (!data) return <Spinner />;
  const active = data.jobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const done = data.jobs.filter((j) => !['assigned', 'in_progress'].includes(j.status));
  return (
    <>
      {active.length > 0 && <div className="section-title">Faol ishlar</div>}
      {active.map((r) => <RequestCard key={r.id} r={r} onClick={() => navigate(`/requests/${r.id}`)} />)}
      {data.pending_offers.length > 0 && <div className="section-title">Kutilayotgan takliflarim</div>}
      {data.pending_offers.map((o) => (
        <div key={o.id} className="card clickable" onClick={() => navigate(`/requests/${o.request_id}`)}>
          <div className="between mb8"><div className="bold ellipsis">{o.title || (o.service_type === 'cargo' ? 'Yuk tashish' : 'Spets texnika')}</div><span className="price">{formatPrice(o.price)}</span></div>
          <Route from={o.from_address} to={o.to_address} />
        </div>
      ))}
      {done.length > 0 && <div className="section-title">Tarix</div>}
      {done.map((r) => <RequestCard key={r.id} r={r} onClick={() => navigate(`/requests/${r.id}`)} />)}
      {!data.jobs.length && !data.pending_offers.length && <Empty icon="🧰" title="Hali ishlar yo'q" text="Mos so'rovlarga taklif bering" />}
    </>
  );
}

function TripsTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/carpool/trips/my').then(({ data }) => setItems(data)).catch(() => setItems([])); }, []);
  return (
    <>
      <button className="btn block accent mb12" onClick={() => navigate('/carpool/new')}>＋ Qatnov e'lon qilish</button>
      {!items ? <Spinner /> : items.length === 0 ? <Empty icon="🛣️" title="Qatnovlar yo'q" /> : items.map((t) => (
        <TripCard key={t.id} trip={t} onClick={() => navigate(`/carpool/trips/${t.id}`)}
          extra={t.pending_bookings > 0 && <div className="mt8"><span className="badge orange">🙋 {t.pending_bookings} ta yangi bron</span></div>} />
      ))}
    </>
  );
}

export default function Provider() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'feed';
  const { user, fetchMe } = useUserStore();
  useEffect(() => { fetchMe(); }, []);
  const stats = user?.stats || {};

  return (
    <div className="page">
      <div className="page-header tall">
        <div className="between">
          <div>
            <h1>Ijrochi paneli</h1>
            <div className="sub">Mos so'rovlar, takliflar va qatnovlar</div>
          </div>
          <Rating value={user?.provider_rating} count={user?.provider_reviews} />
        </div>
      </div>
      <div className="content overlap">
        <div className="grid3 mb12">
          <div className="card clickable" style={{ marginBottom: 0, padding: 12, textAlign: 'center' }} onClick={() => navigate('/vehicles')}>
            <div style={{ fontSize: 20 }}>🚚</div><div className="bold">{stats.approved_vehicles ?? 0}/{stats.vehicles ?? 0}</div><div className="faint">Transport</div>
          </div>
          <div className="card clickable" style={{ marginBottom: 0, padding: 12, textAlign: 'center' }} onClick={() => navigate('/schedule')}>
            <div style={{ fontSize: 20 }}>📅</div><div className="bold">Jadval</div><div className="faint">Bo'sh vaqt</div>
          </div>
          <div className="card" style={{ marginBottom: 0, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>✅</div><div className="bold">{stats.jobs_done ?? 0}</div><div className="faint">Bajarilgan</div>
          </div>
        </div>
        <Tabs value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} items={[
          { value: 'feed', label: 'Mos so\'rovlar' },
          { value: 'jobs', label: 'Ishlarim' },
          { value: 'trips', label: 'Qatnovlar' },
        ]} />
        {tab === 'feed' && <FeedTab />}
        {tab === 'jobs' && <JobsTab />}
        {tab === 'trips' && <TripsTab />}
      </div>
      <NavBar />
    </div>
  );
}
