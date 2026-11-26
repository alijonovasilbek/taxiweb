import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Pager, Btn, Select, StatusBadge, fmtMoney, fmtDate } from '../../components/ui';
import { I } from '../../components/icons';

const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

export default function Carpool() {
  const [data, setData] = useState({ trips: [], total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(null);

  const load = () => api.get('/carpool/trips', { params: { page, status: status || undefined } }).then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, [page, status]);

  const cancel = async (id) => {
    if (!confirm('Qatnovni bekor qilasizmi? Barcha bronlar bekor bo\'ladi.')) return;
    await api.put(`/carpool/trips/${id}/cancel`);
    load();
  };

  return (
    <div>
      <Header title="Po'puti qatnovlari" sub="Haydovchilar e'lon qilgan doimiy va bir martalik qatnovlar" right={
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="Barcha holatlar"
          options={[['active', 'Faol'], ['full', 'To\'lgan'], ['departed', 'Yo\'lda'], ['completed', 'Yakunlangan'], ['cancelled', 'Bekor']]} />
      } />
      <Table rows={data.trips} columns={[
        { title: '#', render: (t) => <span style={{ color: 'var(--faint)' }}>{t.id}</span> },
        { title: 'Yo\'nalish', render: (t) => <div><b>{t.from_address}</b><div style={{ color: 'var(--muted)' }}>→ {t.to_address}</div></div> },
        { title: 'Jo\'nash', render: (t) => <div>{fmtDate(t.departure_at)}{t.recurring_days?.length > 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}><I n="repeat" size={12} /> {t.recurring_days.map((d) => DAYS[d]).join(',')}</div>}</div> },
        { title: 'Haydovchi', render: (t) => <div>{t.driver_name}<div style={{ color: 'var(--muted)' }}>{t.driver_phone || ''}</div></div> },
        { title: 'O\'rinlar', render: (t) => `${t.seats_available} / ${t.seats_total}` },
        { title: 'Narx', render: (t) => fmtMoney(t.price_per_seat) },
        { title: 'Bronlar', render: (t) => t.bookings_count },
        { title: 'Holat', render: (t) => <StatusBadge status={t.status} /> },
        { title: '', render: (t) => (['active', 'full'].includes(t.status) ? <Btn kind="red" onClick={() => cancel(t.id)}>Bekor qilish</Btn> : null) },
      ]} />
      <Pager page={page} total={data.total} onChange={setPage} />
    </div>
  );
}
