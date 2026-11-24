import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Pager, Btn, Select, StatusBadge, Drawer, KV, Card, CATEGORY, SERVICE, fmtMoney, fmtDate } from '../../components/ui';

const UNIT = { hour: 'soat', shift: 'smena', day: 'kun' };

function RequestDrawer({ id, onClose, onChanged }) {
  const [r, setR] = useState(null);
  const load = () => api.get(`/requests/${id}`).then(({ data }) => setR(data));
  useEffect(() => { load(); }, [id]);
  if (!r) return <Drawer title="So'rov" onClose={onClose}>Yuklanmoqda...</Drawer>;
  const cancel = async () => {
    const reason = prompt('Bekor qilish sababi?', 'Admin tomonidan bekor qilindi');
    if (reason === null) return;
    await api.put(`/requests/${id}/cancel`, { reason });
    load(); onChanged();
  };
  return (
    <Drawer title={`${SERVICE[r.service_type]} #${r.id}`} onClose={onClose}>
      <Card style={{ marginBottom: 14 }}>
        <KV rows={[
          ['Holat', <StatusBadge status={r.status} />], ['Sarlavha', r.title], ['Transport', CATEGORY[r.vehicle_category] || 'Farqi yo\'q'],
          ['Qayerdan', r.from_address], r.to_address && ['Qayerga', r.to_address], r.distance_km && ['Masofa', `${r.distance_km} km`],
          r.weight_kg && ['Og\'irlik', `${r.weight_kg} kg`], r.work_volume && ['Ish hajmi', r.work_volume],
          r.duration_value && ['Muddat', `${Number(r.duration_value)} ${UNIT[r.duration_unit] || ''}`],
          ['Vaqt', r.scheduled_at ? fmtDate(r.scheduled_at) : 'Darhol'], ['Byudjet', fmtMoney(r.budget)],
          ['Taxminiy narx', fmtMoney(r.estimated_price)], ['Yakuniy narx', fmtMoney(r.final_price)],
          ['Mijoz', `${r.client_name} ${r.client_phone || ''}`], ['Ijrochi', r.provider_name || '—'],
          ['Yaratilgan', fmtDate(r.created_at)], r.cancel_reason && ['Bekor sababi', r.cancel_reason],
        ]} />
        {r.description && <div style={{ fontSize: 13, marginTop: 10, color: '#475569' }}>💬 {r.description}</div>}
        {!['completed', 'cancelled'].includes(r.status) && <Btn kind="red" style={{ marginTop: 14 }} onClick={cancel}>So'rovni bekor qilish</Btn>}
      </Card>
      <h3 style={{ fontSize: 15 }}>Takliflar ({r.offers.length})</h3>
      {r.offers.map((o) => (
        <Card key={o.id} style={{ marginBottom: 8, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><b>{o.first_name}</b> · {CATEGORY[o.category]} {o.model}<div style={{ color: '#64748B', fontSize: 12 }}>{o.phone} · {fmtDate(o.created_at)}</div></div>
            <div style={{ textAlign: 'right' }}><b>{fmtMoney(o.price)}</b><div><StatusBadge status={o.status} /></div></div>
          </div>
          {o.message && <div style={{ fontSize: 13, marginTop: 6 }}>💬 {o.message}</div>}
        </Card>
      ))}
    </Drawer>
  );
}

export default function Requests() {
  const [data, setData] = useState({ requests: [], total: 0 });
  const [page, setPage] = useState(1);
  const [service, setService] = useState(null);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(null);

  const load = () => api.get('/requests', { params: { page, service: service || undefined, status: status || undefined } })
    .then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, [page, service, status]);

  return (
    <div>
      <Header title="Yuk tashish va spets texnika" sub="Mijoz so'rovlari va ijrochilar takliflari" right={
        <>
          <Select value={service} onChange={(v) => { setService(v); setPage(1); }} placeholder="Barcha servislar" options={[['cargo', 'Yuk tashish'], ['equipment', 'Spets texnika']]} />
          <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="Barcha holatlar"
            options={[['open', 'Ochiq'], ['assigned', 'Tayinlangan'], ['in_progress', 'Bajarilmoqda'], ['completed', 'Yakunlangan'], ['cancelled', 'Bekor']]} />
        </>
      } />
      <Table rows={data.requests} onRowClick={(r) => setOpen(r.id)} columns={[
        { title: '#', render: (r) => <span style={{ color: '#94A3B8' }}>{r.id}</span> },
        { title: 'Servis', render: (r) => SERVICE[r.service_type] },
        { title: 'So\'rov', render: (r) => <div><b>{r.title || CATEGORY[r.vehicle_category] || '—'}</b><div style={{ color: '#64748B', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.from_address}{r.to_address ? ` → ${r.to_address}` : ''}</div></div> },
        { title: 'Mijoz', render: (r) => <div>{r.client_name}<div style={{ color: '#64748B' }}>{r.client_phone || ''}</div></div> },
        { title: 'Takliflar', render: (r) => r.offers_count },
        { title: 'Ijrochi', render: (r) => r.provider_name || '—' },
        { title: 'Narx', render: (r) => fmtMoney(r.final_price || r.budget || r.estimated_price) },
        { title: 'Holat', render: (r) => <StatusBadge status={r.status} /> },
        { title: 'Sana', render: (r) => fmtDate(r.created_at) },
      ]} />
      <Pager page={page} total={data.total} onChange={setPage} />
      {open && <RequestDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
