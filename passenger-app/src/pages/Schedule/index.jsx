import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Page, Spinner } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { WEEKDAYS, apiError } from '../../utils/formatters';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

export default function Schedule() {
  const { toast } = useAppStore();
  const [slots, setSlots] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/schedules/me').then(({ data }) => setSlots(data.map(({ weekday, start_time, end_time, vehicle_id }) => ({ weekday, start_time, end_time, vehicle_id }))))
      .catch(() => setSlots([]));
  }, []);

  const add = (weekday) => setSlots((s) => [...s, { weekday, start_time: '08:00', end_time: '18:00', vehicle_id: null }]);
  const update = (i, k, v) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const remove = (i) => setSlots((s) => s.filter((_, j) => j !== i));
  const fillWeekdays = () => setSlots([0, 1, 2, 3, 4, 5].map((d) => ({ weekday: d, start_time: '08:00', end_time: '18:00', vehicle_id: null })));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/schedules/me', { slots });
      toast('Jadval saqlandi', 'Smart matching shu vaqtlarda sizni birinchi taklif qiladi');
    } catch (e) {
      toast('Xatolik', apiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!slots) return <Page title="Ish jadvali"><Spinner /></Page>;

  return (
    <Page title="Ish jadvali" sub="Qaysi kunlari va soatlarda bo'shsiz">
      <div className="card">
        <div className="muted">Jadval kiritilsa, mijoz tanlagan vaqtda bo'sh ijrochilar birinchi bo'lib ko'rsatiladi.</div>
        <button className="btn secondary sm mt12" onClick={fillWeekdays}>Du–Sh, 08:00–18:00 bilan to'ldirish</button>
      </div>
      {WEEKDAYS.map((name, d) => {
        const daySlots = slots.map((s, i) => ({ ...s, i })).filter((s) => s.weekday === d);
        return (
          <div key={d} className="card">
            <div className="between">
              <div className="bold">{name}</div>
              <button className="btn ghost sm" onClick={() => add(d)}><I n="plus" size={15} /> Vaqt</button>
            </div>
            {daySlots.length === 0 && <div className="faint mt8">Dam olish</div>}
            {daySlots.map((s) => (
              <div key={s.i} className="row mt8">
                <input type="time" className="input" value={s.start_time} onChange={(e) => update(s.i, 'start_time', e.target.value)} />
                <span>—</span>
                <input type="time" className="input" value={s.end_time} onChange={(e) => update(s.i, 'end_time', e.target.value)} />
                <button className="btn red-soft sm" onClick={() => remove(s.i)} aria-label="O'chirish"><I n="close" size={15} /></button>
              </div>
            ))}
          </div>
        );
      })}
      <div className="bottom-bar">
        <button className="btn block" disabled={saving} onClick={save}>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </Page>
  );
}
