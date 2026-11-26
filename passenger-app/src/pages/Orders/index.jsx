import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Page, Tabs, Empty, Spinner, StatusBadge, Route } from '../../components/ui';
import { formatDateTime, formatPrice, timeAgo } from '../../utils/formatters';
import { I, ServiceGlyph, CategoryIcon, ServiceIcon } from '../../components/icons';

const TAXI_STATUS = { searching: 'open', accepted: 'assigned', driver_arrived: 'assigned', in_progress: 'in_progress', completed: 'completed', cancelled: 'cancelled', no_drivers: 'expired' };

export function RequestCard({ r, onClick }) {
  return (
    <div className="card clickable" onClick={onClick}>
      <div className="between mb12">
        <div className="row" style={{ gap: 10, minWidth: 0 }}><ServiceIcon code={r.service_type} size={30} /><div className="bold ellipsis">{r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Spets texnika')}</div></div>
        <StatusBadge status={r.status} />
      </div>
      <Route from={r.from_address} to={r.to_address} />
      <div className="between mt12">
        <span className="faint">{r.scheduled_at ? <><I n="clock" size={13} /> {formatDateTime(r.scheduled_at)}</> : timeAgo(r.created_at)}</span>
        {r.status === 'open'
          ? <span className="badge orange"><I n="chat" size={12} /> {r.offers_count || 0} taklif</span>
          : <span className="price">{formatPrice(r.final_price || r.estimated_price)}</span>}
      </div>
    </div>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'requests';
  const [requests, setRequests] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [rides, setRides] = useState(null);

  useEffect(() => {
    api.get('/requests/my').then(({ data }) => setRequests(data)).catch(() => setRequests([]));
    api.get('/carpool/bookings/my').then(({ data }) => setBookings(data)).catch(() => setBookings([]));
    api.get('/users/me/rides').then(({ data }) => setRides(data)).catch(() => setRides([]));
  }, []);

  return (
    <Page title="Buyurtmalarim" back={false} nav>
      <Tabs value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} items={[
        { value: 'requests', label: 'Yuk / Texnika' },
        { value: 'carpool', label: 'Po\'puti' },
        { value: 'taxi', label: 'Taksi' },
      ]} />

      {tab === 'requests' && (
        !requests ? <Spinner /> : requests.length === 0 ? (
          <Empty icon="parcel" title="So'rovlar yo'q" action={
            <div className="grid2">
              <button className="btn secondary" onClick={() => navigate('/requests/new/cargo')}><ServiceGlyph code="cargo" /> Yuk</button>
              <button className="btn secondary" onClick={() => navigate('/requests/new/equipment')}><ServiceGlyph code="equipment" /> Texnika</button>
            </div>
          } />
        ) : requests.map((r) => <RequestCard key={r.id} r={r} onClick={() => navigate(`/requests/${r.id}`)} />)
      )}

      {tab === 'carpool' && (
        !bookings ? <Spinner /> : bookings.length === 0 ? (
          <Empty icon="users" title="Bronlar yo'q" action={<button className="btn secondary" onClick={() => navigate('/carpool')}>Qatnov qidirish</button>} />
        ) : bookings.map((b) => (
          <div key={b.id} className="card clickable" onClick={() => navigate(`/carpool/trips/${b.trip_id}`)}>
            <div className="between mb8"><div className="row" style={{ gap: 10 }}><ServiceIcon code="carpool" size={30} /><div className="bold">{formatDateTime(b.departure_at)}</div></div><StatusBadge status={b.status} /></div>
            <Route from={b.from_address} to={b.to_address} />
            <div className="between mt12"><span className="faint">{b.driver_name} · {b.seats} o'rin</span><span className="price">{formatPrice(b.price_per_seat * b.seats)}</span></div>
          </div>
        ))
      )}

      {tab === 'taxi' && (
        !rides ? <Spinner /> : rides.length === 0 ? (
          <Empty icon="taxi" title="Taksi buyurtmalari yo'q" action={<button className="btn secondary" onClick={() => navigate('/book')}>Taksi chaqirish</button>} />
        ) : rides.map((o) => (
          <div key={o.id} className="card clickable" onClick={() => navigate(['completed', 'cancelled', 'no_drivers'].includes(o.status) ? '/history' : `/tracking/${o.id}`)}>
            <div className="between mb8"><div className="row" style={{ gap: 10 }}><ServiceIcon code="taxi" size={30} /><div className="bold">{formatDateTime(o.created_at)}</div></div><StatusBadge status={TAXI_STATUS[o.status] || o.status} /></div>
            <Route from={o.pickup_address} to={o.dropoff_address} />
            <div className="between mt12"><span className="faint">{o.distance_km} km</span><span className="price">{formatPrice(o.final_price || o.estimated_price)}</span></div>
          </div>
        ))
      )}
    </Page>
  );
}
