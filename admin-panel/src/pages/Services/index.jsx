import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Card, Btn, Badge, Select, CATEGORY, SERVICE, fmtDate } from '../../components/ui';

const FIELDS = [
  ['base_price', 'Boshlang\'ich'], ['per_km', '1 km'], ['per_hour', '1 soat'], ['per_shift', '1 smena'],
  ['per_day', '1 kun'], ['per_seat_km', '1 o\'rin·km'], ['min_price', 'Minimal'],
];

function TariffRow({ t, onSaved, onDelete }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, Number(t[k] || 0)])));
  const [active, setActive] = useState(t.is_active);
  const dirty = FIELDS.some(([k]) => Number(t[k] || 0) !== Number(form[k])) || active !== t.is_active;
  const save = async () => {
    await api.post('/service-tariffs', { service_type: t.service_type, vehicle_category: t.vehicle_category, ...form, is_active: active });
    onSaved();
  };
  return (
    <tr style={{ borderTop: '1px solid var(--line)' }}>
      <td style={{ padding: '8px 10px', fontSize: 13, whiteSpace: 'nowrap' }}>{SERVICE[t.service_type] || t.service_type}</td>
      <td style={{ padding: '8px 10px', fontSize: 13, whiteSpace: 'nowrap' }}>{CATEGORY[t.vehicle_category] || 'Umumiy'}</td>
      {FIELDS.map(([k]) => (
        <td key={k} style={{ padding: '6px 4px' }}>
          <input type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            style={{ width: 92, padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--line)', fontSize: 13 }} />
        </td>
      ))}
      <td style={{ padding: '6px 8px' }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
        <Btn disabled={!dirty} onClick={save}>Saqlash</Btn>{' '}
        <Btn kind="red" onClick={() => onDelete(t.id)}>✕</Btn>
      </td>
    </tr>
  );
}

export default function Services() {
  const [types, setTypes] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [newSvc, setNewSvc] = useState('cargo');
  const [newCat, setNewCat] = useState(null);

  const load = () => {
    api.get('/service-types').then(({ data }) => setTypes(data)).catch(() => {});
    api.get('/service-tariffs').then(({ data }) => setTariffs(data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const toggle = async (code, is_active) => { await api.put(`/service-types/${code}`, { is_active }); load(); };
  const remove = async (id) => { if (confirm('Tarifni o\'chirasizmi?')) { await api.delete(`/service-tariffs/${id}`); load(); } };
  const add = async () => {
    await api.post('/service-tariffs', { service_type: newSvc, vehicle_category: newCat || null });
    load();
  };

  return (
    <div>
      <Header title="Servislar va tariflar" sub="Servislarni yoqish/o'chirish va narx qoidalari (xizmat turiga mos)" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 22 }}>
        {types.map((s) => (
          <Card key={s.code} style={{ padding: 16, opacity: s.is_active ? 1 : 0.75 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.icon} {s.name}</div>
              {s.is_active ? <Badge color="green">Faol</Badge> : <Badge color="gray">O'chiq</Badge>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 12px', minHeight: 32 }}>{s.description}</div>
            <Btn kind={s.is_active ? 'ghost' : 'green'} onClick={() => toggle(s.code, !s.is_active)}>{s.is_active ? 'O\'chirish' : 'Yoqish'}</Btn>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Narx qoidalari (so'm)</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Taxminiy narx = boshlang'ich + masofa × km narxi + muddat × soat/smena/kun narxi; minimaldan kam bo'lmaydi. Taksi tarifi — alohida "Tarif" sahifasida.</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Select value={newSvc} onChange={(v) => setNewSvc(v || 'cargo')} options={[['carpool', 'Po\'puti'], ['cargo', 'Yuk tashish'], ['equipment', 'Spets texnika']]} />
            <Select value={newCat} onChange={setNewCat} placeholder="Umumiy" options={Object.entries(CATEGORY)} />
            <Btn onClick={add}>＋ Qo'shish</Btn>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
          <thead>
            <tr style={{ background: '#fafafc' }}>
              {['Servis', 'Kategoriya', ...FIELDS.map(([, l]) => l), 'Faol', ''].map((h) => (
                <th key={h} style={{ padding: '10px', textAlign: 'left', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tariffs.map((t) => <TariffRow key={`${t.id}-${t.updated_at}`} t={t} onSaved={load} onDelete={remove} />)}
          </tbody>
        </table>
        <div style={{ padding: 12, fontSize: 12, color: 'var(--faint)' }}>Oxirgi o'zgarish: {fmtDate(tariffs.map((t) => t.updated_at).sort().pop())}</div>
      </Card>
    </div>
  );
}
