import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserStore } from '../../store/userStore';
import { useAppStore } from '../../store/appStore';
import { Field, NavBar, Rating } from '../../components/ui';
import { apiError } from '../../utils/formatters';

const MenuItem = ({ icon, title, sub, onClick, badge }) => (
  <div className="list-item clickable" onClick={onClick} style={{ cursor: 'pointer' }}>
    <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{icon}</span>
    <div className="grow"><div className="bold" style={{ fontSize: 14 }}>{title}</div>{sub && <div className="faint">{sub}</div>}</div>
    {badge > 0 && <span className="badge red">{badge}</span>}
    <span className="faint">›</span>
  </div>
);

export default function Profile() {
  const navigate = useNavigate();
  const { user, fetchMe, setUser } = useUserStore();
  const { catalog, loadCatalog, toast, unread } = useAppStore();
  const [form, setForm] = useState({ phone: '', company_name: '', bio: '' });
  const [roles, setRoles] = useState(['client']);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCatalog(); fetchMe(); }, []);
  useEffect(() => {
    if (!user) return;
    setForm({ phone: user.phone || '', company_name: user.company_name || '', bio: user.bio || '' });
    setRoles(user.roles || ['client']);
  }, [user?.id, user?.roles?.join(',')]);

  const toggleRole = (code) => {
    if (code === 'client') return;
    setRoles((r) => (r.includes(code) ? r.filter((x) => x !== code) : [...r, code]));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', { phone: form.phone || null, company_name: form.company_name || null, bio: form.bio || null });
      const { data } = await api.put('/users/me/roles', { roles });
      setUser({ ...user, ...data });
      toast('✅ Profil saqlandi');
    } catch (e) {
      toast('Xatolik', apiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const stats = user?.stats || {};

  return (
    <div className="page">
      <div className="page-header tall" style={{ textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '3px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, margin: '0 auto 10px' }}>
          {user?.first_name?.[0]?.toUpperCase() || '?'}
        </div>
        <h1>{user?.first_name} {user?.last_name || ''}</h1>
        <div className="sub">@{user?.telegram_username || 'telegram'}</div>
      </div>

      <div className="content overlap">
        <div className="grid3 mb12">
          <div className="card" style={{ marginBottom: 0, textAlign: 'center', padding: 12 }}>
            <div className="bold" style={{ color: '#d97706' }}>⭐ {Number(user?.rating || 5).toFixed(1)}</div><div className="faint">Mijoz reytingi</div>
          </div>
          <div className="card" style={{ marginBottom: 0, textAlign: 'center', padding: 12 }}>
            <div className="bold" style={{ color: 'var(--green)' }}>⭐ {Number(user?.provider_rating || 5).toFixed(1)}</div><div className="faint">Ijrochi ({user?.provider_reviews || 0})</div>
          </div>
          <div className="card" style={{ marginBottom: 0, textAlign: 'center', padding: 12 }}>
            <div className="bold" style={{ color: 'var(--primary)' }}>{(stats.requests || 0) + (stats.bookings || 0) + (user?.total_rides || 0)}</div><div className="faint">Buyurtmalar</div>
          </div>
        </div>

        <div className="card">
          <MenuItem icon="🔔" title="Bildirishnomalar" onClick={() => navigate('/notifications')} badge={unread} />
          <MenuItem icon="🚚" title="Transportlarim" sub={`${stats.vehicles || 0} ta, ${stats.approved_vehicles || 0} tasdiqlangan`} onClick={() => navigate('/vehicles')} />
          <MenuItem icon="📅" title="Ish jadvali" sub="Bo'sh vaqtlaringiz" onClick={() => navigate('/schedule')} />
          <MenuItem icon="🧰" title="Ijrochi paneli" onClick={() => navigate('/provider')} />
          <MenuItem icon="⭐" title="Mening sharhlarim" onClick={() => navigate(`/users/${user?.id}`)} />
          <MenuItem icon="🚕" title="Taksi tarixi" onClick={() => navigate('/history')} />
        </div>

        <div className="section-title">Rollarim</div>
        <div className="card">
          <div className="muted mb12">Bitta akkaunt bilan bir nechta rolni bajaring: ish kunida po'puti, dam olishda yuk tashish.</div>
          {(catalog?.roles || []).map((r) => (
            <div key={r.code} className="list-item" onClick={() => toggleRole(r.code)} style={{ cursor: r.code === 'client' ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 20 }}>{r.icon}</span>
              <div className="grow"><div className="bold" style={{ fontSize: 14 }}>{r.name}</div><div className="faint">{r.description}</div></div>
              <input type="checkbox" readOnly checked={roles.includes(r.code)} disabled={r.code === 'client'} style={{ width: 20, height: 20 }} />
            </div>
          ))}
        </div>

        <div className="section-title">Ma'lumotlarim</div>
        <div className="card">
          <Field label="Telefon"><input className="input" value={form.phone} placeholder="+998 90 123 45 67" onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          {roles.includes('company') && (
            <Field label="Kompaniya nomi"><input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
          )}
          <Field label="O'zim haqimda"><textarea className="textarea" value={form.bio} placeholder="Tajriba, xizmatlar..." onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
          <button className="btn block" disabled={saving} onClick={save}>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
        </div>
      </div>
      <NavBar />
    </div>
  );
}
