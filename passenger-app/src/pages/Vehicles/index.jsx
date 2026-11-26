import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Page, Empty, Spinner, StatusBadge, Toggle, Modal } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { apiError, formatPrice } from '../../utils/formatters';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

function DocUpload({ vehicle, onDone, onClose }) {
  const { catalog, toast } = useAppStore();
  const [docType, setDocType] = useState('tech_passport');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('doc_type', docType);
    fd.append('file', file);
    try {
      await api.post(`/vehicles/${vehicle.id}/documents`, fd);
      toast('Hujjat yuklandi', 'Admin tekshiradi');
      onDone();
    } catch (e) { toast('Xatolik', apiError(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Hujjat yuklash" onClose={onClose}>
      <select className="select mb12" value={docType} onChange={(e) => setDocType(e.target.value)}>
        {(catalog?.doc_types || []).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
      </select>
      <input type="file" accept="image/*,application/pdf" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button className="btn block mt12" disabled={!file || busy} onClick={send}>{busy ? 'Yuklanmoqda...' : 'Yuklash'}</button>
    </Modal>
  );
}

function VehicleCard({ v, reload }) {
  const navigate = useNavigate();
  const { category, toast } = useAppStore();
  const [docOpen, setDocOpen] = useState(false);
  const photoRef = useRef(null);
  const cat = category(v.category);

  const toggle = (on) => {
    const send = (extra = {}) => api.put(`/vehicles/${v.id}/availability`, { is_available: on, ...extra })
      .then(() => { toast(on ? 'Bo\'sh deb belgilandi' : 'Band deb belgilandi'); reload(); })
      .catch((e) => toast('Xatolik', apiError(e), 'error'));
    if (on && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => send({ lat: coords.latitude, lng: coords.longitude }),
        () => send(),
        { timeout: 6000 },
      );
    } else send();
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try { await api.post(`/vehicles/${v.id}/photo`, fd); reload(); } catch (e) { toast('Xatolik', apiError(e), 'error'); }
  };

  const remove = async () => {
    if (!confirm('Transportni o\'chirasizmi?')) return;
    try { await api.delete(`/vehicles/${v.id}`); reload(); } catch (e) { toast('Xatolik', apiError(e), 'error'); }
  };

  return (
    <div className="card">
      <div className="row">
        {v.photo_url
          ? <img className="photo" src={v.photo_url} alt="" onClick={() => photoRef.current?.click()} />
          : <div onClick={() => photoRef.current?.click()} style={{ cursor: 'pointer' }}><CategoryIcon code={v.category} size={64} /></div>}
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => uploadPhoto(e.target.files?.[0])} />
        <div className="grow">
          <div className="bold">{v.model}</div>
          <div className="faint">{cat?.name} {v.plate_number ? `· ${v.plate_number}` : ''}</div>
          <div className="row mt8" style={{ gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={v.status} />
            {cat?.services.map((s) => <span key={s} className="badge gray">{{ taxi: 'Taksi', carpool: 'Po\'puti', cargo: 'Yuk', equipment: 'Texnika', agro: 'Agro' }[s]}</span>)}
          </div>
        </div>
      </div>
      {v.status === 'rejected' && v.reject_reason && <div className="badge red mt12" style={{ whiteSpace: 'normal' }}>Sabab: {v.reject_reason}</div>}
      {v.status === 'pending' && (v.missing_docs?.length > 0 ? (
        <button className="btn secondary block mt12" style={{ fontSize: 15, padding: '10px 14px' }} onClick={() => setDocOpen(true)}>
          <I n="doc" size={16} /> Yuklang: {v.missing_docs.map((m) => m.name).join(', ')}
        </button>
      ) : <div className="hint mt8"><I n="clock" size={13} /> Hujjatlar to'liq. Admin tekshiruvida.</div>)}
      <div className="row mt12" style={{ flexWrap: 'wrap', gap: 6 }}>
        {v.seats && <span className="badge blue"><I n="seat" size={12} /> {v.seats} o'rin</span>}
        {v.capacity_kg && <span className="badge blue"><I n="weight" size={12} /> {v.capacity_kg} kg</span>}
        {v.price_per_km && <span className="badge yellow">{formatPrice(v.price_per_km)}/km</span>}
        {v.price_per_hour && <span className="badge yellow">{formatPrice(v.price_per_hour)}/soat</span>}
        {v.price_per_shift && <span className="badge yellow">{formatPrice(v.price_per_shift)}/smena</span>}
        {v.documents?.length > 0 && <span className="badge gray"><I n="doc" size={12} /> {v.documents.length} hujjat</span>}
      </div>
      <div className="between mt12" style={{ paddingTop: 12, borderTop: '.5px solid var(--line)' }}>
        <div className="row"><Toggle on={v.is_available} onChange={toggle} /><span className="muted">{v.is_available ? 'Bo\'sh — buyurtma olaman' : 'Band'}</span></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={() => setDocOpen(true)} aria-label="Hujjat"><I n="doc" size={16} /></button>
          <button className="btn ghost sm" onClick={() => navigate(`/vehicles/${v.id}/edit`)} aria-label="Tahrirlash"><I n="edit" size={16} /></button>
          <button className="btn ghost sm" onClick={remove} aria-label="O'chirish" style={{ color: 'var(--red)' }}><I n="trash" size={16} /></button>
        </div>
      </div>
      {v.location_address && <div className="faint mt8"><I n="pin" size={13} /> {v.location_address}</div>}
      {docOpen && <DocUpload vehicle={v} onClose={() => setDocOpen(false)} onDone={() => { setDocOpen(false); reload(); }} />}
    </div>
  );
}

export default function Vehicles() {
  const navigate = useNavigate();
  const { loadCatalog } = useAppStore();
  const [items, setItems] = useState(null);
  const load = () => api.get('/vehicles/my').then(({ data }) => setItems(data)).catch(() => setItems([]));
  useEffect(() => { loadCatalog(); load(); }, []);

  return (
    <Page title="Transportlarim" sub="Avtomobil, yuk mashinasi va texnikalar"
      right={<button className="icon-btn" onClick={() => navigate('/vehicles/new')} aria-label="Qo'shish"><I n="plus" size={20} /></button>}>
      {!items && <Spinner />}
      {items?.length === 0 && (
        <Empty icon="truck" title="Transport qo'shilmagan" text="Bitta akkaunt bilan taksi, po'puti, yuk tashish yoki texnika xizmatini ko'rsating"
          action={<button className="btn" onClick={() => navigate('/vehicles/new')}><I n="plus" size={19} /> Transport qo'shish</button>} />
      )}
      {items?.map((v) => <VehicleCard key={v.id} v={v} reload={load} />)}
      {items?.length > 0 && <button className="btn secondary block" onClick={() => navigate('/schedule')}><I n="calendar" size={17} /> Ish jadvalini sozlash</button>}
    </Page>
  );
}
