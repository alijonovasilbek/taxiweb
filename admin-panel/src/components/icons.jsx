import React from 'react';
import {
  LayoutDashboard, Users, Truck, Puzzle, Route, Tractor, Car, ClipboardList, CreditCard, Coins, LineChart, LogOut,
  Star, RefreshCw, MessageSquare, Repeat, Check, X, ChevronLeft, ChevronRight, Search, Briefcase, CarTaxiFront,
  ShieldCheck, FileText, AlertTriangle, Phone, MapPin, Calendar, Clock,
} from 'lucide-react';

const MAP = {
  dashboard: LayoutDashboard, users: Users, truck: Truck, puzzle: Puzzle, route: Route, tractor: Tractor, car: Car,
  orders: ClipboardList, card: CreditCard, coins: Coins, chart: LineChart, logout: LogOut, star: Star, refresh: RefreshCw,
  chat: MessageSquare, repeat: Repeat, check: Check, close: X, prev: ChevronLeft, next: ChevronRight, search: Search,
  provider: Briefcase, taxi: CarTaxiFront, shield: ShieldCheck, doc: FileText, warn: AlertTriangle, phone: Phone,
  pin: MapPin, calendar: Calendar, clock: Clock,
};

export function I({ n, size = 16, stroke = 2, color, style, className = '' }) {
  const C = MAP[n] || Check;
  return <C size={size} strokeWidth={stroke} color={color} style={style} className={`ico ${className}`} />;
}

/** macOS uslubidagi rangli kvadrat ikonka */
export function Tile({ n, bg, size = 30, icon = 17, radius }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, background: bg, borderRadius: radius ?? Math.round(size * 0.24) }}>
      <I n={n} size={icon} color="#fff" />
    </span>
  );
}

export const GRAD = {
  burgundy: 'linear-gradient(180deg,#a8284e,#5e0f26)',
  taxi: 'linear-gradient(180deg,#FFD60A,#FF9F0A)',
  green: 'linear-gradient(180deg,#34C759,#248A3D)',
  teal: 'linear-gradient(180deg,#40C8E0,#0E7C8C)',
  orange: 'linear-gradient(180deg,#FF9F0A,#FF453A)',
  gold: 'linear-gradient(180deg,#f0bf5c,#c98a1f)',
  gray: 'linear-gradient(180deg,#8E8E93,#48484A)',
};
