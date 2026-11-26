import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Page, Spinner, StatusBadge, Route, Field, Rating, Modal, Stars } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { formatDateTime, formatPrice, apiError, timeAgo, toInputDateTime } from '../../utils/formatters';
import { DURATION_UNITS } from '../../utils/constants';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

const unitLabel = (u) => DURATION_UNITS.find((x) => x.code === u)?.label || '';

function Details({ r, category }) {
  const rows = [
    category && ['Transport', category.name],
    r.cargo_type && ['Yuk turi', r.cargo_type],
    r.weight_kg && ['Og\'irligi', `${r.weight_kg} kg`],
    r.volume_m3 && ['Hajmi', `${r.volume_m3} m³`],
    r.work_volume && ['Ish hajmi', r.work_volume],
    r.duration_value && ['Muddat', `${Number(r.duration_value)} ${unitLabel(r.duration_unit)}`],
    r.distance_km && ['Masofa', `${r.distance_km} km`],
    ['Vaqt', r.scheduled_at ? formatDateTime(r.scheduled_at) : 'Imkon qadar tez'],
    r.budget && ['Byudjet', formatPrice(r.budget)],
    r.estimated_price && ['Taxminiy narx', formatPrice(r.estimated_price)],
  ].filter(Boolean);
  return (
    <div className="card">
      <div className="between mb12">
        <div className="bold">{r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Spets texnika')}</div>
        <StatusBadge status={r.status} />
      </div>
      <Route from={r.from_address} to={r.to_address} />
      <div className="mt12">
        {rows.map(([k, v]) => (
          <div key={k} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="muted">{k}</span><span className="bold" style={{ fontSize: 14, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      {r.description && <div className="muted mt12">{r.description}</div>}
    </div>
  );
}

function OfferForm({ request, myOffer, onDone }) {
  const { toast, category } = useAppStore();
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({
    vehicle_id: myOffer?.vehicle_id || '', price: myOffer?.price ? Number(myOffer.price) : (request.budget ? Number(request.budget) : (request.estimated_price ? Number(request.estimated_price) : '')),
    message: myOffer?.message || '', available_at: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    api.get('/requests/feed').then(({ data }) => {
      const ok = data.vehicles.filter((v) => {
        const c = category(v.category);
        return c?.services.includes(request.service_type) && (!request.vehicle_category || request.vehicle_category === v.category);
      });
      setVehicles(ok);
      if (ok.length && !form.vehicle_id) set('vehicle_id', ok[0].id);
    }).catch(() => {});
  }, []);

  const send = async () => {
    try {
      await api.post(`/requests/${request.id}/offers`, {
        vehicle_id: Number(form.vehicle_id), price: Number(form.price), message: form.message || null,
        available_at: form.available_at || null,
      });
      toast('Taklif yuborildi', 'Mijoz tanlasa darhol xabar olasiz');
      onDone();
    } catch (e) { toast('Xatolik', apiError(e), 'error'); }
  };

  if (!vehicles.length) return <div className="card faint">Bu so'rovga taklif berish uchun mos va tasdiqlangan transportingiz yo'q.</div>;

  return (
    <div className="card">
      <div className="card-title">{myOffer ? 'Taklifni yangilash' : 'Taklif berish'}</div>
      <Field label="Transport">
        <select className="select" value={form.vehicle_id} onChange={(e) => set('vehicle_id', e.target.value)}>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{category(v.category)?.name} · {v.model} {v.plate_number || ''}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="Narx, so'm"><input type="number" step={10000} className="input" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Qachon bora olasiz"><input type="datetime-local" className="input" value={form.available_at} min={toInputDateTime(new Date())} onChange={(e) => set('available_at', e.target.value)} /></Field>
      </div>
      <Field label="Xabar"><input className="input" value={form.message} placeholder="Masalan: 30 daqiqada yetib boraman" onChange={(e) => set('message', e.target.value)} /></Field>
      <button className="btn block" disabled={!form.price || !form.vehicle_id} onClick={send}>{myOffer ? 'Yangilash' : 'Taklif yuborish'}</button>
    </div>
  );
}

export default function RequestDetail() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { toast, category, loadCatalog } = useAppStore();
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = useCallback(() => api.get(`/requests/${requestId}`).then(({ data }) => setR(data)).catch(() => navigate('/orders')), [requestId]);
  useEffect(() => { loadCatalog(); load(); }, [load]);
  useEffect(() => {
    const h = (e) => { if (String(e.detail?.data?.request_id) === String(requestId)) load(); };
    window.addEventListener('cs:notification', h);
    return () => window.removeEventListener('cs:notification', h);
  }, [requestId, load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); await load(); } catch (e) { toast('Xatolik', apiError(e), 'error'); } finally { setBusy(false); }
  };

  if (!r) return <Page title="So'rov"><Spinner /></Page>;
  const cat = category(r.vehicle_category);
  const active = ['assigned', 'in_progress'].includes(r.status);

  const sendReview = () => act(async () => {
    await api.post('/reviews', { service_type: r.service_type, ref_id: r.id, rating, comment: comment || null });
    setReviewOpen(false);
  }, 'Rahmat! Bahoyingiz saqlandi');

  return (
    <Page title={r.service_type === 'cargo' ? 'Yuk tashish' : 'Spets texnika'} sub={`#${r.id} · ${timeAgo(r.created_at)}`}>
      <Details r={r} category={cat} />

      {/* ── Mijoz ko'rinishi ── */}
      {r.is_client && (
        <>
          {active && (
            <div className="card" style={{ border: '1.5px solid #BBF7D0' }}>
              <div className="card-title">Ijrochi</div>
              {r.offers?.filter((o) => o.status === 'accepted').map((o) => (
                <div key={o.id}>
                  <div className="between">
                    <div className="clickable" onClick={() => navigate(`/users/${o.provider_id}`)}>
                      <div className="bold">{o.first_name} {o.last_name || ''}</div>
                      <Rating value={o.provider_rating} count={o.provider_reviews} />
                      <div className="faint">{o.vehicle_model} {o.vehicle_plate || ''}</div>
                    </div>
                    <div className="price">{formatPrice(o.price)}</div>
                  </div>
                  {o.provider_phone && <a className="btn secondary block mt12" href={`tel:${o.provider_phone}`}><I n="phone" size={17} /> {o.provider_phone}</a>}
                </div>
              ))}
              <button className="btn green block mt8" disabled={busy} onClick={() => act(() => api.post(`/requests/${r.id}/complete`), 'Yakunlandi')}><I n="done" size={17} /> Ish bajarildi</button>
              {r.status === 'assigned' && (
                <button className="btn red-soft block mt8" disabled={busy} onClick={() => { if (confirm('So\'rovni bekor qilasizmi?')) act(() => api.post(`/requests/${r.id}/cancel`, {}), 'Bekor qilindi'); }}>Bekor qilish</button>
              )}
            </div>
          )}

          {r.status === 'open' && (
            <>
              <div className="section-title">Takliflar ({r.offers?.length || 0})</div>
              {r.offers?.length === 0 && (
                <div className="card faint">Mos ijrochilarga xabar yuborildi. Takliflar shu yerda real vaqtda paydo bo'ladi.</div>
              )}
              {r.offers?.map((o) => (
                <div key={o.id} className="card">
                  <div className="between">
                    <div className="clickable grow" onClick={() => navigate(`/users/${o.provider_id}`)}>
                      <div className="bold">{o.first_name} {o.last_name || ''}</div>
                      <Rating value={o.provider_rating} count={o.provider_reviews} />
                      <div className="faint"><CategoryGlyph code={o.vehicle_category} size={13} /> {o.vehicle_model} {o.capacity_kg ? `· ${o.capacity_kg} kg` : ''}</div>
                      {o.available_at && <div className="faint"><I n="clock" size={13} /> {formatDateTime(o.available_at)}</div>}
                      {o.message && <div className="muted mt8">{o.message}</div>}
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end' }}>
                      <div className="price" style={{ fontSize: 17 }}>{formatPrice(o.price)}</div>
                      <button className="btn sm mt8" disabled={busy} onClick={() => { if (confirm(`${o.first_name} taklifini ${formatPrice(o.price)} ga qabul qilasizmi?`)) act(() => api.post(`/requests/${r.id}/offers/${o.id}/accept`), 'Ijrochi tanlandi'); }}>Tanlash</button>
                    </div>
                  </div>
                </div>
              ))}
              {r.suggested_providers?.length > 0 && (
                <>
                  <div className="section-title">Eng mos ijrochilar (smart matching)</div>
                  {r.suggested_providers.map((p) => (
                    <div key={p.owner_id} className="card clickable row" onClick={() => navigate(`/users/${p.owner_id}`)}>
                      <div className="score">{Math.round(p.score)}<small>ball</small></div>
                      <div className="grow">
                        <div className="bold">{p.first_name} · {category(p.category)?.name} {p.model}</div>
                        <div className="faint">{p.reasons?.join(' · ')}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <button className="btn red-soft block mt12" disabled={busy} onClick={() => { if (confirm('So\'rovni bekor qilasizmi?')) act(() => api.post(`/requests/${r.id}/cancel`, {}), 'Bekor qilindi'); }}>So'rovni bekor qilish</button>
            </>
          )}
        </>
      )}

      {/* ── Ijrochi ko'rinishi ── */}
      {!r.is_client && (
        <>
          {r.is_provider && active && (
            <div className="card" style={{ border: '1.5px solid #e9c3cd' }}>
              <div className="card-title">Mijoz: {r.client_name}</div>
              <Rating value={r.client_rating} />
              {r.client_phone && <a className="btn secondary block mt12" href={`tel:${r.client_phone}`}><I n="phone" size={17} /> {r.client_phone}</a>}
              <div className="between mt12"><span className="muted">Kelishilgan narx</span><span className="price">{formatPrice(r.final_price)}</span></div>
              {r.status === 'assigned' && <button className="btn block mt12" disabled={busy} onClick={() => act(() => api.post(`/requests/${r.id}/start`), 'Ish boshlandi')}><I n="rocket" size={17} /> Ishni boshlash</button>}
              {r.status === 'in_progress' && <button className="btn green block mt12" disabled={busy} onClick={() => act(() => api.post(`/requests/${r.id}/complete`), 'Yakunlandi')}><I n="done" size={17} /> Ishni yakunlash</button>}
              {r.status === 'assigned' && (
                <button className="btn red-soft block mt8" disabled={busy} onClick={() => { const reason = prompt('Voz kechish sababi?'); if (reason !== null) act(() => api.post(`/requests/${r.id}/cancel`, { reason }), 'Siz ishdan voz kechdingiz'); }}>Voz kechish</button>
              )}
            </div>
          )}
          {r.status === 'open' && (
            <>
              <div className="card row">
                <span className="icon-box" style={{ borderRadius: '50%' }}><I n="user" size={20} /></span>
                <div className="grow"><div className="bold">{r.client_name}</div><Rating value={r.client_rating} /></div>
                {r.my_offer && <StatusBadge status={r.my_offer.status} />}
              </div>
              <OfferForm request={r} myOffer={r.my_offer?.status === 'pending' ? r.my_offer : null} onDone={load} />
              {r.my_offer?.status === 'pending' && (
                <button className="btn ghost block" disabled={busy} onClick={() => act(() => api.post(`/offers/${r.my_offer.id}/withdraw`), 'Taklif qaytarib olindi')}>Taklifni qaytarib olish</button>
              )}
            </>
          )}
          {!r.is_provider && r.status !== 'open' && r.my_offer && (
            <div className="card faint">Taklifingiz holati: <StatusBadge status={r.my_offer.status} /></div>
          )}
        </>
      )}

      {r.status === 'completed' && (r.is_client || r.is_provider) && !r.reviewed && (
        <button className="btn accent block" onClick={() => setReviewOpen(true)}><I n="star" size={17} /> {r.is_client ? 'Ijrochini' : 'Mijozni'} baholash</button>
      )}
      {r.status === 'cancelled' && r.cancel_reason && <div className="card faint">Bekor qilish sababi: {r.cancel_reason}</div>}

      {reviewOpen && (
        <Modal title={r.is_client ? 'Ijrochini baholang' : 'Mijozni baholang'} onClose={() => setReviewOpen(false)}>
          <Stars value={rating} onChange={setRating} />
          <textarea className="textarea mt12" placeholder="Izoh (ixtiyoriy)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn block mt12" disabled={busy} onClick={sendReview}>Yuborish</button>
        </Modal>
      )}
    </Page>
  );
}
