import React, { useState } from 'react';
import api from '../../services/api';
import { useDriverStore } from '../../store/driverStore';

const STEPS = ['Shaxsiy ma\'lumotlar', 'Mashina ma\'lumotlari', 'Hujjatlar'];

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 15, marginBottom: 12,
  color: '#1E293B', outline: 'none', boxSizing: 'border-box',
};

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
        firstName: form.firstName, lastName: form.lastName, phone: form.phone,
        carModel: form.carModel, carColor: form.carColor, carNumber: form.carNumber,
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center', background: '#F1F5F9' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 16 }}>⏳</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>Ariza yuborildi!</div>
      <div style={{ fontSize: 14, color: '#64748B', maxWidth: 280 }}>Administrator ma'lumotlaringizni tekshiradi. 24 soat ichida xabar beramiz.</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '24px 20px 60px', borderRadius: '0 0 28px 28px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚗</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Haydovchi ro'yxati</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>Qadam {step + 1} / {STEPS.length}</div>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= step ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -28 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', marginBottom: 16 }}>{STEPS[step]}</div>

          {step === 0 && (
            <>
              <input style={inputStyle} placeholder="Ism *" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              <input style={inputStyle} placeholder="Familiya *" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              <input style={inputStyle} placeholder="Telefon *" value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" />
              <button
                disabled={!form.firstName || !form.lastName || !form.phone}
                onClick={() => setStep(1)}
                style={{ width: '100%', padding: 14, fontSize: 16, fontWeight: 600, background: form.firstName && form.lastName && form.phone ? '#2563EB' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
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
                <button onClick={() => setStep(0)} style={{ flex: 1, padding: 14, fontSize: 15, background: '#F1F5F9', border: 'none', borderRadius: 12, cursor: 'pointer', color: '#64748B', fontWeight: 500 }}>← Orqaga</button>
                <button disabled={!form.carModel || !form.carColor || !form.carNumber} onClick={() => setStep(2)}
                  style={{ flex: 2, padding: 14, fontSize: 15, fontWeight: 600, background: form.carModel && form.carColor && form.carNumber ? '#2563EB' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                  Keyingi →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, color: '#64748B', display: 'block', marginBottom: 8, fontWeight: 500 }}>Haydovchilik guvohnomasi rasmi</label>
                <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: files.license ? '#F0FDF4' : '#F8FAFC' }}>
                  <input type="file" accept="image/*" onChange={(e) => setFiles((f) => ({ ...f, license: e.target.files[0] }))} style={{ display: 'none' }} id="license-upload" />
                  <label htmlFor="license-upload" style={{ cursor: 'pointer', fontSize: 14, color: files.license ? '#16A34A' : '#94A3B8' }}>
                    {files.license ? `✓ ${files.license.name}` : '📷 Rasm tanlang'}
                  </label>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 14, color: '#64748B', display: 'block', marginBottom: 8, fontWeight: 500 }}>Mashina texnik pasporti rasmi</label>
                <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: files.carDoc ? '#F0FDF4' : '#F8FAFC' }}>
                  <input type="file" accept="image/*" onChange={(e) => setFiles((f) => ({ ...f, carDoc: e.target.files[0] }))} style={{ display: 'none' }} id="cardoc-upload" />
                  <label htmlFor="cardoc-upload" style={{ cursor: 'pointer', fontSize: 14, color: files.carDoc ? '#16A34A' : '#94A3B8' }}>
                    {files.carDoc ? `✓ ${files.carDoc.name}` : '📷 Rasm tanlang'}
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: 14, fontSize: 15, background: '#F1F5F9', border: 'none', borderRadius: 12, cursor: 'pointer', color: '#64748B', fontWeight: 500 }}>← Orqaga</button>
                <button disabled={loading} onClick={handleSubmit}
                  style={{ flex: 2, padding: 14, fontSize: 15, fontWeight: 600, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
                  {loading ? 'Yuborilmoqda...' : 'Yuborish ✓'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
