import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Page, Field, Spinner } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { apiError } from '../../utils/formatters';

const EMPTY = {
  category: '', model: '', plate_number: '', color: '', year: '', seats: '', capacity_kg: '', volume_m3: '',
  description: '', price_per_km: '', price_per_hour: '', price_per_shift: '', price_per_day: '',
};

const GROUPS = [
  { title: '🚗 Yo\'lovchi tashish', codes: ['sedan', 'minivan', 'bus'] },
  { title: '🚚 Yuk tashish', codes: ['damas', 'labo', 'gazel', 'isuzu', 'kamaz', 'dump_truck'] },
  { title: '🚜 Spets texnika', codes: ['excavator', 'bulldozer', 'crane', 'loader', 'tractor', 'concrete_mixer'] },
];

export default function VehicleForm() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { catalog, loadCatalog, category, toast } = useAppStore();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(vehicleId));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    loadCatalog();
    if (vehicleId) {
      api.get(`/vehicles/${vehicleId}`).then(({ data }) => {
        const f = { ...EMPTY };
        Object.keys(EMPTY).forEach((k) => { f[k] = data[k] ?? ''; });
        setForm(f);
      }).finally(() => setLoading(false));
    }
  }, [vehicleId]);

  const cat = category(form.category);
  const services = cat?.services || [];
  const passenger = services.includes('carpool') || services.includes('taxi');
  const cargo = services.includes('cargo');
  const equipment = services.includes('equipment');

  const save = async () => {
    if (!form.category || !form.model) return toast('Kategoriya va modelni kiriting', '', 'error');
    setSaving(true);
    const body = {};
    Object.entries(form).forEach(([k, v]) => {
      if (v === '' || v === null) body[k] = null;
      else if (['year', 'seats', 'capacity_kg'].includes(k)) body[k] = parseInt(v, 10);
      else if (k.startsWith('price_') || k === 'volume_m3') body[k] = Number(v);
      else body[k] = v;
    });
    try {
      if (vehicleId) await api.put(`/vehicles/${vehicleId}`, body);
      else await api.post('/vehicles', body);
      toast(vehicleId ? 'Saqlandi' : '✅ Transport qo\'shildi', vehicleId ? '' : 'Admin tasdiqlagach buyurtmalar ola boshlaysiz');
      navigate('/vehicles', { replace: true });
    } catch (e) {
      toast('Xatolik', apiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !catalog) return <Page title="Transport"><Spinner /></Page>;

  return (
    <Page title={vehicleId ? 'Transportni tahrirlash' : 'Transport qo\'shish'} sub="Bitta transport bir nechta xizmatda ishlashi mumkin">
      <div className="card">
        <div className="card-title">Turi</div>
        {GROUPS.map((g) => (
          <div key={g.title} className="mb12">
            <div className="faint mb8">{g.title}</div>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {g.codes.map((code) => {
                const c = category(code);
                if (!c) return null;
                return <button key={code} className={`chip${form.category === code ? ' active' : ''}`} onClick={() => set('category', code)}>{c.icon} {c.name}</button>;
              })}
            </div>
          </div>
        ))}
        {cat && (
          <div className="hint">
            Bu transport bilan: {services.map((s) => ({ taxi: 'taksi', carpool: 'po\'puti', cargo: 'yuk tashish', equipment: 'spets texnika', agro: 'qishloq xo\'jaligi' }[s])).join(', ')} xizmatlarida so'rov olasiz
          </div>
        )}
      </div>

      {cat && (
        <>
          <div className="card">
            <Field label="Model / nomi"><input className="input" value={form.model} placeholder="Masalan: Chevrolet Labo, JCB 3CX" onChange={(e) => set('model', e.target.value)} /></Field>
            <div className="grid2">
              <Field label="Davlat raqami"><input className="input" value={form.plate_number} placeholder="50 A 123 BC" onChange={(e) => set('plate_number', e.target.value)} /></Field>
              <Field label="Yili"><input type="number" className="input" value={form.year} onChange={(e) => set('year', e.target.value)} /></Field>
            </div>
            <div className="grid2">
              <Field label="Rangi"><input className="input" value={form.color} onChange={(e) => set('color', e.target.value)} /></Field>
              {passenger && <Field label="O'rinlar soni"><input type="number" className="input" value={form.seats} onChange={(e) => set('seats', e.target.value)} /></Field>}
            </div>
            {(cargo || equipment) && (
              <div className="grid2">
                <Field label="Yuk ko'tarish (kg)"><input type="number" className="input" value={form.capacity_kg} onChange={(e) => set('capacity_kg', e.target.value)} /></Field>
                {cargo && <Field label="Kuzov hajmi (m³)"><input type="number" step="0.1" className="input" value={form.volume_m3} onChange={(e) => set('volume_m3', e.target.value)} /></Field>}
              </div>
            )}
            <Field label="Tavsif"><textarea className="textarea" value={form.description} placeholder="Qo'shimcha imkoniyatlar, tajriba..." onChange={(e) => set('description', e.target.value)} /></Field>
          </div>

          <div className="card">
            <div className="card-title">Narxlar (ixtiyoriy)</div>
            <div className="hint mb12">Smart matching mijoz byudjetiga mos ijrochilarni yuqoriga chiqaradi</div>
            <div className="grid2">
              {(cargo || passenger) && <Field label="1 km uchun"><input type="number" className="input" value={form.price_per_km} onChange={(e) => set('price_per_km', e.target.value)} /></Field>}
              {equipment && <Field label="1 soat"><input type="number" className="input" value={form.price_per_hour} onChange={(e) => set('price_per_hour', e.target.value)} /></Field>}
              {equipment && <Field label="1 smena (8 soat)"><input type="number" className="input" value={form.price_per_shift} onChange={(e) => set('price_per_shift', e.target.value)} /></Field>}
              {(equipment || cargo) && <Field label="1 kun"><input type="number" className="input" value={form.price_per_day} onChange={(e) => set('price_per_day', e.target.value)} /></Field>}
            </div>
          </div>
        </>
      )}

      <div className="bottom-bar">
        <button className="btn block" disabled={saving || !form.category} onClick={save}>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </Page>
  );
}
