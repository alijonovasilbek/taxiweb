import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Btn, Input, Card } from '../../components/ui';
import { I } from '../../components/icons';

const EMPTY = { name: '', address: '', coords: '' };

/** Yandex qidiruvi topmaydigan yoki noto'g'ri ko'rsatadigan Chortoq joylari — Mini App qidiruvida birinchi chiqadi. */
export default function Places() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = () => api.get('/places').then(({ data }) => setRows(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    const [lat, lng] = form.coords.split(',').map((x) => Number(x.trim()));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setError("Koordinata: 41.0694, 71.8237 ko'rinishida"); return; }
    try {
      await api.post('/places', { name: form.name, address: form.address || null, lat, lng });
      setForm(EMPTY);
      load();
    } catch (err) { setError(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || 'Xatolik'); }
  };

  const remove = async (id) => {
    if (!window.confirm("Joy o'chirilsinmi?")) return;
    await api.delete(`/places/${id}`).catch(() => {});
    load();
  };

  return (
    <div>
      <Header title="Mashhur joylar" sub="Mini App qidiruvida Yandex natijalaridan oldin chiqadi" />
      <Card style={{ marginBottom: 16 }}>
        <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr auto', gap: 10, alignItems: 'end' }}>
          <div><label className="lbl">Nomi</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chortoq dehqon bozori" required style={{ width: '100%' }} /></div>
          <div><label className="lbl">Manzil (ixtiyoriy)</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Namangan ko'chasi, 40" style={{ width: '100%' }} /></div>
          <div><label className="lbl">Koordinata (lat, lng)</label><Input value={form.coords} onChange={(e) => setForm({ ...form, coords: e.target.value })} placeholder="41.0694, 71.8237" required style={{ width: '100%' }} /></div>
          <Btn type="submit"><I n="check" size={14} stroke={2.6} /> Qo'shish</Btn>
        </form>
        <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
          Koordinatani olish: Yandex Xaritada joyni o'ng tugma bilan bosing → "Bu yerda nima bor?" → koordinatalarni nusxalang.
        </div>
        {error && <div className="login-err" style={{ marginTop: 10, marginBottom: 0 }}>{String(error)}</div>}
      </Card>
      <Table rows={rows} empty="Hali joy qo'shilmagan" columns={[
        { title: 'Nomi', render: (p) => <b>{p.name}</b> },
        { title: 'Manzil', render: (p) => p.address || <span className="faint">—</span> },
        { title: 'Koordinata', render: (p) => (
          <a href={`https://yandex.uz/maps/?pt=${p.lng},${p.lat}&z=17`} target="_blank" rel="noreferrer">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</a>
        ) },
        { title: '', render: (p) => <Btn kind="red" onClick={() => remove(p.id)}><I n="close" size={14} stroke={2.6} /> O'chirish</Btn> },
      ]} />
    </div>
  );
}
