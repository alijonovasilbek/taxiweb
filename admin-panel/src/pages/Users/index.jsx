import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Pager, Badge, Btn, Select, Input, Drawer, KV, Card, StatusBadge, ROLE, CATEGORY, fmtDate } from '../../components/ui';

function UserDrawer({ id, onClose, onChanged }) {
  const [u, setU] = useState(null);
  const load = () => api.get(`/users/${id}`).then(({ data }) => setU(data));
  useEffect(() => { load(); }, [id]);
  if (!u) return <Drawer title="Foydalanuvchi" onClose={onClose}>Yuklanmoqda...</Drawer>;
  const toggleBlock = async () => {
    if (u.is_blocked) await api.put(`/users/${id}/unblock`);
    else {
      const reason = prompt('Bloklash sababi?');
      if (reason === null) return;
      await api.put(`/users/${id}/block`, { reason });
    }
    load(); onChanged();
  };
  return (
    <Drawer title={`${u.first_name} ${u.last_name || ''}`} onClose={onClose}>
      <Card style={{ marginBottom: 14 }}>
        <KV rows={[
          ['ID', u.id], ['Telegram', u.telegram_username ? `@${u.telegram_username}` : u.telegram_id], ['Telefon', u.phone],
          ['Rollar', (u.roles || []).map((r) => ROLE[r] || r).join(', ')], u.company_name && ['Kompaniya', u.company_name],
          ['Mijoz reytingi', Number(u.rating).toFixed(2)], ['Ijrochi reytingi', `${Number(u.provider_rating).toFixed(2)} (${u.provider_reviews})`],
          ['Ro\'yxatdan o\'tgan', fmtDate(u.created_at)], ['Holat', u.is_blocked ? <Badge color="red">Bloklangan</Badge> : <Badge color="green">Faol</Badge>],
        ]} />
        <Btn kind={u.is_blocked ? 'green' : 'red'} style={{ marginTop: 14 }} onClick={toggleBlock}>{u.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}</Btn>
      </Card>
      <h3 style={{ fontSize: 15 }}>Transportlar ({u.vehicles.length})</h3>
      {u.vehicles.map((v) => (
        <Card key={v.id} style={{ marginBottom: 8, padding: 14, display: 'flex', justifyContent: 'space-between' }}>
          <div><b>{CATEGORY[v.category]}</b> · {v.model} {v.plate_number || ''}</div><StatusBadge status={v.status} />
        </Card>
      ))}
      <h3 style={{ fontSize: 15 }}>Hujjatlar ({u.documents.length})</h3>
      {u.documents.map((d) => (
        <Card key={d.id} style={{ marginBottom: 8, padding: 14, display: 'flex', justifyContent: 'space-between' }}>
          <a href={d.file_url} target="_blank" rel="noreferrer">{d.doc_type}</a><StatusBadge status={d.status} />
        </Card>
      ))}
      <h3 style={{ fontSize: 15 }}>Oxirgi sharhlar</h3>
      {u.reviews.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Sharhlar yo'q</div>}
      {u.reviews.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8, padding: 14 }}>
          <div>{'⭐'.repeat(r.rating)} <span style={{ color: '#64748B', fontSize: 12 }}>{r.service_type} · {fmtDate(r.created_at)}</span></div>
          {r.comment && <div style={{ fontSize: 13, marginTop: 4 }}>{r.comment}</div>}
        </Card>
      ))}
    </Drawer>
  );
}

export default function Users() {
  const [data, setData] = useState({ users: [], total: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState(null);
  const [open, setOpen] = useState(null);

  const load = () => api.get('/users', { params: { page, q: q || undefined, role: role || undefined } }).then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, [page, role]);

  return (
    <div>
      <Header title="Foydalanuvchilar" sub="Bitta akkaunt — bir nechta rol" right={
        <>
          <Input placeholder="Ism, telefon, @username..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} />
          <Select value={role} onChange={(v) => { setRole(v); setPage(1); }} placeholder="Barcha rollar" options={Object.entries(ROLE)} />
          <Btn onClick={() => { setPage(1); load(); }}>Qidirish</Btn>
        </>
      } />
      <Table rows={data.users} onRowClick={(r) => setOpen(r.id)} columns={[
        { title: '#', render: (r) => <span style={{ color: '#94A3B8' }}>{r.id}</span> },
        { title: 'Ism', render: (r) => <b>{r.first_name} {r.last_name || ''}</b> },
        { title: 'Telefon', render: (r) => r.phone || '—' },
        { title: 'Rollar', render: (r) => <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(r.roles || []).map((x) => <Badge key={x} color={x === 'client' ? 'gray' : 'blue'}>{ROLE[x] || x}</Badge>)}</div> },
        { title: 'Transport', render: (r) => r.vehicles_count },
        { title: 'Reyting', render: (r) => `⭐ ${Number(r.provider_rating).toFixed(1)}` },
        { title: 'Holat', render: (r) => (r.is_blocked ? <Badge color="red">Bloklangan</Badge> : <Badge color="green">Faol</Badge>) },
        { title: 'Sana', render: (r) => fmtDate(r.created_at) },
      ]} />
      <Pager page={page} total={data.total} onChange={setPage} />
      {open && <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
