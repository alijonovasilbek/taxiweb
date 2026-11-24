import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import LocationPicker from '../../components/LocationPicker';
import { Page, Field } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { DURATION_UNITS } from '../../utils/constants';
import { apiError, formatPrice, toInputDateTime } from '../../utils/formatters';

const META = {
  cargo: { title: 'Yuk tashish', sub: 'Labo, Gazel, Isuzu va boshqalar', icon: '🚚' },
  equipment: { title: 'Spets texnika', sub: 'Ekskavator, buldozer, kran, yuklagich', icon: '🚜' },
};

export default function RequestNew() {
  const { service } = useParams();
  const navigate = useNavigate();
  const { toast, categoriesFor, loadCatalog, catalog } = useAppStore();
  const { user } = useUserStore();
  const meta = META[service] || META.cargo;
  const isCargo = service === 'cargo';

  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const soon = new Date(Date.now() + 2 * 3600 * 1000); soon.setMinutes(0, 0, 0);
  const [form, setForm] = useState({
    vehicle_category: '', title: '', description: '', cargo_type: '', weight_kg: '', volume_m3: '',
    work_volume: '', duration_value: isCargo ? '' : 1, duration_unit: isCargo ? '' : 'shift',
    when: 'now', scheduled_at: toInputDateTime(soon), budget: '', phone: user?.phone || '',
  });
  const [estimate, setEstimate] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { loadCatalog(); }, []);
  const categories = catalog ? categoriesFor(service) : [];

  useEffect(() => {
    const params = { service, category: form.vehicle_category || undefined };
    if (isCargo) {
      if (!from || !to) { setEstimate(null); return; }
      Object.assign(params, { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng });
    } else {
      if (!form.duration_value || !form.duration_unit) { setEstimate(null); return; }
      Object.assign(params, { duration_value: form.duration_value, duration_unit: form.duration_unit });
    }
    const t = setTimeout(() => api.get('/tariffs/estimate', { params }).then(({ data }) => setEstimate(data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [from, to, form.vehicle_category, form.duration_value, form.duration_unit]);

  const submit = async () => {
    if (!from) return toast(isCargo ? 'Yuk olinadigan manzilni tanlang' : 'Ish joyini tanlang', '', 'error');
    if (isCargo && !to) return toast('Yetkazish manzilini tanlang', '', 'error');
    setSaving(true);
    const num = (v) => (v === '' || v === null ? null : Number(v));
    try {
      const { data } = await api.post('/requests', {
        service_type: service,
        vehicle_category: form.vehicle_category || null,
        title: form.title || null,
        description: form.description || null,
        cargo_type: form.cargo_type || null,
        weight_kg: num(form.weight_kg),
        volume_m3: num(form.volume_m3),
        work_volume: form.work_volume || null,
        duration_value: num(form.duration_value),
        duration_unit: form.duration_unit || null,
        from, to: isCargo ? to : null,
        scheduled_at: form.when === 'later' ? form.scheduled_at : null,
        budget: num(form.budget),
        phone: form.phone || null,
      });
      toast('✅ So\'rov yuborildi', `${data.matched_providers} ta mos ijrochiga xabar berildi`);
      navigate(`/requests/${data.id}`, { replace: true });
    } catch (e) {
      toast('Xatolik', apiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title={`${meta.icon} ${meta.title}`} sub={meta.sub}>
      <div className="card">
        <Field label={isCargo ? 'Qanday transport kerak?' : 'Qanday texnika kerak?'}>
          <div className="chips">
            {isCargo && <button className={`chip${!form.vehicle_category ? ' active' : ''}`} onClick={() => set('vehicle_category', '')}>Farqi yo'q</button>}
            {categories.map((c) => (
              <button key={c.code} className={`chip${form.vehicle_category === c.code ? ' active' : ''}`} onClick={() => set('vehicle_category', c.code)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Qisqa sarlavha">
          <input className="input" value={form.title} placeholder={isCargo ? 'Masalan: Sement 20 qop' : 'Masalan: Poydevor qazish'} onChange={(e) => set('title', e.target.value)} />
        </Field>
        {isCargo ? (
          <div className="grid2">
            <Field label="Og'irligi (kg)"><input type="number" className="input" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></Field>
            <Field label="Hajmi (m³)"><input type="number" step="0.1" className="input" value={form.volume_m3} onChange={(e) => set('volume_m3', e.target.value)} /></Field>
          </div>
        ) : (
          <>
            <Field label="Ish hajmi">
              <input className="input" value={form.work_volume} placeholder="Masalan: 40 m³ tuproq qazish" onChange={(e) => set('work_volume', e.target.value)} />
            </Field>
            <div className="grid2">
              <Field label="Muddat"><input type="number" min="0.5" step="0.5" className="input" value={form.duration_value} onChange={(e) => set('duration_value', e.target.value)} /></Field>
              <Field label="Birlik">
                <select className="select" value={form.duration_unit} onChange={(e) => set('duration_unit', e.target.value)}>
                  {DURATION_UNITS.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}
        {isCargo && (
          <Field label="Yuk turi"><input className="input" value={form.cargo_type} placeholder="Qurilish materiali, mebel, oziq-ovqat..." onChange={(e) => set('cargo_type', e.target.value)} /></Field>
        )}
        <Field label="Qo'shimcha izoh">
          <textarea className="textarea" value={form.description} placeholder="Yuklash-tushirish kerakmi, kirish yo'li qanday..." onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>

      <div className="card">
        <LocationPicker label={isCargo ? 'Qayerdan olinadi' : 'Ish joyi'} value={from} onChange={setFrom} />
        {isCargo && <LocationPicker label="Qayerga yetkaziladi" value={to} onChange={setTo} dot="red" />}
        <Field label="Qachon?">
          <div className="tabs" style={{ marginBottom: 8 }}>
            <button className={`tab${form.when === 'now' ? ' active' : ''}`} onClick={() => set('when', 'now')}>Hozir</button>
            <button className={`tab${form.when === 'later' ? ' active' : ''}`} onClick={() => set('when', 'later')}>Belgilangan vaqtda</button>
          </div>
          {form.when === 'later' && <input type="datetime-local" className="input" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />}
        </Field>
      </div>

      <div className="card">
        {estimate?.estimated_price && (
          <div className="between mb12" style={{ background: 'var(--primary-soft)', padding: '10px 12px', borderRadius: 12 }}>
            <span className="muted">Taxminiy narx{estimate.distance_km ? ` · ${estimate.distance_km} km` : ''}</span>
            <span className="price">{formatPrice(estimate.estimated_price)}</span>
          </div>
        )}
        <div className="grid2">
          <Field label="Byudjetingiz (ixtiyoriy)"><input type="number" step={10000} className="input" value={form.budget} onChange={(e) => set('budget', e.target.value)} /></Field>
          <Field label="Telefon"><input className="input" value={form.phone} placeholder="+998..." onChange={(e) => set('phone', e.target.value)} /></Field>
        </div>
        <div className="hint">Ijrochilar narx taklif qiladi — siz eng mosini tanlaysiz. Telefon raqamingiz faqat tanlangan ijrochiga ko'rinadi.</div>
      </div>

      <div className="bottom-bar">
        <button className="btn block" disabled={saving} onClick={submit}>{saving ? 'Yuborilmoqda...' : 'So\'rov yuborish'}</button>
      </div>
    </Page>
  );
}
