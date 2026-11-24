import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Page, Chips, Spinner, Empty, Rating, Field } from '../../components/ui';
import LocationPicker from '../../components/LocationPicker';
import { useAppStore } from '../../store/appStore';
import { formatDistance, formatPrice, toInputDate, apiError } from '../../utils/formatters';
import { CHORTOQ } from '../../utils/constants';
import { TripCard } from '../Carpool';
import { RequestCard } from '../Orders';

const SERVICES = [
  { value: 'carpool', label: '🚐 Po\'puti' },
  { value: 'cargo', label: '🚚 Yuk' },
  { value: 'equipment', label: '🚜 Texnika' },
  { value: 'taxi', label: '🚕 Taksi' },
];

export default function Search() {
  const navigate = useNavigate();
  const { catalog, loadCatalog, category, categoriesFor, toast } = useAppStore();
  const [service, setService] = useState(null);
  const [q, setQ] = useState('');
  const [place, setPlace] = useState(null);
  const [cat, setCat] = useState(null);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [at, setAt] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadCatalog(); }, []);

  const run = async () => {
    setLoading(true);
    const loc = place || CHORTOQ;
    try {
      const { data } = await api.get('/search', {
        params: {
          service: service || undefined, q: q || undefined, lat: loc.lat, lng: loc.lng,
          category: cat || undefined, date: date || undefined, at: at || undefined,
          max_price: maxPrice || undefined, min_rating: minRating || undefined, available_only: availableOnly || undefined,
        },
      });
      setResult(data);
    } catch (e) { toast('Xatolik', apiError(e), 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { run(); }, [service, cat, minRating, availableOnly]);
  useEffect(() => {
    if (!place) return;
    run();
  }, [place]);

  const cats = service === 'cargo' || service === 'equipment' ? categoriesFor(service) : [];

  return (
    <Page title="Smart qidiruv" sub="Joylashuv, vaqt va talabga mos takliflar" back={false} nav>
      <div className="card">
        <div className="row">
          <input className="input" value={q} placeholder="Labo, ekskavator, Namangan..." onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <button className="btn" onClick={run}>🔎</button>
        </div>
        <div className="mt12"><Chips value={service} onChange={(v) => { setService(v); setCat(null); }} allLabel="Barchasi" items={SERVICES} /></div>
        {cats.length > 0 && <div className="mt8"><Chips value={cat} onChange={setCat} allLabel="Har qanday" items={cats.map((c) => ({ value: c.code, label: `${c.icon} ${c.name}` }))} /></div>}
        <button className="btn ghost sm mt12" onClick={() => setShowFilters((s) => !s)}>⚙️ Filtrlar {showFilters ? '▲' : '▼'}</button>
        {showFilters && (
          <div className="mt12">
            <LocationPicker label="Qayerda kerak" value={place} onChange={setPlace} placeholder="Standart: Chortoq markazi" />
            <div className="grid2">
              <Field label="Sana"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Vaqt"><input type="time" className="input" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
            </div>
            <Field label="Maksimal narx, so'm"><input type="number" className="input" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></Field>
            <Field label="Minimal reyting">
              <Chips value={minRating} onChange={setMinRating} allLabel="Farqi yo'q" items={[3, 4, 4.5].map((r) => ({ value: r, label: `⭐ ${r}+` }))} />
            </Field>
            <div className="between mb12">
              <span className="muted">Faqat hozir bo'shlar</span>
              <button className={`switch${availableOnly ? ' on' : ''}`} onClick={() => setAvailableOnly(!availableOnly)} />
            </div>
            <button className="btn block secondary" onClick={run}>Qo'llash</button>
          </div>
        )}
      </div>

      {loading && <Spinner />}
      {!loading && result && (
        <>
          {result.cross_service_tips?.length > 0 && result.cross_service_tips.map((t, i) => (
            <div key={i} className="card row" style={{ background: 'var(--accent-soft)' }}><span>💡</span><span className="muted grow">{t}</span></div>
          ))}

          {(service === null || service === 'taxi') && result.taxi_nearby !== undefined && (
            <div className="card clickable row" onClick={() => navigate('/book')}>
              <div className="icon-box" style={{ background: 'var(--accent-soft)' }}>🚕</div>
              <div className="grow"><div className="bold">Taksi</div><div className="faint">Yaqin atrofda {result.taxi_nearby} ta bo'sh haydovchi</div></div>
              <span className="btn sm">Chaqirish</span>
            </div>
          )}

          {result.providers?.length > 0 && <div className="section-title">Ijrochilar — moslik bo'yicha ({result.providers.length})</div>}
          {result.providers?.map((p) => {
            const c = category(p.category);
            return (
              <div key={p.id} className="card clickable" onClick={() => navigate(`/users/${p.owner_id}`)}>
                <div className="row">
                  <div className="score">{Math.round(p.score)}<small>ball</small></div>
                  <div className="grow">
                    <div className="bold ellipsis">{c?.icon} {c?.name} · {p.model}</div>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="faint">{p.first_name}</span>
                      <Rating value={p.provider_rating} count={p.provider_reviews} />
                    </div>
                  </div>
                  {p.distance_km !== null && <span className="badge gray">{formatDistance(p.distance_km)}</span>}
                </div>
                <div className="row mt8" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span className={`badge ${p.availability === 'hozir band' ? 'red' : p.availability === 'jadvaldan tashqari vaqt' ? 'orange' : 'green'}`}>{p.availability}</span>
                  {p.capacity_kg && <span className="badge blue">{p.capacity_kg} kg</span>}
                  {p.price_per_hour && <span className="badge yellow">{formatPrice(p.price_per_hour)}/soat</span>}
                  {p.price_per_km && <span className="badge yellow">{formatPrice(p.price_per_km)}/km</span>}
                </div>
              </div>
            );
          })}
          {(service === 'cargo' || service === 'equipment') && (
            <button className="btn block mb12" onClick={() => navigate(`/requests/new/${service}`)}>
              📝 So'rov yuborish — ijrochilar o'zi taklif bersin
            </button>
          )}

          {result.trips?.length > 0 && <div className="section-title">Po'puti qatnovlari ({result.trips.length})</div>}
          {result.trips?.slice(0, 10).map((t) => <TripCard key={t.id} trip={t} onClick={() => navigate(`/carpool/trips/${t.id}`)} />)}

          {result.open_requests?.length > 0 && <div className="section-title">Sizga mos so'rovlar (ijrochi sifatida)</div>}
          {result.open_requests?.slice(0, 5).map((r) => <RequestCard key={r.id} r={r} onClick={() => navigate(`/requests/${r.id}`)} />)}

          {!result.providers?.length && !result.trips?.length && !result.open_requests?.length && (
            <Empty icon="🔍" title="Hech narsa topilmadi" text="Filtrlarni o'zgartiring yoki so'rov yuboring" />
          )}
        </>
      )}
    </Page>
  );
}
