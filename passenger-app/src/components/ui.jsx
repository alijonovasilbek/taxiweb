import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { STATUS } from '../utils/constants';

export function PageHeader({ title, sub, back = true, right, tall, children }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  return (
    <div className={`page-header${tall ? ' tall' : ''}`}>
      <div className="row">
        {back && <button className="back-btn" onClick={goBack} aria-label="Orqaga">←</button>}
        <div className="grow">
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Page({ title, sub, back, right, tall, header, children, nav = false }) {
  return (
    <div className="page">
      {header || <PageHeader title={title} sub={sub} back={back} right={right} tall={tall} />}
      <div className={`content${tall ? ' overlap' : ''}`}>{children}</div>
      {nav && <NavBar />}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, color: 'gray' };
  return <span className={`badge ${s.color}`}>{s.label}</span>;
}

export function Empty({ icon = '📭', title, text, action }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div className="bold" style={{ color: 'var(--muted)' }}>{title}</div>
      {text && <div className="faint mt8">{text}</div>}
      {action && <div className="mt16">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <button key={t.value} className={`tab${value === t.value ? ' active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}{t.count ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

export function Chips({ value, onChange, items, allLabel }) {
  return (
    <div className="chips">
      {allLabel && (
        <button className={`chip${!value ? ' active' : ''}`} onClick={() => onChange(null)}>{allLabel}</button>
      )}
      {items.map((c) => (
        <button key={c.value} className={`chip${value === c.value ? ' active' : ''}`} onClick={() => onChange(c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Route({ from, to }) {
  return (
    <div className="route">
      <div className="pt">{from}</div>
      {to && <div className="pt to">{to}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="between mb12">
          <div className="modal-title" style={{ margin: 0 }}>{title}</div>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`star${n <= value ? ' on' : ''}`} onClick={() => onChange(n)}>⭐</button>
      ))}
    </div>
  );
}

export function Rating({ value, count }) {
  return (
    <span className="faint">⭐ {Number(value || 5).toFixed(1)}{count !== undefined ? ` (${count})` : ''}</span>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useAppStore();
  const navigate = useNavigate();
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => { dismiss(t.id); if (t.link) navigate(t.link); }}>
          <div className="t">{t.title}</div>
          {t.message && <div className="m">{t.message}</div>}
        </div>
      ))}
    </div>
  );
}

const NAV = [
  { path: '/', icon: '🏠', label: 'Asosiy' },
  { path: '/search', icon: '🔎', label: 'Qidiruv' },
  { path: '/orders', icon: '📋', label: 'Buyurtmalar' },
  { path: '/provider', icon: '🧰', label: 'Ijrochi' },
  { path: '/profile', icon: '👤', label: 'Profil' },
];

export function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unread = useAppStore((s) => s.unread);
  return (
    <div className="nav-bar">
      {NAV.map((n) => {
        const active = n.path === '/' ? pathname === '/' : pathname.startsWith(n.path);
        return (
          <button key={n.path} className={`nav-item${active ? ' active' : ''}`} onClick={() => navigate(n.path)}>
            <span className="ic">{n.icon}</span>
            {n.label}
            {n.path === '/profile' && unread > 0 && <span className="dot" style={{ top: -2, right: '22%' }}>{unread}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, disabled }) {
  return <button type="button" disabled={disabled} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}
