import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Header, Stat, Card, Btn } from '../../components/ui';

// Kategorik palitra (dataviz standart, 1–4 slot, belgilangan tartibda)
const SERIES = [
  { key: 'taxi', label: 'Taksi', color: '#2a78d6' },
  { key: 'carpool', label: 'Po\'puti', color: '#eb6834' },
  { key: 'cargo', label: 'Yuk tashish', color: '#1baf7a' },
  { key: 'equipment', label: 'Spets texnika', color: '#eda100' },
];

function WeekChart({ data }) {
  const [hover, setHover] = useState(null);
  const totals = data.map((d) => SERIES.reduce((s, x) => s + Number(d[x.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const H = 180;
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        {SERIES.map((s) => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 14, height: H + 24, borderBottom: '1px solid #E2E8F0' }}>
        {data.map((d, i) => {
          const day = new Date(d.day);
          return (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{totals[i] || ''}</div>
              <div style={{ width: '100%', maxWidth: 44, display: 'flex', flexDirection: 'column-reverse', gap: totals[i] ? 2 : 0 }}>
                {SERIES.map((s, si) => {
                  const v = Number(d[s.key] || 0);
                  if (!v) return null;
                  const isTop = SERIES.slice(si + 1).every((x) => !Number(d[x.key] || 0));
                  return <div key={s.key} style={{ height: Math.max(3, (v / max) * H), background: s.color, borderRadius: isTop ? '4px 4px 0 0' : 0, opacity: hover === null || hover === i ? 1 : 0.45 }} />;
                })}
              </div>
              {hover === i && (
                <div style={{ position: 'absolute', bottom: H + 10, background: '#0F172A', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12, zIndex: 2, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{day.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })} · {totals[i]} ta</div>
                  {SERIES.map((s) => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />{s.label}: {d[s.key]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        {data.map((d) => (
          <div key={d.day} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#64748B' }}>
            {new Date(d.day).toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [taxi, setTaxi] = useState(null);
  const [ov, setOv] = useState(null);

  const load = () => {
    api.get('/dashboard').then(({ data }) => setTaxi(data)).catch(() => {});
    api.get('/overview').then(({ data }) => setOv(data)).catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0);

  if (!ov) return <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>Yuklanmoqda...</div>;

  return (
    <div>
      <Header title="Dashboard" sub="Chortoq Services — barcha servislar bo'yicha holat" right={<Btn kind="ghost" onClick={load}>↻ Yangilash</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        <Stat icon="👥" label="Foydalanuvchilar" value={fmt(ov.users_total)} sub={`bugun +${ov.users_today}`} />
        <Stat icon="🧰" label="Ijrochilar" value={fmt(ov.providers)} color="#15803D" />
        <Stat icon="🚚" label="Transport / texnika" value={fmt(ov.vehicles_total)} sub={ov.vehicles_pending ? `${ov.vehicles_pending} ta tasdiq kutmoqda` : 'hammasi ko\'rib chiqilgan'} color="#7C3AED" />
        <Stat icon="⭐" label="O'rtacha baho" value={ov.avg_review ? ov.avg_review.toFixed(2) : '—'} color="#B45309" />
      </div>

      {ov.vehicles_pending > 0 && (
        <Card style={{ marginBottom: 18, background: '#FFF7ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><b>{ov.vehicles_pending} ta transport</b> admin tasdiqlashini kutmoqda</div>
          <Btn onClick={() => navigate('/vehicles')}>Ko'rib chiqish</Btn>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>🚕 Taksi</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.9 }}>
            Bugun: <b>{taxi?.today_orders ?? ov.taxi_today}</b> buyurtma<br />
            Onlayn haydovchilar: <b>{taxi?.active_drivers ?? '—'}</b><br />
            Bugungi tushum: <b>{fmt(taxi?.today_revenue)} so'm</b><br />
            Jami: <b>{fmt(ov.taxi_orders)}</b>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>🚐 Po'puti</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.9 }}>
            Faol qatnovlar: <b>{ov.trips_active}</b><br />
            Jami qatnovlar: <b>{fmt(ov.trips_total)}</b><br />
            Bronlar: <b>{fmt(ov.bookings_total)}</b>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>🚚🚜 Yuk va texnika</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.9 }}>
            Ochiq so'rovlar: <b>{ov.requests_open}</b><br />
            Yuk / texnika: <b>{ov.cargo_total}</b> / <b>{ov.equipment_total}</b><br />
            Bajarilgan: <b>{ov.requests_completed}</b> · Takliflar: <b>{ov.offers_total}</b>
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Oxirgi 7 kun — servislar bo'yicha buyurtmalar</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Taksi buyurtmalari, po'puti bronlari, yuk va texnika so'rovlari</div>
        <WeekChart data={ov.by_day} />
      </Card>
    </div>
  );
}
