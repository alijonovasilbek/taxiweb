import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Btn, Select, StatusBadge, Rating } from '../../components/ui';
import { I } from '../../components/icons';

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

  const inp = { width: '100%', marginBottom: 12 };

  return (
    <div className="drawer-back" style={{ justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.22)' }}>
        <div className="drawer-head" style={{ marginBottom: 20 }}>
          <h2>Yangi haydovchi qo'shish</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Yopish"><I n="close" size={15} stroke={2.6} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label className="lbl">Ism *</label>
              <input className="field" style={inp} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
            </div>
            <div>
              <label className="lbl">Familiya *</label>
              <input className="field" style={inp} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
            </div>
          </div>

          <label className="lbl">Telefon *</label>
          <input className="field" style={inp} placeholder="+998901234567" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label className="lbl">Mashina modeli *</label>
              <input className="field" style={inp} placeholder="Nexia 3" value={form.carModel} onChange={(e) => set('carModel', e.target.value)} required />
            </div>
            <div>
              <label className="lbl">Rangi *</label>
              <input className="field" style={inp} placeholder="Oq" value={form.carColor} onChange={(e) => set('carColor', e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label className="lbl">Davlat raqami *</label>
              <input className="field" style={inp} placeholder="01 A 123 BC" value={form.carNumber} onChange={(e) => set('carNumber', e.target.value)} required />
            </div>
            <div>
              <label className="lbl">Yili</label>
              <input className="field" style={inp} type="number" placeholder="2018" value={form.carYear} onChange={(e) => set('carYear', e.target.value)} />
            </div>
          </div>

          <label className="lbl">Telegram ID <span className="faint">(ixtiyoriy)</span></label>
          <input className="field" style={inp} type="number" placeholder="Bo'sh qoldirsangiz avtomatik beriladi" value={form.telegramId} onChange={(e) => set('telegramId', e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label className="lbl">Login *</label>
              <input className="field" style={inp} placeholder="driver01" value={form.driverLogin} onChange={(e) => set('driverLogin', e.target.value)} required />
            </div>
            <div>
              <label className="lbl">Parol *</label>
              <input className="field" style={inp} type="text" placeholder="Kamida 4 belgi" value={form.password} onChange={(e) => set('password', e.target.value)} required />
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--red-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: 'var(--red-ink)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Btn type="button" kind="ghost" onClick={onClose} style={{ flex: 1, padding: 10 }}>Bekor qilish</Btn>
            <Btn type="submit" disabled={loading} style={{ flex: 2, padding: 10 }}>{loading ? 'Saqlanmoqda…' : 'Qo\'shish'}</Btn>
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
  const [tariffs, setTariffs] = useState([]);

  useEffect(() => { api.get('/tariffs').then(({ data }) => setTariffs(data.filter((t) => t.is_active))).catch(() => {}); }, []);

  // Mashina sinfi: buyurtmalar shu tarif va undan past sinfdan keladi (bo'sh — Ekonom)
  const handleTariff = async (driver, tariffId) => {
    setLoading(true);
    await api.put(`/drivers/${driver.id}/tariff`, { tariff_id: tariffId ? Number(tariffId) : null })
      .then(() => load())
      .catch((err) => alert(err.response?.data?.detail || 'Xatolik yuz berdi'));
    setLoading(false);
  };

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

      <Header
        title="Haydovchilar"
        sub="Taksi haydovchilari"
        right={<>
          <Select value={filter === 'all' ? '' : filter} onChange={(v) => setFilter(v || 'all')} placeholder="Barchasi"
            options={[['pending', 'Kutilmoqda'], ['approved', 'Tasdiqlangan'], ['blocked', 'Bloklangan']]} />
          <Btn onClick={() => setShowModal(true)}><I n="users" size={14} /> Haydovchi qo'shish</Btn>
        </>}
      />

      <Table
        rows={drivers}
        empty="Haydovchilar topilmadi"
        columns={[
          { title: 'Ism', render: (d) => <b>{d.first_name} {d.last_name}</b> },
          { title: 'Login', render: (d) => d.driver_login || <span className="faint">—</span> },
          { title: 'Telefon', key: 'phone' },
          { title: 'Mashina', render: (d) => `${d.car_model} (${d.car_color})` },
          { title: 'Raqam', render: (d) => <span className="badge gray" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{d.car_number}</span> },
          { title: 'Tarif', render: (d) => (
            <Select value={d.tariff_id ? String(d.tariff_id) : ''} onChange={(v) => handleTariff(d, v)} placeholder="Ekonom (standart)"
              options={tariffs.map((t) => [String(t.id), t.name])} />
          ) },
          { title: 'Reyting', render: (d) => <Rating value={d.rating} /> },
          { title: 'Holat', render: (d) => <StatusBadge status={d.status} /> },
          { title: 'Amallar', render: (d) => (
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn kind="ghost" onClick={() => handleSetCredentials(d)} disabled={loading}>Login/parol</Btn>
              {d.status === 'pending' && <Btn kind="green" onClick={() => handleApprove(d.id)} disabled={loading}>Tasdiqlash</Btn>}
              {d.status !== 'blocked' && <Btn kind="red" onClick={() => handleBlock(d.id)} disabled={loading}>Bloklash</Btn>}
            </div>
          ) },
        ]}
      />
    </div>
  );
}
