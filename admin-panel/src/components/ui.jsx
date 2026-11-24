import React from 'react';

export const COLORS = {
  green: ['#DCFCE7', '#15803D'], red: ['#FEE2E2', '#B91C1C'], orange: ['#FFEDD5', '#C2410C'],
  blue: ['#DBEAFE', '#1D4ED8'], gray: ['#F1F5F9', '#475569'], yellow: ['#FEF9C3', '#854D0E'],
};

export const STATUS = {
  pending: ['Kutilmoqda', 'orange'], approved: ['Tasdiqlangan', 'green'], rejected: ['Rad etilgan', 'red'],
  blocked: ['Bloklangan', 'red'], open: ['Ochiq', 'orange'], assigned: ['Tayinlangan', 'blue'],
  in_progress: ['Bajarilmoqda', 'blue'], completed: ['Yakunlangan', 'green'], cancelled: ['Bekor', 'red'],
  expired: ['Muddati o\'tgan', 'gray'], active: ['Faol', 'green'], full: ['To\'lgan', 'orange'],
  departed: ['Yo\'lda', 'blue'], confirmed: ['Tasdiqlangan', 'green'], accepted: ['Qabul qilingan', 'green'],
  withdrawn: ['Qaytarilgan', 'gray'],
};

export const CATEGORY = {
  sedan: '🚗 Yengil', minivan: '🚐 Miniven', bus: '🚌 Mikroavtobus', damas: '🚐 Damas', labo: '🛻 Labo',
  gazel: '🚚 Gazel', isuzu: '🚚 Isuzu', kamaz: '🚛 KamAZ', dump_truck: '🚛 Samosval', excavator: '🏗️ Ekskavator',
  bulldozer: '🚜 Buldozer', crane: '🏗️ Avtokran', loader: '🚜 Yuklagich', tractor: '🚜 Traktor',
  concrete_mixer: '🚛 Beton aralashtirgich',
};

export const SERVICE = { taxi: '🚕 Taksi', carpool: '🚐 Po\'puti', cargo: '🚚 Yuk tashish', equipment: '🚜 Spets texnika' };

export const ROLE = { client: 'Mijoz', driver: 'Haydovchi', cargo: 'Yuk tashuvchi', equipment_owner: 'Texnika egasi', company: 'Kompaniya' };

export const fmtMoney = (v) => (v === null || v === undefined ? '—' : new Intl.NumberFormat('uz-UZ').format(Math.round(Number(v))) + ' so\'m');
export const fmtDate = (v) => (v ? new Date(String(v).replace(' ', 'T')).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export function Badge({ children, color = 'gray' }) {
  const [bg, fg] = COLORS[color] || COLORS.gray;
  return <span style={{ background: bg, color: fg, padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function StatusBadge({ status }) {
  const [label, color] = STATUS[status] || [status, 'gray'];
  return <Badge color={color}>{label}</Badge>;
}

export function Header({ title, right, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
        {sub && <div style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>
    </div>
  );
}

export function Card({ children, style }) {
  return <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 20, ...style }}>{children}</div>;
}

export function Stat({ icon, label, value, color = '#2563EB', sub }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 26 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

export function Table({ columns, rows, empty = 'Ma\'lumot topilmadi', onRowClick }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            {columns.map((c) => <th key={c.key || c.title} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{ borderTop: '1px solid #F1F5F9', cursor: onRowClick ? 'pointer' : 'default' }}>
              {columns.map((c) => (
                <td key={c.key || c.title} style={{ padding: '11px 14px', fontSize: 13, verticalAlign: 'top', ...(c.style || {}) }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8' }}>{empty}</div>}
    </div>
  );
}

export function Pager({ page, total, limit = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
      <Btn kind="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Oldingi</Btn>
      <span style={{ fontSize: 13, color: '#64748B' }}>{page} / {pages} · jami {total}</span>
      <Btn kind="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Keyingi →</Btn>
    </div>
  );
}

const BTN = {
  primary: { background: '#2563EB', color: '#fff', border: 'none' },
  green: { background: '#16A34A', color: '#fff', border: 'none' },
  red: { background: '#FEE2E2', color: '#B91C1C', border: 'none' },
  ghost: { background: '#fff', color: '#334155', border: '1.5px solid #E2E8F0' },
};

export function Btn({ kind = 'primary', children, style, ...props }) {
  return (
    <button {...props} style={{ ...BTN[kind], padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: props.disabled ? 'default' : 'pointer', opacity: props.disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}
      style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff' }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Input(props) {
  return <input {...props} style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, ...(props.style || {}) }} />;
}

export function Drawer({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', background: '#F8FAFC', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
          <Btn kind="ghost" onClick={onClose}>✕</Btn>
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
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
          <span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
