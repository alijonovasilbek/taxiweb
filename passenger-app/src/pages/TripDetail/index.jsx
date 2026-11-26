import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Page, Spinner, StatusBadge, Route, Field, Rating, Modal, Stars } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { formatDateTime, formatPrice, apiError, WEEKDAYS_SHORT } from '../../utils/formatters';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

function ReviewModal({ bookingId, title, onClose, onDone }) {
  const { toast } = useAppStore();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const send = async () => {
    try {
      await api.post('/reviews', { service_type: 'carpool', ref_id: bookingId, rating, comment: comment || null });
      toast('Rahmat!', 'Bahoyingiz saqlandi');
      onDone();
    } catch (e) { toast('Xatolik', apiError(e), 'error'); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <Stars value={rating} onChange={setRating} />
      <textarea className="textarea mt12" placeholder="Izoh (ixtiyoriy)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn block mt12" onClick={send}>Yuborish</button>
    </Modal>
  );
}

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { toast } = useAppStore();
  const { user } = useUserStore();
  const [trip, setTrip] = useState(null);
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);

  const load = useCallback(() => api.get(`/carpool/trips/${tripId}`).then(({ data }) => setTrip(data)).catch(() => navigate('/carpool')), [tripId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e) => { if (String(e.detail?.data?.trip_id) === String(tripId)) load(); };
    window.addEventListener('cs:notification', h);
    return () => window.removeEventListener('cs:notification', h);
  }, [tripId, load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); await load(); } catch (e) { toast('Xatolik', apiError(e), 'error'); } finally { setBusy(false); }
  };

  if (!trip) return <Page title="Qatnov"><Spinner /></Page>;

  const myB = trip.my_booking;
  const canBook = !trip.is_owner && trip.status === 'active' && (!myB || !['pending', 'confirmed'].includes(myB.status));

  return (
    <Page title="Qatnov" sub={formatDateTime(trip.departure_at)}>
      <div className="card">
        <div className="between mb12">
          <StatusBadge status={trip.status} />
          <span className="price" style={{ fontSize: 20 }}>{formatPrice(trip.price_per_seat)}<span className="faint"> / o'rin</span></span>
        </div>
        <Route from={trip.from_address} to={trip.to_address} />
        <div className="grid3 mt16">
          <div className="col"><span className="faint">Jo'nash</span><span className="bold">{formatDateTime(trip.departure_at)}</span></div>
          <div className="col"><span className="faint">Bo'sh o'rin</span><span className="bold">{trip.seats_available} / {trip.seats_total}</span></div>
          <div className="col"><span className="faint">Pochta</span><span className="bold">{trip.allow_parcels ? 'Ha' : 'Yo\'q'}</span></div>
        </div>
        {trip.recurring_days?.length > 0 && <div className="faint mt12"><I n="repeat" size={13} /> Har hafta: {trip.recurring_days.map((d) => WEEKDAYS_SHORT[d]).join(', ')}</div>}
        {trip.note && <div className="muted mt12">{trip.note}</div>}
      </div>

      {!trip.is_owner && (
        <div className="card clickable row" onClick={() => navigate(`/users/${trip.driver_id}`)}>
          <div className="icon-box" style={{ borderRadius: '50%' }}><I n="user" size={20} /></div>
          <div className="grow">
            <div className="bold">{trip.driver_name} {trip.driver_last_name || ''}</div>
            <div className="row" style={{ gap: 6 }}>
              <Rating value={trip.driver_rating} count={trip.driver_reviews} />
              {trip.vehicle_model && <span className="faint">· {trip.vehicle_model} {trip.vehicle_color || ''} {trip.vehicle_plate || ''}</span>}
            </div>
            {trip.driver_phone && <a className="bold" href={`tel:${trip.driver_phone}`} style={{ color: 'var(--primary)' }}><I n="phone" size={14} /> {trip.driver_phone}</a>}
          </div>
          <span>›</span>
        </div>
      )}

      {/* Yo'lovchi: bron holati */}
      {myB && (
        <div className="card">
          <div className="between">
            <div className="bold">Mening bronim · {myB.seats} o'rin</div>
            <StatusBadge status={myB.status} />
          </div>
          {['pending', 'confirmed'].includes(myB.status) && (
            <button className="btn red-soft block mt12" disabled={busy} onClick={() => act(() => api.post(`/carpool/bookings/${myB.id}/cancel`), 'Bron bekor qilindi')}>Bronni bekor qilish</button>
          )}
          {myB.status === 'completed' && (
            <button className="btn accent block mt12" onClick={() => setReview({ id: myB.id, title: 'Haydovchini baholang' })}><I n="star" size={17} /> Baho qo'yish</button>
          )}
        </div>
      )}

      {canBook && (
        <div className="card">
          <div className="card-title">Joy bron qilish</div>
          <div className="grid2">
            <Field label="O'rinlar soni">
              <select className="select" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                {Array.from({ length: trip.seats_available }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Telefon">
              <input className="input" inputMode="tel" value={phone} placeholder="+998..." onChange={(e) => setPhone(e.target.value)} />
              <div className="hint">{user?.phone_verified && phone === user.phone ? 'Tasdiqlangan raqamingiz' : 'Haydovchi shu raqamga qo‘ng‘iroq qiladi'}</div>
            </Field>
          </div>
          <Field label="Qayerdan olib ketsin?">
            <input className="input" value={note} placeholder="Masalan: Maktab oldi" onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="between mb12"><span className="muted">Jami</span><span className="price" style={{ fontSize: 18 }}>{formatPrice(trip.price_per_seat * seats)}</span></div>
          <button className="btn block" disabled={busy} onClick={() => act(() => api.post(`/carpool/trips/${trip.id}/book`, { seats, pickup_note: note || null, phone: phone || null }), 'Bron so\'rovi yuborildi')}>
            Bron qilish
          </button>
          <div className="hint" style={{ textAlign: 'center' }}>To'lov haydovchiga to'g'ridan-to'g'ri (komissiyasiz)</div>
        </div>
      )}

      {/* Haydovchi: bronlar va boshqaruv */}
      {trip.is_owner && (
        <>
          <div className="section-title">Bronlar ({trip.bookings?.length || 0})</div>
          {trip.bookings?.length === 0 && <div className="card faint">Hali bron yo'q. Yo'lovchilar bron qilganda xabar olasiz.</div>}
          {trip.bookings?.map((b) => (
            <div key={b.id} className="card">
              <div className="between">
                <div>
                  <div className="bold">{b.first_name} {b.last_name || ''} · {b.seats} o'rin</div>
                  <div className="row" style={{ gap: 6 }}><Rating value={b.passenger_rating} />{b.pickup_note && <span className="faint"><I n="pin" size={12} /> {b.pickup_note}</span>}</div>
                  {b.contact_phone && <a href={`tel:${b.contact_phone}`} className="faint" style={{ color: 'var(--primary)' }}><I n="phone" size={12} /> {b.contact_phone}</a>}
                </div>
                <StatusBadge status={b.status} />
              </div>
              {b.status === 'pending' && (
                <div className="grid2 mt12">
                  <button className="btn green sm" disabled={busy} onClick={() => act(() => api.post(`/carpool/bookings/${b.id}/confirm`), 'Tasdiqlandi')}><I n="check" size={15} /> Tasdiqlash</button>
                  <button className="btn red-soft sm" disabled={busy} onClick={() => act(() => api.post(`/carpool/bookings/${b.id}/reject`, {}), 'Rad etildi')}><I n="close" size={15} /> Rad etish</button>
                </div>
              )}
              {b.status === 'completed' && (
                <button className="btn ghost sm mt12" onClick={() => setReview({ id: b.id, title: `${b.first_name}ni baholang` })}><I n="star" size={15} /> Yo'lovchini baholash</button>
              )}
            </div>
          ))}
          <div className="section-title">Qatnov holati</div>
          <div className="card">
            {['active', 'full'].includes(trip.status) && (
              <button className="btn block mb8" disabled={busy} onClick={() => act(() => api.put(`/carpool/trips/${trip.id}/status`, { status: 'departed' }), 'Yo\'lga chiqdingiz')}><I n="nav" size={17} /> Yo'lga chiqdim</button>
            )}
            {['active', 'full', 'departed'].includes(trip.status) && (
              <button className="btn green block mb8" disabled={busy} onClick={() => act(() => api.put(`/carpool/trips/${trip.id}/status`, { status: 'completed' }), 'Qatnov yakunlandi')}><I n="done" size={17} /> Yakunlash</button>
            )}
            {['active', 'full'].includes(trip.status) && (
              <button className="btn red-soft block" disabled={busy} onClick={() => { if (confirm('Qatnovni bekor qilasizmi? Barcha bronlar bekor bo\'ladi.')) act(() => api.put(`/carpool/trips/${trip.id}/status`, { status: 'cancelled' }), 'Bekor qilindi'); }}>Bekor qilish</button>
            )}
            {['completed', 'cancelled'].includes(trip.status) && <div className="faint">Qatnov {trip.status === 'completed' ? 'yakunlangan' : 'bekor qilingan'}.</div>}
          </div>
        </>
      )}

      {review && <ReviewModal bookingId={review.id} title={review.title} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); }} />}
    </Page>
  );
}
