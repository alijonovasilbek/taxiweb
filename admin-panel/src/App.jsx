import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Orders from './pages/Orders';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Tariffs from './pages/Tariffs';
import Login from './pages/Login';
import Users from './pages/Users';
import Vehicles from './pages/Vehicles';
import Carpool from './pages/Carpool';
import Requests from './pages/Requests';
import Services from './pages/Services';
import Places from './pages/Places';
import Audit from './pages/Audit';
import { I } from './components/icons';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { section: 'Platforma' },
  { path: '/users', label: 'Foydalanuvchilar', icon: 'users' },
  { path: '/vehicles', label: 'Transport / texnika', icon: 'truck' },
  { path: '/services', label: 'Servislar va tariflar', icon: 'puzzle' },
  { path: '/places', label: 'Mashhur joylar', icon: 'pin' },
  { path: '/audit', label: 'Jurnal', icon: 'shield' },
  { section: 'Servislar' },
  { path: '/carpool', label: "Po'puti", icon: 'route' },
  { path: '/requests', label: 'Yuk va texnika', icon: 'tractor' },
  { section: 'Taksi' },
  { path: '/drivers', label: 'Haydovchilar', icon: 'car' },
  { path: '/orders', label: 'Buyurtmalar', icon: 'orders' },
  { path: '/payments', label: "To'lovlar", icon: 'card' },
  { path: '/tariffs', label: 'Tarif', icon: 'coins' },
  { path: '/reports', label: 'Hisobotlar', icon: 'chart' },
];

function Sidebar({ onLogout }) {
  const { pathname } = useLocation();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><I n="taxi" size={19} /></span>
        <div>
          <div className="n">Chortoq Services</div>
          <div className="s">Boshqaruv paneli</div>
        </div>
      </div>
      <nav className="side-scroll">
        {NAV_ITEMS.map((item) => item.section ? (
          <div key={item.section} className="side-section">{item.section}</div>
        ) : (
          <Link key={item.path} to={item.path} className={`side-link${pathname === item.path ? ' active' : ''}`}>
            <span className="si"><I n={item.icon} size={16} /></span>{item.label}
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <button className="side-link" onClick={onLogout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
          <span className="si"><I n="logout" size={16} /></span>Chiqish
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('taxigo_admin_token'));

  const handleLogout = () => {
    localStorage.removeItem('taxigo_admin_token');
    setToken(null);
  };

  if (!token) return <Login onLogin={setToken} />;

  return (
    <BrowserRouter basename="/admin">
      <div>
        <Sidebar onLogout={handleLogout} />
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/tariffs" element={<Tariffs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<Users />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/services" element={<Services />} />
            <Route path="/places" element={<Places />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/carpool" element={<Carpool />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
