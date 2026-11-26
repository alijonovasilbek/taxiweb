import React from 'react';
import { I, Tile, GRAD } from './icons';

export const STATUS = {
  pending: ['Kutilmoqda', 'orange'], approved: ['Tasdiqlangan', 'green'], rejected: ['Rad etilgan', 'red'],
  blocked: ['Bloklangan', 'red'], open: ['Ochiq', 'orange'], assigned: ['Tayinlangan', 'blue'],
  in_progress: ['Bajarilmoqda', 'blue'], completed: ['Yakunlangan', 'green'], cancelled: ['Bekor', 'red'],
  expired: ['Muddati o\'tgan', 'gray'], active: ['Faol', 'green'], full: ['To\'lgan', 'orange'],
  departed: ['Yo\'lda', 'blue'], confirmed: ['Tasdiqlangan', 'green'], accepted: ['Qabul qilingan', 'green'],
  withdrawn: ['Qaytarilgan', 'gray'],
};

export const CATEGORY = {
  sedan: 'Yengil', minivan: 'Miniven', bus: 'Mikroavtobus', damas: 'Damas', labo: 'Labo',
  gazel: 'Gazel', isuzu: 'Isuzu', kamaz: 'KamAZ', dump_truck: 'Samosval', excavator: 'Ekskavator',
  bulldozer: 'Buldozer', crane: 'Avtokran', loader: 'Yuklagich', tractor: 'Traktor',
  concrete_mixer: 'Beton aralashtirgich',
};

export const SERVICE = { taxi: 'Taksi', carpool: 'Po\'puti', cargo: 'Yuk tashish', equipment: 'Spets texnika' };
export const SERVICE_TILE = {
  taxi: ['taxi', GRAD.taxi], carpool: ['users', GRAD.green], cargo: ['truck', GRAD.teal], equipment: ['tractor', GRAD.orange],
};

export const ROLE = { client: 'Mijoz', driver: 'Haydovchi', cargo: 'Yuk tashuvchi', equipment_owner: 'Texnika egasi', company: 'Kompaniya' };

export const fmtMoney = (v) => (v === null || v === undefined ? '—' : new Intl.NumberFormat('uz-UZ').format(Math.round(Number(v))) + ' so\'m');
export const fmtDate = (v) => (v ? new Date(String(v).replace(' ', 'T')).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export function Badge({ children, color = 'gray' }) {
  return <span className={`badge ${color}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const [label, color] = STATUS[status] || [status, 'gray'];
  return <Badge color={color}>{label}</Badge>;
}

export function Rating({ value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <I n="star" size={14} color="#ff9f0a" style={{ fill: '#ffcc00' }} />{Number(value || 5).toFixed(1)}
    </span>
  );
}

export function Header({ title, right, sub }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="right">{right}</div>
    </div>
  );
}

export function Card({ children, style, className = '' }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

/** icon — ikonka nomi (icons.jsx), tile — fon gradienti (GRAD) */
export function Stat({ icon, label, value, tile = GRAD.burgundy, sub }) {
  return (
    <Card style={{ padding: 18 }}>
      <div className="stat">
        <Tile n={icon} bg={tile} size={44} icon={22} radius={11} />
        <div>
          <div className="v">{value}</div>
          <div className="l">{label}</div>
          {sub && <div className="s">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

export function Table({ columns, rows, empty = 'Ma\'lumot topilmadi', onRowClick }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key || c.title}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key || c.title} style={c.style}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">{empty}</div>}
    </div>
  );
}

export function Pager({ page, total, limit = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pager">
      <Btn kind="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}><I n="prev" size={15} /> Oldingi</Btn>
      <span>{page} / {pages} · jami {total}</span>
      <Btn kind="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Keyingi <I n="next" size={15} /></Btn>
    </div>
  );
}

export function Btn({ kind = 'primary', children, style, className = '', ...props }) {
  return <button {...props} className={`btn ${kind} ${className}`} style={style}>{children}</button>;
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="field" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Input({ className = '', ...props }) {
  return <input {...props} className={`field ${className}`} />;
}

export function Drawer({ title, onClose, children }) {
  return (
    <div className="drawer-back" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Yopish"><I n="close" size={15} stroke={2.6} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function KV({ rows }) {
  return (
    <div>
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k} className="kv-row"><span className="k">{k}</span><span className="v">{v ?? '—'}</span></div>
      ))}
    </div>
  );
}
