import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Badge, Header, Table, Pager, Btn, Select, StatusBadge, CATEGORY, fmtMoney, fmtDate } from '../../components/ui';
import { I } from '../../components/icons';
import { UserDrawer } from '../Users';

const DOC_NAME = { passport: 'Pasport', license: 'Guvohnoma', tech_passport: 'Texpasport', insurance: "Sug'urta", other: 'Boshqa' };

export default function Vehicles() {
  const [data, setData] = useState({ vehicles: [], total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [category, setCategory] = useState(null);
  const [owner, setOwner] = useState(null);

  const load = () => api.get('/vehicles', { params: { page, status: status || undefined, category: category || undefined } })
    .then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, [page, status, category]);

  const approve = async (id) => { await api.put(`/vehicles/${id}/approve`); load(); };
  const reject = async (id) => {
    const reason = prompt('Rad etish sababi?', 'Hujjatlar to\'liq emas');
    if (reason === null) return;
    await api.put(`/vehicles/${id}/reject`, { reason });
    load();
  };

  return (
    <div>
      <Header title="Transport va texnika" sub="Ijrochilar qo'shgan transportlarni tekshirish va tasdiqlash" right={
        <>
          <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="Barcha holatlar"
            options={[['pending', 'Kutilmoqda'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan']]} />
          <Select value={category} onChange={(v) => { setCategory(v); setPage(1); }} placeholder="Barcha turlar" options={Object.entries(CATEGORY)} />
        </>
      } />
      <Table rows={data.vehicles} empty="Bu holatda transport yo'q" columns={[
        { title: 'Rasm', render: (v) => (v.photo_url ? <a href={v.photo_url} target="_blank" rel="noreferrer"><img src={v.photo_url} alt="" style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 6 }} /></a> : '—') },
        { title: 'Turi / model', render: (v) => <div><b>{CATEGORY[v.category] || v.category}</b><div style={{ color: 'var(--muted)' }}>{v.model} {v.year || ''} {v.color || ''}</div></div> },
        { title: 'Raqam', render: (v) => v.plate_number || '—' },
        { title: 'Egasi', render: (v) => <div>{v.first_name} {v.last_name || ''}<div style={{ color: 'var(--muted)' }}>{v.phone || (v.telegram_username ? `@${v.telegram_username}` : '')}</div></div> },
        { title: 'Sig\'im', render: (v) => [v.seats && `${v.seats} o'rin`, v.capacity_kg && `${v.capacity_kg} kg`].filter(Boolean).join(', ') || '—' },
        { title: 'Narx', render: (v) => [v.price_per_km && `${fmtMoney(v.price_per_km)}/km`, v.price_per_hour && `${fmtMoney(v.price_per_hour)}/soat`].filter(Boolean).join(' · ') || '—' },
        { title: 'Hujjatlar', render: (v) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(v.documents || []).map((d) => (
              <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <I n="doc" size={13} /> {DOC_NAME[d.doc_type] || d.doc_type}
              </a>
            ))}
            {v.missing_docs?.length > 0 && <Badge color="orange">Yo'q: {v.missing_docs.map((m) => m.name).join(', ')}</Badge>}
          </div>
        ) },
        { title: 'Holat', render: (v) => <div><StatusBadge status={v.status} />{v.reject_reason && <div style={{ fontSize: 11, color: 'var(--red-ink)', marginTop: 4 }}>{v.reject_reason}</div>}</div> },
        { title: 'Sana', render: (v) => fmtDate(v.created_at) },
        { title: '', render: (v) => (
          <div style={{ display: 'flex', gap: 6 }}>
            {v.status !== 'approved' && (
              <Btn kind="green" disabled={v.missing_docs?.length > 0} title={v.missing_docs?.length ? 'Majburiy hujjatlar yuklanmagan' : ''}
                onClick={() => approve(v.id)}><I n="check" size={14} stroke={2.6} /> Tasdiqlash</Btn>
            )}
            {v.status !== 'rejected' && <Btn kind="red" onClick={() => reject(v.id)}><I n="close" size={14} stroke={2.6} /> Rad</Btn>}
            <Btn kind="ghost" title="Tahrirlash, hujjat yuklash, o'chirish" onClick={() => setOwner(v.owner_id)}>Boshqarish</Btn>
          </div>
        ) },
      ]} />
      <Pager page={page} total={data.total} onChange={setPage} />
      {owner && <UserDrawer key={owner} id={owner} onClose={() => setOwner(null)} onChanged={load} />}
    </div>
  );
}
