import React from 'react';
import {
  CarTaxiFront, Users, Truck, Tractor, Wheat, Package, KeyRound, Building2, Car, CarFront, Bus, Caravan,
  Construction, Forklift, Container, Shovel, Search, House, ClipboardList, BriefcaseBusiness, UserRound,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Star, MapPin, Map, Phone, MessageCircle, Calendar,
  Clock, Plus, X, Check, CheckCircle2, Sparkles, Bell, BellOff, Repeat, Ticket, Route as RouteIcon, Hand,
  Ruler, Inbox, Lock, Pencil, Trash2, FileText, Armchair, Weight, Lightbulb, SlidersHorizontal, Send, Rocket,
  Banknote, CreditCard, Navigation, Wrench, UserX, Circle, Package2, PersonStanding, Flag, LocateFixed, ArrowUpRight, Sun, Moon,
} from 'lucide-react';

/** Ekskavator — lucide'da yo'q, shu uslubda (24×24, chiziqli) */
function Excavator({ size = 24, color = 'currentColor', strokeWidth = 2, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="2" y="17" width="12" height="4" rx="2" />
      <path d="M4 17v-4h6l1 4" />
      <path d="M10 13V9h2" />
      <path d="M12 9l5-5 4 5" />
      <path d="M21 9v3l-3 2" />
    </svg>
  );
}

const MAP = {
  search: Search, home: House, orders: ClipboardList, provider: BriefcaseBusiness, profile: UserRound, user: UserRound,
  back: ChevronLeft, next: ChevronRight, down: ChevronDown, up: ChevronUp, star: Star, pin: MapPin, map: Map,
  phone: Phone, chat: MessageCircle, calendar: Calendar, clock: Clock, plus: Plus, close: X, check: Check,
  done: CheckCircle2, sparkles: Sparkles, bell: Bell, 'bell-off': BellOff, repeat: Repeat, ticket: Ticket,
  route: RouteIcon, hand: Hand, ruler: Ruler, inbox: Inbox, lock: Lock, edit: Pencil, trash: Trash2, doc: FileText,
  seat: Armchair, weight: Weight, idea: Lightbulb, filter: SlidersHorizontal, send: Send, rocket: Rocket,
  cash: Banknote, card: CreditCard, nav: Navigation, wrench: Wrench, 'user-x': UserX, circle: Circle,
  parcel: Package2, car: Car, taxi: CarTaxiFront, truck: Truck, tractor: Tractor, users: Users, people: Users,
  person: PersonStanding, flag: Flag, locate: LocateFixed, 'arrow-ur': ArrowUpRight, excavator: Excavator, sun: Sun, moon: Moon,
};

/** Inline chiziqli ikonka (SF Symbols uslubida). Matn bilan bir qatorda turadi. */
export function I({ n, size = 16, color, stroke = 2, style, className }) {
  const C = MAP[n] || Circle;
  return (
    <C size={size} color={color || 'currentColor'} strokeWidth={stroke} className={`ico${className ? ` ${className}` : ''}`}
      style={style} aria-hidden="true" />
  );
}

/* iOS ilova ikonkasi uslubidagi rangli kvadratlar */
const SERVICE = {
  taxi: { Icon: CarTaxiFront, bg: 'linear-gradient(180deg,#FFD60A,#FF9F0A)' },
  carpool: { Icon: Users, bg: 'linear-gradient(180deg,#34C759,#248A3D)' },
  cargo: { Icon: Truck, bg: 'linear-gradient(180deg,#40C8E0,#0E7C8C)' },
  equipment: { Icon: Tractor, bg: 'linear-gradient(180deg,#FF9F0A,#FF453A)' },
  agro: { Icon: Wheat, bg: 'linear-gradient(180deg,#A2845E,#7F6545)' },
  courier: { Icon: Package, bg: 'linear-gradient(180deg,#BF5AF2,#8944AB)' },
  rental: { Icon: KeyRound, bg: 'linear-gradient(180deg,#64D2FF,#0E7C8C)' },
  corporate: { Icon: Building2, bg: 'linear-gradient(180deg,#8E8E93,#48484A)' },
};

const CATEGORY = {
  sedan: Car, minivan: CarFront, bus: Bus, damas: Caravan, labo: Truck, gazel: Truck, isuzu: Truck, kamaz: Truck,
  dump_truck: Truck, excavator: Shovel, bulldozer: Construction, crane: Construction, loader: Forklift,
  tractor: Tractor, concrete_mixer: Container,
};
const CATEGORY_SERVICE = {
  sedan: 'taxi', minivan: 'carpool', bus: 'carpool', damas: 'cargo', labo: 'cargo', gazel: 'cargo', isuzu: 'cargo',
  kamaz: 'cargo', dump_truck: 'cargo', excavator: 'equipment', bulldozer: 'equipment', crane: 'equipment',
  loader: 'equipment', tractor: 'equipment', concrete_mixer: 'equipment',
};

function Tile({ Icon, bg, size, radius }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: radius ?? size * 0.27, background: bg }}>
      <Icon size={Math.round(size * 0.56)} color="#fff" strokeWidth={2} />
    </span>
  );
}

export function ServiceIcon({ code, size = 48 }) {
  const s = SERVICE[code] || { Icon: Sparkles, bg: 'linear-gradient(180deg,#8E8E93,#636366)' };
  return <Tile Icon={s.Icon} bg={s.bg} size={size} />;
}

export function CategoryIcon({ code, size = 40 }) {
  const Icon = CATEGORY[code] || Car;
  const bg = (SERVICE[CATEGORY_SERVICE[code]] || SERVICE.cargo).bg;
  return <Tile Icon={Icon} bg={bg} size={size} />;
}

/** Kategoriya uchun kichik inline glif (matn ichida) */
export function CategoryGlyph({ code, size = 15 }) {
  const Icon = CATEGORY[code] || Car;
  return <Icon size={size} strokeWidth={2} className="ico" aria-hidden="true" />;
}

export function ServiceGlyph({ code, size = 15 }) {
  const Icon = (SERVICE[code] || {}).Icon || Sparkles;
  return <Icon size={size} strokeWidth={2} className="ico" aria-hidden="true" />;
}
