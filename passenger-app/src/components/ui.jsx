import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useUserStore } from '../store/userStore';
import { STATUS } from '../utils/constants';
import { I } from './icons';

export function PageHeader({ title, sub, back = true, right, tall, children }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  return (
    <div className={`page-header${tall ? ' tall' : ''}`}>
      {back && (
        <div className="between" style={{ minHeight: 36, marginBottom: 2 }}>
          <button className="back-btn" onClick={goBack} aria-label="Orqaga"><I n="back" size={28} stroke={2.2} />Orqaga</button>
          {right}
        </div>
      )}
      <div className="row">
        <div className="grow">
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {!back && right}
      </div>
      {children}
    </div>
  );
}

export function Page({ title, sub, back, right, tall, header, children, nav = false }) {
  // Ijrochi rejimida Transport va Jadval — pastki menyu bo'limlari (orqaga tugmasi o'rniga menyu)
  const { mode } = useMode();
  const { pathname } = useLocation();
  const isTab = mode === 'provider' && ['/vehicles', '/schedule', '/taxi-driver'].includes(pathname);
  if (isTab) { nav = true; back = false; }
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

export function Empty({ icon = 'inbox', title, text, action }) {
  return (
    <div className="empty">
      <div className="big"><I n={icon} size={30} stroke={1.8} /></div>
      <div className="bold" style={{ color: 'var(--text)', fontSize: 17 }}>{title}</div>
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
          <button className="close-btn" onClick={onClose} aria-label="Yopish"><I n="close" size={16} stroke={2.6} /></button>
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
        <button key={n} type="button" className={`star${n <= value ? ' on' : ''}`} onClick={() => onChange(n)}><I n="star" size={36} stroke={1.6} /></button>
      ))}
    </div>
  );
}

export function Rating({ value, count }) {
  return (
    <span className="faint" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><I n="star" size={13} className="star-ico" /> {Number(value || 5).toFixed(1)}{count !== undefined ? ` (${count})` : ''}</span>
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

const NAV_CLIENT = [
  { path: '/', icon: 'home', label: 'Asosiy' },
  { path: '/search', icon: 'search', label: 'Qidiruv' },
  { path: '/orders', icon: 'orders', label: 'Buyurtmalar' },
  { path: '/provider', icon: 'provider', label: 'Ijrochi' },
  { path: '/profile', icon: 'profile', label: 'Profil' },
];
const NAV_PROVIDER = [
  { path: '/provider', icon: 'provider', label: 'Ishlar' },
  { path: '/vehicles', icon: 'truck', label: 'Transport' },
  { path: '/schedule', icon: 'calendar', label: 'Jadval' },
  { path: '/profile', icon: 'profile', label: 'Profil' },
];

/** Ijrochi rejimi faqat tasdiqlangan ijrochi roli bo'lsa */
export function useMode() {
  const user = useUserStore((s) => s.user);
  const { mode, setMode } = useAppStore();
  const isProvider = Boolean(user?.roles?.some((r) => r !== 'client'));
  return { mode: isProvider ? mode : 'client', setMode, isProvider };
}

export function ModeSwitch() {
  const { mode, setMode, isProvider } = useMode();
  const navigate = useNavigate();
  if (!isProvider) return null;
  const go = (m) => { setMode(m); navigate(m === 'provider' ? '/provider' : '/'); };
  return (
    <div className="tabs" style={{ marginBottom: 12 }}>
      <button className={`tab${mode === 'client' ? ' active' : ''}`} onClick={() => go('client')}>Mijoz</button>
      <button className={`tab${mode === 'provider' ? ' active' : ''}`} onClick={() => go('provider')}>Ijrochi</button>
    </div>
  );
}

export function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unread = useAppStore((s) => s.unread);
  const { mode } = useMode();
  const isDriver = useUserStore((s) => s.user?.roles?.includes('driver'));
  const NAV = mode === 'provider'
    ? (isDriver ? [NAV_PROVIDER[0], { path: '/taxi-driver', icon: 'taxi', label: 'Taksi' }, ...NAV_PROVIDER.slice(1)] : NAV_PROVIDER)
    : NAV_CLIENT;
  return (
    <div className={`nav-bar${mode === 'provider' ? ' provider' : ''}`}>
      {NAV.map((n) => {
        const active = n.path === '/' ? pathname === '/' : pathname.startsWith(n.path);
        return (
          <button key={n.path} className={`nav-item${active ? ' active' : ''}`} onClick={() => navigate(n.path)}>
            <span className="ic"><I n={n.icon} size={21} stroke={active ? 2.2 : 1.8} /></span>
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
