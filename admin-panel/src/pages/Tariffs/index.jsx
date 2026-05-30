import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Tariffs() {
  const [tariffs, setTariffs] = useState([]);
  const [form, setForm] = useState({ baseFare: '', perKmPrice: '', perMinPrice: '0', minFare: '', nightMultiplier: '1.5' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/tariffs').then(({ data }) => {
      setTariffs(data);
      if (data.length) {
        const t = data[0];
        setForm({ baseFare: t.base_fare, perKmPrice: t.per_km_price, perMinPrice: t.per_min_price, minFare: t.min_fare, nightMultiplier: t.night_multiplier });
      }
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    await api.put('/tariffs', {
      baseFare: parseFloat(form.baseFare),
      perKmPrice: parseFloat(form.perKmPrice),
      perMinPrice: parseFloat(form.perMinPrice),
      minFare: parseFloat(form.minFare),
      nightMultiplier: parseFloat(form.nightMultiplier),
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 };

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Tarif boshqaruvi</h1>

      <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 500, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        {[
          { key: 'baseFare', label: 'Boshlang\'ich narx (so\'m)' },
          { key: 'perKmPrice', label: 'Har km uchun (so\'m)' },
          { key: 'perMinPrice', label: 'Har minut uchun (so\'m)' },
          { key: 'minFare', label: 'Minimal narx (so\'m)' },
          { key: 'nightMultiplier', label: 'Kechasi koeffitsient (masalan 1.5)' },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>{label}</label>
            <input type="number" value={form[key]} onChange={(e) => set(key, e.target.value)} style={inputStyle} />
          </div>
        ))}

        <div style={{ background: '#f0f7ff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#555' }}>
          <b>Misol:</b> 5 km, 10 min sayohat uchun:<br />
          {form.baseFare || 0} + {form.perKmPrice || 0}×5 + {form.perMinPrice || 0}×10 = {' '}
          <b>{Number(form.baseFare || 0) + Number(form.perKmPrice || 0) * 5 + Number(form.perMinPrice || 0) * 10} so'm</b>
        </div>

        <button onClick={handleSave} style={{ width: '100%', padding: 13, fontSize: 16, fontWeight: 600, background: '#1976D2', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          {saved ? '✅ Saqlandi!' : 'Saqlash'}
        </button>
      </div>
    </div>
  );
}
