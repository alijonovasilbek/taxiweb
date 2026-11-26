import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import LocationPicker from '../../components/LocationPicker';
import { Page, Field } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { toInputDateTime, apiError, WEEKDAYS_SHORT, formatPrice } from '../../utils/formatters';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

export default function CarpoolNew() {
  const navigate = useNavigate();
  const { toast, categoriesFor, loadCatalog } = useAppStore();
  const [vehicles, setVehicles] = useState([]);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(7, 30, 0, 0);
  const [form, setForm] = useState({
    vehicle_id: '', departure_at: toInputDateTime(tomorrow), seats_total: 3, price_per_seat: '',
    recurring_days: [], allow_parcels: false, note: '',
  });
  const [suggested, setSuggested] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    loadCatalog().then(() => {
      const ok = categoriesFor('carpool').map((c) => c.code);
      api.get('/vehicles/my').then(({ data }) => {
        const list = data.filter((v) => ok.includes(v.category) && v.status !== 'rejected');
        setVehicles(list);
        if (list.length) setForm((f) => ({ ...f, vehicle_id: list[0].id, seats_total: Math.min(f.seats_total, list[0].seats || 4) }));
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    api.get('/carpool/suggest-price', { params: { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng } })
      .then(({ data }) => {
        setSuggested(data);
        setForm((f) => (f.price_per_seat ? f : { ...f, price_per_seat: data.suggested_price_per_seat }));
      }).catch(() => {});
  }, [from, to]);

  const toggleDay = (d) => set('recurring_days', form.recurring_days.includes(d)
    ? form.recurring_days.filter((x) => x !== d) : [...form.recurring_days, d]);

  const submit = async () => {
    if (!from || !to) return toast('Manzillarni tanlang', '', 'error');
    if (!form.price_per_seat) return toast('Narxni kiriting', '', 'error');
    setSaving(true);
    try {
      const { data } = await api.post('/carpool/trips', {
        vehicle_id: form.vehicle_id || null,
        from, to,
        departure_at: form.departure_at,
        seats_total: Number(form.seats_total),
        price_per_seat: Number(form.price_per_seat),
        recurring_days: form.recurring_days.length ? form.recurring_days : null,
        allow_parcels: form.allow_parcels,
        note: form.note || null,
      });
      toast('Qatnov e\'lon qilindi', 'Yo\'lovchilar bron qilganda xabar olasiz');
      navigate(`/carpool/trips/${data.id}`, { replace: true });
    } catch (e) {
      toast('Xatolik', apiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === Number(form.vehicle_id));

  return (
    <Page title="Qatnov e'lon qilish" sub="Doimiy yo'nalish, vaqt, bo'sh o'rinlar va narx">
      <div className="card">
        <LocationPicker label="Qayerdan" value={from} onChange={setFrom} />
        <LocationPicker label="Qayerga" value={to} onChange={setTo} dot="red" />
        {suggested && <div className="hint mb12"><I n="ruler" size={13} /> {suggested.distance_km} km · ~{suggested.duration_min} daqiqa · tavsiya: {formatPrice(suggested.suggested_price_per_seat)} / o'rin</div>}
      </div>

      <div className="card">
        <Field label="Transport" hint={vehicles.length === 0 ? 'Transport qo\'shmagansiz — keyin ham qo\'shishingiz mumkin' : selectedVehicle?.status === 'pending' ? 'Transport admin tasdiqlashini kutmoqda' : null}>
          <select className="select" value={form.vehicle_id} onChange={(e) => set('vehicle_id', e.target.value)}>
            <option value="">— Tanlanmagan —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.model} {v.plate_number || ''} ({v.seats || '?'} o'rin)</option>)}
          </select>
        </Field>
        {vehicles.length === 0 && <button className="btn secondary sm mb12" onClick={() => navigate('/vehicles/new')}><I n="plus" size={17} /> Transport qo'shish</button>}
        <Field label="Jo'nash vaqti">
          <input type="datetime-local" className="input" value={form.departure_at} onChange={(e) => set('departure_at', e.target.value)} />
        </Field>
        <Field label="Takrorlanadi (ixtiyoriy)" hint="Har hafta shu kunlarda qatnaysiz">
          <div className="chips">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={i} type="button" className={`chip${form.recurring_days.includes(i) ? ' active' : ''}`} onClick={() => toggleDay(i)}>{d}</button>
            ))}
          </div>
        </Field>
        <div className="grid2">
          <Field label="Bo'sh o'rinlar">
            <input type="number" min={1} max={selectedVehicle?.seats || 50} className="input" value={form.seats_total} onChange={(e) => set('seats_total', e.target.value)} />
          </Field>
          <Field label="Narx (1 o'rin), so'm">
            <input type="number" min={0} step={1000} className="input" value={form.price_per_seat} onChange={(e) => set('price_per_seat', e.target.value)} />
          </Field>
        </div>
        <div className="between mb12">
          <span className="muted"><I n="parcel" size={15} /> Pochta / kichik yuk olaman</span>
          <button type="button" className={`switch${form.allow_parcels ? ' on' : ''}`} onClick={() => set('allow_parcels', !form.allow_parcels)} />
        </div>
        <Field label="Izoh">
          <textarea className="textarea" placeholder="Masalan: Bozor oldidan olaman, konditsioner bor" value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>
      <div className="bottom-bar">
        <button className="btn block" disabled={saving} onClick={submit}>{saving ? 'Saqlanmoqda...' : 'E\'lon qilish'}</button>
      </div>
    </Page>
  );
}
