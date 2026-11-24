import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Page, Spinner, Empty } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { formatDate, formatPrice, WEEKDAYS_SHORT } from '../../utils/formatters';

const SERVICE = { carpool: 'Po\'puti', cargo: 'Yuk tashish', equipment: 'Spets texnika' };

export default function PublicProfile() {
  const { userId } = useParams();
  const { category, catalog, loadCatalog } = useAppStore();
  const [p, setP] = useState(null);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    loadCatalog();
    api.get(`/users/${userId}/public`).then(({ data }) => setP(data)).catch(() => setP(false));
    api.get(`/schedules/user/${userId}`).then(({ data }) => setSchedule(data)).catch(() => {});
  }, [userId]);

  if (p === null) return <Page title="Profil"><Spinner /></Page>;
  if (p === false) return <Page title="Profil"><Empty icon="🤷" title="Foydalanuvchi topilmadi" /></Page>;

  const roleNames = (p.roles || []).map((r) => catalog?.roles?.find((x) => x.code === r)).filter(Boolean);

  return (
    <Page title={`${p.first_name} ${p.last_name || ''}`} sub={p.company_name || `A'zo: ${formatDate(p.created_at)}`}>
      <div className="grid2 mb12">
        <div className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="bold" style={{ fontSize: 22, color: 'var(--green)' }}>⭐ {Number(p.provider_rating || 5).toFixed(1)}</div>
          <div className="faint">Ijrochi · {p.provider_reviews || 0} sharh</div>
        </div>
        <div className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="bold" style={{ fontSize: 22, color: '#d97706' }}>⭐ {Number(p.rating || 5).toFixed(1)}</div>
          <div className="faint">Mijoz sifatida</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {roleNames.map((r) => <span key={r.code} className="badge blue">{r.icon} {r.name}</span>)}
        </div>
        {p.bio && <div className="muted mt12">{p.bio}</div>}
      </div>

      {p.vehicles?.length > 0 && <div className="section-title">Transport va texnika</div>}
      {p.vehicles?.map((v) => {
        const c = category(v.category);
        return (
          <div key={v.id} className="card row">
            {v.photo_url ? <img className="photo" src={v.photo_url} alt="" /> : <div className="icon-box" style={{ background: 'var(--primary-soft)' }}>{c?.icon}</div>}
            <div className="grow">
              <div className="bold">{c?.name} · {v.model}</div>
              <div className="faint">{[v.year, v.color, v.seats && `${v.seats} o'rin`, v.capacity_kg && `${v.capacity_kg} kg`].filter(Boolean).join(' · ')}</div>
              <div className="row mt8" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className={`badge ${v.is_available ? 'green' : 'gray'}`}>{v.is_available ? 'Bo\'sh' : 'Band'}</span>
                {v.price_per_hour && <span className="badge yellow">{formatPrice(v.price_per_hour)}/soat</span>}
                {v.price_per_km && <span className="badge yellow">{formatPrice(v.price_per_km)}/km</span>}
              </div>
            </div>
          </div>
        );
      })}

      {schedule.length > 0 && (
        <>
          <div className="section-title">Ish jadvali</div>
          <div className="card">
            {schedule.map((s) => <div key={s.id} className="between" style={{ padding: '4px 0' }}><span className="muted">{WEEKDAYS_SHORT[s.weekday]}</span><span className="bold">{s.start_time} – {s.end_time}</span></div>)}
          </div>
        </>
      )}

      <div className="section-title">Sharhlar</div>
      {p.reviews?.length === 0 && <div className="card faint">Hali sharhlar yo'q</div>}
      {p.reviews?.map((r, i) => (
        <div key={i} className="card">
          <div className="between"><span className="bold">{r.rater_name}</span><span>{'⭐'.repeat(r.rating)}</span></div>
          <div className="faint">{SERVICE[r.service_type] || r.service_type} · {formatDate(r.created_at)}</div>
          {r.comment && <div className="muted mt8">{r.comment}</div>}
        </div>
      ))}
    </Page>
  );
}
