import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Card, Btn, Modal, Field, Input, ErrorBox, Badge } from '../../components/ui';
import { I } from '../../components/icons';

/** Taksi tarif sinflari: Ekonom, Komfort, Biznes, Miniven ... Har biri o'z narxi, o'rinlari va darajasi bilan. */
const NUM_FIELDS = [
  ['base_fare', "Boshlang'ich narx (so'm)"],
  ['per_km_price', "Har km uchun (so'm)"],
  ['per_min_price', "Har daqiqa uchun (so'm)"],
  ['min_fare', "Minimal narx (so'm)"],
  ['night_multiplier', 'Kechasi koeffitsient (22:00–06:00)'],
];
const EMPTY = { name: '', description: '', base_fare: 5000, per_km_price: 1500, per_min_price: 200, min_fare: 10000,
  night_multiplier: 1.5, seats: 4, level: 1, sort_order: 10, is_active: true };

const money = (v) => `${Math.round(Number(v || 0)).toLocaleString('ru-RU').replace(/,/g, ' ')} so'm`;
const example = (t) => Math.max(Math.round((+t.base_fare + +t.per_km_price * 5 + +t.per_min_price * 12) / 100) * 100, +t.min_fare);

function TariffModal({ tariff, onClose, onSaved }) {
  const [form, setForm] = useState(tariff ? { ...EMPTY, ...tariff, description: tariff.description || '' } : EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: form.name.trim(), description: form.description.trim() || null, is_active: !!form.is_active,
      ...Object.fromEntries([...NUM_FIELDS.map(([k]) => k), 'seats', 'level', 'sort_order'].map((k) => [k, Number(form[k])])),
    };
    try {
      if (tariff) await api.put(`/tariffs/${tariff.id}`, body);
      else await api.post('/tariffs', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Saqlab bo\'lmadi');
    }
    setBusy(false);
  };

  return (
    <Modal title={tariff ? `Tarif: ${tariff.name}` : 'Yangi tarif'} onClose={onClose} width={540}>
      <form onSubmit={save}>
        <Field label="Nomi"><Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Komfort" /></Field>
        <Field label="Qisqa tavsif" hint="Mijoz ilovasida tarif nomi ostida ko'rinadi">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Yangiroq va keng mashina" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          {NUM_FIELDS.map(([k, label]) => (
            <Field key={k} label={label}>
              <Input type="number" step="any" min="0" value={form[k]} onChange={(e) => set(k, e.target.value)} required />
            </Field>
          ))}
          <Field label="O'rinlar soni"><Input type="number" min="1" max="20" value={form.seats} onChange={(e) => set('seats', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Sinf darajasi" hint="Yuqori darajali mashina pastki sinf buyurtmalarini ham oladi (Ekonom 1, Komfort 2, Biznes 3)">
            <Input type="number" min="1" max="10" value={form.level} onChange={(e) => set('level', e.target.value)} />
          </Field>
          <Field label="Tartib raqami" hint="Mijoz ilovasidagi ro'yxatda o'rni">
            <Input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px', fontSize: 14 }}>
          <input type="checkbox" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Faol (mijozlar tanlay oladi)
        </label>
        <div style={{ background: 'var(--primary-soft)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
          <b>Misol:</b> 5 km, 12 daqiqalik safar — <b>{money(example(form))}</b> (kunduzi)
        </div>
        <ErrorBox error={error} />
        <Btn type="submit" disabled={busy} style={{ width: '100%', padding: 11, fontSize: 15 }}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</Btn>
      </form>
    </Modal>
  );
}

export default function Tariffs() {
  const [tariffs, setTariffs] = useState([]);
  const [edit, setEdit] = useState(undefined); // undefined — yopiq, null — yangi, obyekt — tahrirlash

  const load = () => api.get('/tariffs').then(({ data }) => setTariffs(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div>
      {edit !== undefined && <TariffModal tariff={edit} onClose={() => setEdit(undefined)} onSaved={load} />}
      <Header
        title="Tariflar"
        sub="Taksi sinflari: narx, o'rinlar va qaysi mashinalar xizmat qiladi"
        right={<Btn onClick={() => setEdit(null)}><I n="car" size={14} /> Tarif qo'shish</Btn>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {tariffs.map((t) => (
          <Card key={t.id} style={{ padding: 18, opacity: t.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <b style={{ fontSize: 17 }}>{t.name}</b>
              {t.is_active ? <Badge color="green">Faol</Badge> : <Badge>O'chirilgan</Badge>}
            </div>
            <div className="faint" style={{ fontSize: 13, minHeight: 18 }}>{t.description || '—'}</div>
            <div style={{ fontSize: 13, lineHeight: 1.8, margin: '10px 0 12px' }}>
              <div>Boshlang'ich: <b>{money(t.base_fare)}</b> · km: <b>{money(t.per_km_price)}</b></div>
              <div>Daqiqa: <b>{money(t.per_min_price)}</b> · minimal: <b>{money(t.min_fare)}</b></div>
              <div>{t.seats} o'rin · daraja {t.level} · haydovchilar: <b>{t.drivers_count}</b></div>
              <div>5 km / 12 daq ≈ <b>{money(example(t))}</b></div>
            </div>
            <Btn kind="ghost" onClick={() => setEdit(t)} style={{ width: '100%' }}>Tahrirlash</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}
