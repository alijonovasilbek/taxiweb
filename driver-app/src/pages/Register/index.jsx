import React, { useState } from 'react';
import api from '../../services/api';
import { useDriverStore } from '../../store/driverStore';

const STEPS = ['Shaxsiy ma\'lumotlar', 'Mashina ma\'lumotlari', 'Hujjatlar'];

export default function Register() {
  const { fetchMe } = useDriverStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
    carModel: '', carColor: '', carNumber: '', carYear: '',
  });
  const [files, setFiles] = useState({ license: null, carDoc: null });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/drivers/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        carModel: form.carModel,
        carColor: form.carColor,
        carNumber: form.carNumber,
        carYear: parseInt(form.carYear) || null,
      });

      if (files.license || files.carDoc) {
        const fd = new FormData();
        if (files.license) fd.append('license', files.license);
        if (files.carDoc) fd.append('carDoc', files.carDoc);
        await api.post('/drivers/me/documents', fd);
      }

      setSubmitted(true);
      fetchMe();
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 60 }}>⏳</div>
      <h2 style={{ marginTop: 16 }}>Ariza yuborildi!</h2>
      <p style={{ color: '#888', marginTop: 8 }}>Administrator ma'lumotlaringizni tekshiradi. 24 soat ichida xabar beramiz.</p>
    </div>
  );

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #ddd', fontSize: 15, marginBottom: 12,
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 6 }}>Haydovchi ro'yxati</h2>
      <p style={{ color: '#888', marginBottom: 20 }}>Qadam {step + 1} / {STEPS.length}: {STEPS[step]}</p>

      {step === 0 && (
        <>
          <input style={inputStyle} placeholder="Ism *" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <input style={inputStyle} placeholder="Familiya *" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          <input style={inputStyle} placeholder="Telefon *" value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" />
          <button
            disabled={!form.firstName || !form.lastName || !form.phone}
            onClick={() => setStep(1)}
            style={{ width: '100%', padding: 14, fontSize: 16, fontWeight: 600, background: '#2196F3', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
            Keyingi →
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <input style={inputStyle} placeholder="Mashina modeli (masalan, Nexia 3) *" value={form.carModel} onChange={(e) => set('carModel', e.target.value)} />
          <input style={inputStyle} placeholder="Rangi (masalan, oq) *" value={form.carColor} onChange={(e) => set('carColor', e.target.value)} />
          <input style={inputStyle} placeholder="Davlat raqami (masalan, 01 A 123 BC) *" value={form.carNumber} onChange={(e) => set('carNumber', e.target.value)} />
          <input style={inputStyle} placeholder="Yili (masalan, 2018)" value={form.carYear} onChange={(e) => set('carYear', e.target.value)} type="number" />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(0)} style={{ flex: 1, padding: 14, fontSize: 15, background: '#f5f5f5', border: 'none', borderRadius: 12, cursor: 'pointer' }}>← Orqaga</button>
            <button disabled={!form.carModel || !form.carColor || !form.carNumber} onClick={() => setStep(2)}
              style={{ flex: 2, padding: 14, fontSize: 15, fontWeight: 600, background: '#2196F3', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
              Keyingi →
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 14, color: '#555', display: 'block', marginBottom: 6 }}>Haydovchilik guvohnomasi rasmi</label>
            <input type="file" accept="image/*" onChange={(e) => setFiles((f) => ({ ...f, license: e.target.files[0] }))} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, color: '#555', display: 'block', marginBottom: 6 }}>Mashina texnik pasporti rasmi</label>
            <input type="file" accept="image/*" onChange={(e) => setFiles((f) => ({ ...f, carDoc: e.target.files[0] }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: 14, fontSize: 15, background: '#f5f5f5', border: 'none', borderRadius: 12, cursor: 'pointer' }}>← Orqaga</button>
            <button disabled={loading} onClick={handleSubmit}
              style={{ flex: 2, padding: 14, fontSize: 15, fontWeight: 600, background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
              {loading ? 'Yuborilmoqda...' : 'Yuborish ✓'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
