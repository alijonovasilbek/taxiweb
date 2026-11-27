import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import {
  Header, Table, Pager, Badge, Btn, Select, Input, Drawer, KV, Card, StatusBadge, ROLE, CATEGORY, fmtDate, Rating,
  Modal, Field, ErrorBox, errText,
} from '../../components/ui';
import { I } from '../../components/icons';

const DOC_NAME = { passport: 'Pasport', license: 'Haydovchilik guvohnomasi', tech_passport: 'Texpasport', insurance: "Sug'urta", other: 'Boshqa' };
const inp = { width: '100%' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' };

/** Login/parol bir marta ko'rsatiladi — bazada faqat xesh saqlanadi */
function CredentialsNote({ creds, onClose }) {
  const text = `Chortoq Ijrochi ilovasi\nLogin: ${creds.login}\nParol: ${creds.password}`;
  return (
    <Modal title="Login va parol" onClose={onClose} width={420}>
      <Card style={{ padding: 16, background: 'var(--bg)', marginBottom: 12 }}>
        <KV rows={[['Login', <code key="l">{creds.login}</code>], ['Parol', <code key="p">{creds.password}</code>]]} />
      </Card>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        {creds.sent ? '✅ Telegram bot orqali egasiga yuborildi.' : 'Telegram bog\'lanmagan — ijrochiga o\'zingiz yetkazing.'}{' '}
        Parol faqat hozir ko'rinadi.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn kind="ghost" style={{ flex: 1 }} onClick={() => navigator.clipboard?.writeText(text)}>Nusxa olish</Btn>
        <Btn style={{ flex: 1 }} onClick={onClose}>Tayyor</Btn>
      </div>
    </Modal>
  );
}

function UserForm({ user, onClose, onSaved }) {
  const isNew = !user;
  const [f, setF] = useState({
    first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '',
    company_name: user?.company_name || '', bio: user?.bio || '', telegram_id: '', login: '', password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const base = { first_name: f.first_name, last_name: f.last_name || null, phone: f.phone || null, company_name: f.company_name || null, bio: f.bio || null };
    try {
      if (isNew) {
        const { data } = await api.post('/users', {
          ...base, telegram_id: f.telegram_id ? Number(f.telegram_id) : null, login: f.login || null, password: f.password || null,
        });
        onSaved(data);
      } else {
        const { data } = await api.put(`/users/${user.id}`, base);
        onSaved(data);
      }
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title={isNew ? "Ijrochi qo'shish" : 'Ma\'lumotlarni tahrirlash'} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={grid2}>
          <Field label="Ism *"><input className="field" style={inp} value={f.first_name} onChange={set('first_name')} required /></Field>
          <Field label="Familiya"><input className="field" style={inp} value={f.last_name} onChange={set('last_name')} /></Field>
        </div>
        <Field label="Telefon" hint="Admin kiritgan raqam tasdiqlangan hisoblanadi; login ham shu raqam bo'ladi">
          <input className="field" style={inp} placeholder="+998901234567" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Kompaniya"><input className="field" style={inp} value={f.company_name} onChange={set('company_name')} /></Field>
        {isNew && (
          <>
            <Field label="Telegram ID (ixtiyoriy)" hint="Bo'lsa — login/parol bot orqali yuboriladi. Bo'lmasa ijrochi faqat login/parol bilan kiradi.">
              <input className="field" style={inp} type="number" value={f.telegram_id} onChange={set('telegram_id')} />
            </Field>
            <div style={grid2}>
              <Field label="Login" hint="Bo'sh — telefon raqami"><input className="field" style={inp} value={f.login} onChange={set('login')} /></Field>
              <Field label="Parol" hint="Bo'sh — avtomatik"><input className="field" style={inp} value={f.password} onChange={set('password')} /></Field>
            </div>
          </>
        )}
        <ErrorBox error={error} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn type="button" kind="ghost" onClick={onClose} style={{ flex: 1 }}>Bekor qilish</Btn>
          <Btn type="submit" disabled={busy} style={{ flex: 2 }}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function PasswordForm({ user, onClose, onDone }) {
  const [f, setF] = useState({ login: user.login || '', password: '', send: user.has_telegram });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/users/${user.id}/credentials`, { login: f.login || null, password: f.password || null, send: f.send });
      onDone(data);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Login va parol" onClose={onClose} width={420}>
      <form onSubmit={submit}>
        <Field label="Login" hint="Bo'sh — telefon raqami yoki id<raqam>"><input className="field" style={inp} value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} /></Field>
        <Field label="Yangi parol" hint="Bo'sh — tasodifiy 8 belgili parol yaratiladi (kamida 6 belgi)"><input className="field" style={inp} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {user.has_telegram && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={f.send} onChange={(e) => setF({ ...f, send: e.target.checked })} /> Bot orqali egasiga yuborish
          </label>
        )}
        <ErrorBox error={error} />
        <Btn type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</Btn>
      </form>
    </Modal>
  );
}

function VehicleForm({ ownerId, vehicle, onClose, onSaved }) {
  const v = vehicle || {};
  const [f, setF] = useState({
    category: v.category || 'sedan', model: v.model || '', plate_number: v.plate_number || '', color: v.color || '',
    year: v.year || '', seats: v.seats || '', capacity_kg: v.capacity_kg || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (x) => (x === '' || x === null ? null : Number(x));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const body = {
      ...v.price_per_km !== undefined ? { price_per_km: v.price_per_km, price_per_hour: v.price_per_hour, price_per_shift: v.price_per_shift, price_per_day: v.price_per_day, description: v.description, volume_m3: v.volume_m3 } : {},
      category: f.category, model: f.model, plate_number: f.plate_number || null, color: f.color || null,
      year: num(f.year), seats: num(f.seats), capacity_kg: num(f.capacity_kg),
    };
    try {
      if (vehicle) await api.put(`/vehicles/${vehicle.id}`, body);
      else await api.post(`/users/${ownerId}/vehicles`, body);
      onSaved();
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={vehicle ? 'Transportni tahrirlash' : "Transport qo'shish"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Turi *">
          <select className="field" style={inp} value={f.category} onChange={set('category')}>
            {Object.entries(CATEGORY).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </Field>
        <div style={grid2}>
          <Field label="Model *"><input className="field" style={inp} placeholder="Cobalt" value={f.model} onChange={set('model')} required /></Field>
          <Field label="Davlat raqami"><input className="field" style={inp} placeholder="50A123BC" value={f.plate_number} onChange={set('plate_number')} /></Field>
          <Field label="Rangi"><input className="field" style={inp} value={f.color} onChange={set('color')} /></Field>
          <Field label="Yili"><input className="field" style={inp} type="number" value={f.year} onChange={set('year')} /></Field>
          <Field label="O'rinlar"><input className="field" style={inp} type="number" value={f.seats} onChange={set('seats')} /></Field>
          <Field label="Yuk sig'imi (kg)"><input className="field" style={inp} type="number" value={f.capacity_kg} onChange={set('capacity_kg')} /></Field>
        </div>
        <ErrorBox error={error} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn type="button" kind="ghost" onClick={onClose} style={{ flex: 1 }}>Bekor qilish</Btn>
          <Btn type="submit" disabled={busy} style={{ flex: 2 }}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function VehicleCard({ v, onChanged, onEdit, setError }) {
  const fileRef = useRef(null);
  const target = useRef(null);
  const [busy, setBusy] = useState(null);

  const pick = (kind) => { target.current = kind; fileRef.current.value = ''; fileRef.current.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = target.current;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(kind); setError('');
    try {
      if (kind === '__photo') await api.post(`/vehicles/${v.id}/photo`, fd);
      else { fd.append('doc_type', kind); await api.post(`/vehicles/${v.id}/documents`, fd); }
      onChanged();
    } catch (err) { setError(errText(err)); } finally { setBusy(null); }
  };
  const act = async (fn) => { setError(''); try { await fn(); onChanged(); } catch (err) { setError(errText(err)); } };
  const removeDoc = (d) => window.confirm(`${DOC_NAME[d.doc_type] || d.doc_type} o'chirilsinmi?`) && act(() => api.delete(`/documents/${d.id}`));
  const removeVehicle = () => window.confirm(`${v.model} o'chirilsinmi?`) && act(() => api.delete(`/vehicles/${v.id}`));
  const approve = () => act(() => api.put(`/vehicles/${v.id}/approve`));
  const reject = () => {
    const reason = prompt('Rad etish sababi?', "Hujjatlar to'liq emas");
    if (reason !== null) act(() => api.put(`/vehicles/${v.id}/reject`, { reason }));
  };

  return (
    <Card style={{ marginBottom: 10, padding: 14 }}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onFile} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {v.photo_url ? <img src={v.photo_url} alt="" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6 }} /> : <I n="car" size={22} />}
        <div style={{ flex: 1 }}>
          <b>{CATEGORY[v.category] || v.category}</b> · {v.model} {v.plate_number || ''}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{[v.color, v.year, v.seats && `${v.seats} o'rin`, v.capacity_kg && `${v.capacity_kg} kg`].filter(Boolean).join(' · ')}</div>
        </div>
        <StatusBadge status={v.status} />
      </div>
      {v.reject_reason && v.status === 'rejected' && <div style={{ fontSize: 12, color: 'var(--red-ink)', marginTop: 6 }}>Sabab: {v.reject_reason}</div>}

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(v.documents || []).map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <a href={d.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flex: 1 }}>
              <I n="doc" size={13} /> {DOC_NAME[d.doc_type] || d.doc_type}
            </a>
            <StatusBadge status={d.status} />
            <button type="button" className="close-btn" title="O'chirish" onClick={() => removeDoc(d)}><I n="close" size={12} stroke={2.6} /></button>
          </div>
        ))}
        {v.missing_docs?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color="orange">Yetishmaydi</Badge>
            {v.missing_docs.map((m) => (
              <Btn key={m.code} kind="ghost" disabled={!!busy} onClick={() => pick(m.code)} style={{ padding: '5px 10px', fontSize: 12 }}>
                {busy === m.code ? 'Yuklanmoqda…' : `+ ${m.name}`}
              </Btn>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <select className="field" value="" disabled={!!busy} onChange={(e) => e.target.value && pick(e.target.value)} style={{ padding: '5px 8px', fontSize: 12 }}>
          <option value="">{busy && busy !== '__photo' ? 'Yuklanmoqda…' : '+ Hujjat yuklash'}</option>
          {Object.entries(DOC_NAME).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <Btn kind="ghost" disabled={!!busy} onClick={() => pick('__photo')} style={{ padding: '5px 10px', fontSize: 12 }}>{busy === '__photo' ? 'Yuklanmoqda…' : (v.photo_url ? 'Rasmni almashtirish' : '+ Rasm')}</Btn>
        <Btn kind="ghost" onClick={onEdit} style={{ padding: '5px 10px', fontSize: 12 }}>Tahrirlash</Btn>
        {v.status !== 'approved' && <Btn kind="green" disabled={v.missing_docs?.length > 0} onClick={approve} style={{ padding: '5px 10px', fontSize: 12 }}>Tasdiqlash</Btn>}
        {v.status !== 'rejected' && <Btn kind="red" onClick={reject} style={{ padding: '5px 10px', fontSize: 12 }}>Rad</Btn>}
        <Btn kind="red" onClick={removeVehicle} style={{ padding: '5px 10px', fontSize: 12 }}>O'chirish</Btn>
      </div>
    </Card>
  );
}

export function UserDrawer({ id, onClose, onChanged, initialCreds }) {
  const [u, setU] = useState(null);
  const [modal, setModal] = useState(null); // 'edit' | 'password' | 'vehicle' | {vehicle}
  const [creds, setCreds] = useState(initialCreds || null);
  const [error, setError] = useState('');
  const load = () => api.get(`/users/${id}`).then(({ data }) => setU(data)).catch((e) => setError(errText(e)));
  useEffect(() => { load(); }, [id]);
  if (!u) return <Drawer title="Foydalanuvchi" onClose={onClose}><ErrorBox error={error} />{!error && 'Yuklanmoqda...'}</Drawer>;
  const changed = () => { load(); onChanged(); };

  const toggleBlock = async () => {
    if (u.is_blocked) await api.put(`/users/${id}/unblock`);
    else {
      const reason = prompt('Bloklash sababi?');
      if (reason === null) return;
      await api.put(`/users/${id}/block`, { reason });
    }
    changed();
  };
  const remove = async () => {
    if (!window.confirm(`${u.first_name} butunlay o'chirilsinmi? Transportlari va hujjatlari ham o'chadi.`)) return;
    try { await api.delete(`/users/${id}`); onChanged(); onClose(); } catch (err) { setError(errText(err)); }
  };

  return (
    <Drawer title={`${u.first_name} ${u.last_name || ''}`} onClose={onClose}>
      <Card style={{ marginBottom: 14 }}>
        <KV rows={[
          ['ID', u.id], ['Telegram', u.has_telegram ? (u.telegram_username ? `@${u.telegram_username}` : u.telegram_id) : <Badge key="t" color="gray">Bog'lanmagan</Badge>],
          ['Telefon', u.phone ? <span key="p">{u.phone} {u.phone_verified ? '✅' : ''}</span> : null],
          ['Ilova logini', u.login ? <code key="l">{u.login}</code> : null], ['Parol', u.has_password ? `o'rnatilgan (${fmtDate(u.password_set_at)})` : "yo'q"],
          ['Rollar', (u.roles || []).map((r) => ROLE[r] || r).join(', ')], u.company_name && ['Kompaniya', u.company_name],
          ['Mijoz reytingi', Number(u.rating).toFixed(2)], ['Ijrochi reytingi', `${Number(u.provider_rating).toFixed(2)} (${u.provider_reviews})`],
          ['Ro\'yxatdan o\'tgan', fmtDate(u.created_at)], ['Holat', u.is_blocked ? <Badge key="b" color="red">Bloklangan</Badge> : <Badge key="b" color="green">Faol</Badge>],
        ]} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Btn kind="ghost" onClick={() => setModal('edit')}>Tahrirlash</Btn>
          <Btn kind="ghost" onClick={() => setModal('password')}>{u.has_password ? 'Parolni tiklash' : 'Login/parol berish'}</Btn>
          <Btn kind={u.is_blocked ? 'green' : 'red'} onClick={toggleBlock}>{u.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}</Btn>
          <Btn kind="red" onClick={remove}>O'chirish</Btn>
        </div>
      </Card>
      <ErrorBox error={error} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15 }}>Transportlar ({u.vehicles.length})</h3>
        <Btn kind="plain" onClick={() => setModal('vehicle')}>+ Qo'shish</Btn>
      </div>
      {u.vehicles.map((v) => <VehicleCard key={v.id} v={v} onChanged={changed} onEdit={() => setModal({ vehicle: v })} setError={setError} />)}

      <h3 style={{ fontSize: 15 }}>Oxirgi sharhlar</h3>
      {u.reviews.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 13 }}>Sharhlar yo'q</div>}
      {u.reviews.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8, padding: 14 }}>
          <div><span style={{ color: '#ff9f0a', letterSpacing: 1 }}>{'★'.repeat(r.rating)}</span> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.service_type} · {fmtDate(r.created_at)}</span></div>
          {r.comment && <div style={{ fontSize: 13, marginTop: 4 }}>{r.comment}</div>}
        </Card>
      ))}

      {modal === 'edit' && <UserForm user={u} onClose={() => setModal(null)} onSaved={() => { setModal(null); changed(); }} />}
      {modal === 'password' && <PasswordForm user={u} onClose={() => setModal(null)} onDone={(c) => { setModal(null); setCreds(c); changed(); }} />}
      {modal === 'vehicle' && <VehicleForm ownerId={u.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); changed(); }} />}
      {modal?.vehicle && <VehicleForm ownerId={u.id} vehicle={modal.vehicle} onClose={() => setModal(null)} onSaved={() => { setModal(null); changed(); }} />}
      {creds && <CredentialsNote creds={creds} onClose={() => setCreds(null)} />}
    </Drawer>
  );
}

export default function Users() {
  const [data, setData] = useState({ users: [], total: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState(null);
  const [open, setOpen] = useState(null); // {id, creds?}
  const [adding, setAdding] = useState(false);

  const load = () => api.get('/users', { params: { page, q: q || undefined, role: role || undefined } }).then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, [page, role]);

  return (
    <div>
      <Header title="Foydalanuvchilar" sub="Bitta akkaunt — bir nechta rol. Ijrochini qo'shish, tahrirlash, transport va hujjatlari" right={
        <>
          <Input placeholder="Ism, telefon, @username..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} />
          <Select value={role} onChange={(v) => { setRole(v); setPage(1); }} placeholder="Barcha rollar" options={Object.entries(ROLE)} />
          <Btn kind="ghost" onClick={() => { setPage(1); load(); }}>Qidirish</Btn>
          <Btn onClick={() => setAdding(true)}>+ Ijrochi qo'shish</Btn>
        </>
      } />
      <Table rows={data.users} onRowClick={(r) => setOpen({ id: r.id })} columns={[
        { title: '#', render: (r) => <span style={{ color: 'var(--faint)' }}>{r.id}</span> },
        { title: 'Ism', render: (r) => <b>{r.first_name} {r.last_name || ''}</b> },
        { title: 'Telefon', render: (r) => r.phone || '—' },
        { title: 'Login', render: (r) => r.login || '—' },
        { title: 'Rollar', render: (r) => <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(r.roles || []).map((x) => <Badge key={x} color={x === 'client' ? 'gray' : 'blue'}>{ROLE[x] || x}</Badge>)}</div> },
        { title: 'Transport', render: (r) => r.vehicles_count },
        { title: 'Reyting', render: (r) => <Rating value={r.provider_rating} /> },
        { title: 'Holat', render: (r) => (r.is_blocked ? <Badge color="red">Bloklangan</Badge> : <Badge color="green">Faol</Badge>) },
        { title: 'Sana', render: (r) => fmtDate(r.created_at) },
      ]} />
      <Pager page={page} total={data.total} onChange={setPage} />
      {adding && <UserForm onClose={() => setAdding(false)} onSaved={(u) => { setAdding(false); load(); setOpen({ id: u.id, creds: u.credentials }); }} />}
      {open && <UserDrawer key={open.id} id={open.id} initialCreds={open.creds} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
