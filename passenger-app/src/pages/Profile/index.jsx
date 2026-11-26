import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserStore } from '../../store/userStore';
import { useAppStore } from '../../store/appStore';
import { Field, NavBar, Toggle, ModeSwitch } from '../../components/ui';
import { I, ServiceIcon } from '../../components/icons';
import { apiError } from '../../utils/formatters';
import { usePhoneShare } from '../../hooks/usePhoneShare';

const SQ = {
  bell: '#ff3b30', truck: '#8c1c3a', calendar: '#ff9500', provider: '#c98a1f', star: '#ffcc00', taxi: '#34c759',
  user: '#8e8e93', users: '#34c759', parcel: '#8c1c3a', tractor: '#ff9500', sparkles: '#c98a1f',
};
const HOME_WIDGETS = [
  { code: 'taxi', name: 'Taksi' },
  { code: 'carpool', name: "Po'puti" },
  { code: 'cargo', name: 'Yuk tashish' },
  { code: 'equipment', name: 'Maxsus texnika' },
];
const ROLE_ICON = { client: 'user', driver: 'users', cargo: 'truck', equipment_owner: 'tractor', company: 'sparkles' };

function Square({ n }) {
  return (
    <span className="app-icon" style={{ width: 30, height: 30, borderRadius: 7, background: SQ[n] || '#8e8e93' }}>
      <I n={n} size={17} color="#fff" />
    </span>
  );
}

const MenuItem = ({ icon, title, sub, onClick, badge }) => (
  <button className="group-item" onClick={onClick}>
    <Square n={icon} />
    <div className="body">
      <div className="grow">
        <div>{title}</div>
        {sub && <div className="faint">{sub}</div>}
      </div>
      {badge > 0 && <span className="badge red" style={{ background: 'var(--red)', color: '#fff', borderRadius: 10 }}>{badge}</span>}
      <I n="next" size={18} className="chev" />
    </div>
  </button>
);

export default function Profile() {
  const navigate = useNavigate();
  const { user, fetchMe, setUser } = useUserStore();
  const { catalog, loadCatalog, toast, unread } = useAppStore();
  const [form, setForm] = useState({ company_name: '', bio: '' });
  const [roles, setRoles] = useState(['client']);
  const [saving, setSaving] = useState(false);
  const phoneShare = usePhoneShare();

  useEffect(() => { loadCatalog(); fetchMe(); }, []);
  useEffect(() => {
    if (!user) return;
    setForm({ company_name: user.company_name || '', bio: user.bio || '' });
    setRoles(user.roles || ['client']);
  }, [user?.id, user?.roles?.join(',')]);

  const eligible = user?.eligible_roles || ['client'];
  const toggleRole = (code) => {
    if (code === 'client' || !eligible.includes(code)) return;
    setRoles((r) => (r.includes(code) ? r.filter((x) => x !== code) : [...r, code]));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', { company_name: form.company_name || null, bio: form.bio || null });
      const { data } = await api.put('/users/me/roles', { roles });
      setUser({ ...user, ...data });
      toast('Profil saqlandi');
    } catch (e) {
      toast('Xatolik', apiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Asosiy sahifa vidjetlari: yoqish/o'chirish darhol saqlanadi (server'da — barcha qurilmalarda bir xil)
  const hidden = user?.preferences?.home_hidden || [];
  const toggleWidget = async (code, visible) => {
    const next = visible ? hidden.filter((c) => c !== code) : [...hidden, code];
    const prev = user.preferences || {};
    setUser({ ...user, preferences: { ...prev, home_hidden: next } });
    try {
      const { data } = await api.put('/users/me/preferences', { home_hidden: next });
      setUser({ ...useUserStore.getState().user, preferences: data });
    } catch (e) {
      setUser({ ...useUserStore.getState().user, preferences: prev });
      toast('Saqlanmadi', apiError(e), 'error');
    }
  };

  const stats = user?.stats || {};
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div className="page">
      <div className="hero profile">
        <div className="eyebrow">Profil</div>
        <div className="avatar-xl">{initials}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{user?.first_name} {user?.last_name || ''}</div>
        <div style={{ fontSize: 15, opacity: .75 }}>
          {user?.phone || `@${user?.telegram_username || 'telegram'}`}
        </div>
      </div>

      <div className="content lift">
        <ModeSwitch />
        <div className="stat-pills mb12">
          <div className="stat-pill">
            <div className="v"><I n="star" size={16} className="star-ico" />{Number(user?.rating || 5).toFixed(1)}</div>
            <div className="l">Mijoz reytingi</div>
          </div>
          <div className="stat-pill">
            <div className="v"><I n="star" size={16} className="star-ico" />{Number(user?.provider_rating || 5).toFixed(1)}</div>
            <div className="l">Ijrochi ({user?.provider_reviews || 0})</div>
          </div>
          <div className="stat-pill">
            <div className="v" style={{ color: 'var(--primary)' }}>{(stats.requests || 0) + (stats.bookings || 0) + (user?.total_rides || 0)}</div>
            <div className="l">Buyurtmalar</div>
          </div>
        </div>

        <div className="group">
          <MenuItem icon="bell" title="Bildirishnomalar" onClick={() => navigate('/notifications')} badge={unread} />
        </div>
        <div className="group">
          <MenuItem icon="truck" title="Transportlarim" sub={`${stats.vehicles || 0} ta, ${stats.approved_vehicles || 0} tasdiqlangan`} onClick={() => navigate('/vehicles')} />
          <MenuItem icon="calendar" title="Ish jadvali" sub="Bo'sh vaqtlaringiz" onClick={() => navigate('/schedule')} />
          <MenuItem icon="provider" title="Ijrochi paneli" onClick={() => navigate('/provider')} />
        </div>
        <div className="group">
          <MenuItem icon="star" title="Mening sharhlarim" onClick={() => navigate(`/users/${user?.id}`)} />
          <MenuItem icon="taxi" title="Taksi tarixi" onClick={() => navigate('/history')} />
        </div>

        <div className="section-title">Asosiy sahifa vidjetlari</div>
        <div className="group">
          {HOME_WIDGETS.map((w) => (
            <div key={w.code} className="group-item" style={{ cursor: 'default' }}>
              <ServiceIcon code={w.code} size={30} />
              <div className="body">
                <div className="grow">
                  <div>{w.name}</div>
                  <div className="faint">{hidden.includes(w.code) ? 'Yashirilgan' : "Ko'rinadi"}</div>
                </div>
                <Toggle on={!hidden.includes(w.code)} onChange={(v) => toggleWidget(w.code, v)} />
              </div>
            </div>
          ))}
        </div>
        <div className="hint" style={{ margin: '-4px 16px 0' }}>Kerak bo'lmagan xizmatlarni asosiy sahifadan yashiring. Ular Qidiruv orqali baribir ochiladi.</div>

        <div className="section-title">Rollarim</div>
        <div className="group">
          {(catalog?.roles || []).map((r) => (
            <div key={r.code} className="group-item" style={{ cursor: eligible.includes(r.code) ? 'default' : 'pointer' }}
              onClick={() => { if (!eligible.includes(r.code)) navigate(r.code === 'company' ? '/profile' : '/vehicles/new'); }}>
              <Square n={ROLE_ICON[r.code] || 'user'} />
              <div className="body">
                <div className="grow">
                  <div>{r.name}</div>
                  <div className="faint">
                    {eligible.includes(r.code) ? r.description
                      : r.code === 'company' ? 'Admin tomonidan beriladi' : "Tasdiqlangan transport kerak — qo'shish"}
                  </div>
                </div>
                {eligible.includes(r.code)
                  ? <Toggle on={roles.includes(r.code)} disabled={r.code === 'client'} onChange={() => toggleRole(r.code)} />
                  : (r.code !== 'company' && <I n="next" size={18} className="chev" />)}
              </div>
            </div>
          ))}
        </div>
        <div className="hint" style={{ margin: '-4px 16px 0' }}>Rollar admin tasdiqlagan transportingizdan avtomatik beriladi. Vaqtincha ijrochi bo'lmasangiz, rolni o'chirib qo'yishingiz mumkin.</div>

        <div className="section-title">Ma'lumotlarim</div>
        <div className="card">
          <Field label="Telefon">
            <div className="row" style={{ gap: 8 }}>
              <div className="input grow row" style={{ gap: 6, background: 'var(--fill)' }}>
                {user?.phone || '—'}
                {user?.phone_verified && <I n="check" size={15} color="var(--green)" stroke={3} />}
              </div>
              {phoneShare.canShare && (
                <button className="btn secondary" style={{ width: 'auto', padding: '0 14px' }} disabled={phoneShare.busy}
                  onClick={async () => { if (await phoneShare.share()) toast('Raqam yangilandi'); }}>
                  Yangilash
                </button>
              )}
            </div>
            {phoneShare.error && <div className="hint" style={{ color: 'var(--red)' }}>{phoneShare.error}</div>}
          </Field>
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
