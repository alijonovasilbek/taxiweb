import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import LocationPicker from '../../components/LocationPicker';
import { Page, Tabs, Empty, Spinner, StatusBadge, Route, Field, Rating } from '../../components/ui';
import { formatDateTime, formatPrice, toInputDate, apiError, WEEKDAYS_SHORT } from '../../utils/formatters';
import { I, ServiceIcon } from '../../components/icons';

export function TripCard({ trip, onClick, extra }) {
  return (
    <div className="card clickable" onClick={onClick}>
      <div className="between mb12">
        <div className="row" style={{ gap: 10 }}><ServiceIcon code="carpool" size={30} /><div className="bold">{formatDateTime(trip.departure_at)}</div></div>
        <div className="price">{formatPrice(trip.price_per_seat)}</div>
      </div>
      <Route from={trip.from_address} to={trip.to_address} />
      <div className="between mt12">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="faint">{trip.driver_name}</span>
          <Rating value={trip.driver_rating} />
          {trip.vehicle_model && <span className="faint">· {trip.vehicle_model}</span>}
        </div>
        {trip.status === 'active'
          ? <span className="badge green">{trip.seats_available} o'rin</span>
          : <StatusBadge status={trip.status} />}
      </div>
      {trip.recurring_days?.length > 0 && (
        <div className="faint mt8"><I n="repeat" size={13} /> Har {trip.recurring_days.map((d) => WEEKDAYS_SHORT[d]).join(', ')}</div>
      )}
      {extra}
    </div>
  );
}

function SearchTab() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [seats, setSeats] = useState(1);
  const [trips, setTrips] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = { seats, date };
      if (from) Object.assign(params, { from_lat: from.lat, from_lng: from.lng });
      if (to) Object.assign(params, { to_lat: to.lat, to_lng: to.lng });
      const { data } = await api.get('/carpool/trips/search', { params });
      setTrips(data);
    } catch (e) {
      alert(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  return (
    <>
      <div className="card">
        <LocationPicker label="Qayerdan" value={from} onChange={setFrom} placeholder="Masalan: Chortoq" />
        <LocationPicker label="Qayerga" value={to} onChange={setTo} placeholder="Masalan: Namangan" dot="red" />
        <div className="grid2">
          <Field label="Sana">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="O'rinlar">
            <select className="select" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} kishi</option>)}
            </select>
          </Field>
        </div>
        <button className="btn block" onClick={search} disabled={loading}>{loading ? 'Qidirilmoqda...' : <><I n="search" size={18} /> Qatnov qidirish</>}</button>
      </div>
      {loading && <Spinner />}
      {!loading && trips?.length === 0 && (
        <Empty icon="users" title="Mos qatnov topilmadi" text="Boshqa sana yoki yaqinroq manzilni tanlang"
          action={<button className="btn secondary" onClick={() => navigate('/carpool/new')}>Qatnov e'lon qilish</button>} />
      )}
      {!loading && trips?.map((t) => <TripCard key={t.id} trip={t} onClick={() => navigate(`/carpool/trips/${t.id}`)} />)}
    </>
  );
}

function BookingsTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/carpool/bookings/my').then(({ data }) => setItems(data)).catch(() => setItems([])); }, []);
  if (!items) return <Spinner />;
  if (!items.length) return <Empty icon="ticket" title="Bronlar yo'q" text="Qatnov qidiring va joy bron qiling" />;
  return items.map((b) => (
    <div key={b.id} className="card clickable" onClick={() => navigate(`/carpool/trips/${b.trip_id}`)}>
      <div className="between mb8">
        <div className="bold row" style={{ gap: 6 }}><I n="clock" size={16} color="var(--muted)" /> {formatDateTime(b.departure_at)}</div>
        <StatusBadge status={b.status} />
      </div>
      <Route from={b.from_address} to={b.to_address} />
      <div className="between mt12">
        <span className="faint">{b.driver_name} · {b.seats} o'rin</span>
        <span className="price">{formatPrice(b.price_per_seat * b.seats)}</span>
      </div>
      {b.driver_phone && <div className="faint mt8"><I n="phone" size={13} /> {b.driver_phone}</div>}
    </div>
  ));
}

function MyTripsTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/carpool/trips/my').then(({ data }) => setItems(data)).catch(() => setItems([])); }, []);
  return (
    <>
      <button className="btn block accent mb12" onClick={() => navigate('/carpool/new')}><I n="plus" size={19} /> Yangi qatnov e'lon qilish</button>
      {!items && <Spinner />}
      {items?.length === 0 && <Empty icon="route" title="Qatnovlaringiz yo'q" text="Doimiy yo'nalishingizni e'lon qiling — bo'sh o'rinlar to'lsin" />}
      {items?.map((t) => (
        <TripCard key={t.id} trip={t} onClick={() => navigate(`/carpool/trips/${t.id}`)}
          extra={t.pending_bookings > 0 && <div className="mt8"><span className="badge orange"><I n="hand" size={12} /> {t.pending_bookings} ta yangi bron so'rovi</span></div>} />
      ))}
    </>
  );
}

export default function Carpool() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'search';
  return (
    <Page title="Po'puti" sub="Kunlik yo'nalish va ishchi qatnovlar">
      <Tabs value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} items={[
        { value: 'search', label: 'Qidirish' },
        { value: 'bookings', label: 'Bronlarim' },
        { value: 'trips', label: 'Qatnovlarim' },
      ]} />
      {tab === 'search' && <SearchTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'trips' && <MyTripsTab />}
    </Page>
  );
}
