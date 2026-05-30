import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Orders from './pages/Orders';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Tariffs from './pages/Tariffs';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/drivers', label: 'Haydovchilar', icon: '🚗' },
  { path: '/orders', label: 'Buyurtmalar', icon: '📋' },
  { path: '/payments', label: 'To\'lovlar', icon: '💳' },
  { path: '/tariffs', label: 'Tarif', icon: '💰' },
  { path: '/reports', label: 'Hisobotlar', icon: '📈' },
];

function Sidebar() {
  const { pathname } = useLocation();
  return (
    <div style={{ width: 220, background: '#1e293b', height: '100vh', position: 'fixed', left: 0, top: 0, padding: '20px 0' }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #334155', marginBottom: 16 }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TaxiGo</div>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>Admin Panel</div>
      </div>
      {NAV_ITEMS.map((item) => (
        <Link key={item.path} to={item.path} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
          color: pathname === item.path ? '#fff' : '#94a3b8',
          background: pathname === item.path ? '#2563EB' : 'transparent',
          textDecoration: 'none', fontSize: 14, fontWeight: pathname === item.path ? 600 : 400,
          borderLeft: pathname === item.path ? '3px solid #60a5fa' : '3px solid transparent',
        }}>
          <span>{item.icon}</span> {item.label}
        </Link>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div style={{ marginLeft: 220, flex: 1, minHeight: '100vh', padding: 24 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/tariffs" element={<Tariffs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
