import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Card, Btn } from '../../components/ui';
import { I } from '../../components/icons';

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

  return (
    <div>
      <Header title="Tarif boshqaruvi" sub="Taksi narxini hisoblash qoidalari" />

      <Card style={{ maxWidth: 520, padding: 24 }}>
        {[
          { key: 'baseFare', label: 'Boshlang\'ich narx (so\'m)' },
          { key: 'perKmPrice', label: 'Har km uchun (so\'m)' },
          { key: 'perMinPrice', label: 'Har minut uchun (so\'m)' },
          { key: 'minFare', label: 'Minimal narx (so\'m)' },
          { key: 'nightMultiplier', label: 'Kechasi koeffitsient (masalan 1.5)' },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label className="lbl">{label}</label>
            <input type="number" className="field" value={form[key]} onChange={(e) => set(key, e.target.value)} style={{ width: '100%' }} />
          </div>
        ))}

        <div style={{ background: 'var(--primary-soft)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          <b>Misol:</b> 5 km, 10 min sayohat uchun:<br />
          {form.baseFare || 0} + {form.perKmPrice || 0}×5 + {form.perMinPrice || 0}×10 = {' '}
          <b>{Number(form.baseFare || 0) + Number(form.perKmPrice || 0) * 5 + Number(form.perMinPrice || 0) * 10} so'm</b>
        </div>

        <Btn kind={saved ? 'green' : 'primary'} onClick={handleSave} style={{ width: '100%', padding: 11, fontSize: 15 }}>
          {saved ? <><I n="check" size={16} stroke={2.6} /> Saqlandi</> : 'Saqlash'}
        </Btn>
      </Card>
    </div>
  );
}
