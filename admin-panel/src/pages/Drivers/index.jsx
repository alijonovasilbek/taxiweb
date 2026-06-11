import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_COLOR = { approved: '#4CAF50', pending: '#FF9800', blocked: '#f44336', rejected: '#9E9E9E' };
const STATUS_LABEL = { approved: 'Tasdiqlangan', pending: 'Kutilmoqda', blocked: 'Bloklangan', rejected: 'Rad etilgan' };

const EMPTY_FORM = { firstName: '', lastName: '', phone: '', carModel: '', carColor: '', carNumber: '', carYear: '', telegramId: '', driverLogin: '', password: '' };

function AddDriverModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/drivers', {
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        car_model: form.carModel,
        car_color: form.carColor,
        car_number: form.carNumber,
        car_year: form.carYear ? parseInt(form.carYear) : null,
        telegram_id: form.telegramId ? parseInt(form.telegramId) : null,
        driver_login: form.driverLogin,
        password: form.password,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box', marginBottom: 12,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Yangi haydovchi qo'shish</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Ism *</label>
              <input style={inp} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Familiya *</label>
              <input style={inp} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
            </div>
          </div>

          <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Telefon *</label>
          <input style={inp} placeholder="+998901234567" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Mashina modeli *</label>
              <input style={inp} placeholder="Nexia 3" value={form.carModel} onChange={(e) => set('carModel', e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Rangi *</label>
              <input style={inp} placeholder="Oq" value={form.carColor} onChange={(e) => set('carColor', e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Davlat raqami *</label>
              <input style={inp} placeholder="01 A 123 BC" value={form.carNumber} onChange={(e) => set('carNumber', e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Yili</label>
              <input style={inp} type="number" placeholder="2018" value={form.carYear} onChange={(e) => set('carYear', e.target.value)} />
            </div>
          </div>

          <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Telegram ID <span style={{ color: '#94a3b8' }}>(ixtiyoriy)</span></label>
          <input style={inp} type="number" placeholder="Bo'sh qoldirsangiz avtomatik beriladi" value={form.telegramId} onChange={(e) => set('telegramId', e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Login *</label>
              <input style={inp} placeholder="driver01" value={form.driverLogin} onChange={(e) => set('driverLogin', e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Parol *</label>
              <input style={inp} type="text" placeholder="Kamida 4 belgi" value={form.password} onChange={(e) => set('password', e.target.value)} required />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
              Bekor qilish
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: 11, borderRadius: 8, border: 'none', background: loading ? '#93c5fd' : '#2563EB', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              {loading ? 'Saqlanmoqda...' : 'Qo\'shish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    const params = filter !== 'all' ? { status: filter } : {};
    api.get('/drivers', { params }).then(({ data }) => setDrivers(data.drivers || [])).catch(() => {});
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (id) => {
    setLoading(true);
    await api.put(`/drivers/${id}/approve`).catch(() => {});
    load();
    setLoading(false);
  };

  const handleBlock = async (id) => {
    const reason = prompt('Bloklash sababi:');
    if (!reason) return;
    setLoading(true);
    await api.put(`/drivers/${id}/block`, { reason }).catch(() => {});
    load();
    setLoading(false);
  };

  const handleSetCredentials = async (driver) => {
    const driverLogin = prompt('Login kiriting:', driver.driver_login || '');
    if (!driverLogin) return;
    const password = prompt('Parol kiriting:');
    if (!password) return;
    setLoading(true);
    await api.put(`/drivers/${driver.id}/credentials`, { driver_login: driverLogin, password })
      .then(() => load())
      .catch((err) => alert(err.response?.data?.detail || 'Xatolik yuz berdi'));
    setLoading(false);
  };

  return (
    <div>
      {showModal && <AddDriverModal onClose={() => setShowModal(false)} onSaved={load} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Haydovchilar</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}>
            <option value="all">Barchasi</option>
            <option value="pending">Kutilmoqda</option>
            <option value="approved">Tasdiqlangan</option>
            <option value="blocked">Bloklangan</option>
          </select>
          <button onClick={() => setShowModal(true)} style={{
            padding: '8px 18px', background: '#2563EB', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            + Haydovchi qo'shish
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Ism', 'Login', 'Telefon', 'Mashina', 'Raqam', 'Reyting', 'Holat', 'Amallar'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{d.first_name} {d.last_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{d.driver_login || '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{d.phone}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{d.car_model} ({d.car_color})</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{d.car_number}</td>
                <td style={{ padding: '12px 16px' }}>⭐ {d.rating}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: STATUS_COLOR[d.status] + '20', color: STATUS_COLOR[d.status], padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSetCredentials(d)} disabled={loading}
                      style={{ padding: '5px 10px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                      Login/parol
                    </button>
                    {d.status === 'pending' && (
                      <button onClick={() => handleApprove(d.id)} disabled={loading}
                        style={{ padding: '5px 10px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Tasdiqlash
                      </button>
                    )}
                    {d.status !== 'blocked' && (
                      <button onClick={() => handleBlock(d.id)} disabled={loading}
                        style={{ padding: '5px 10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Bloklash
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Haydovchilar topilmadi</div>}
      </div>
    </div>
  );
}
