import { useQuery } from '@tanstack/react-query';

import { APP_KIND } from '../config';
import { appVersion } from '../lib/device';
import { api } from './client';

export const qk = {
  me: ['me'] as const,
  version: ['app-version'] as const,
  sessions: ['sessions'] as const,
  credentials: ['credentials'] as const,
  activeOrder: ['order-active'] as const,
  order: (id: number) => ['order', id] as const,
  rides: ['rides'] as const,
  catalog: ['catalog'] as const,
  unread: ['unread'] as const,
  notifications: ['notifications'] as const,
  bookings: ['bookings-my'] as const,
  requests: ['requests-my'] as const,
  request: (id: number) => ['request', id] as const,
  trip: (id: number) => ['trip', id] as const,
};

// ── Foydalanuvchi ─────────────────────────────────────────────────────────────
export type Me = {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  rating: number | string | null;
  roles: string[];
  saved_places?: { home?: SavedPlace; work?: SavedPlace };
};

export type SavedPlace = { address: string; lat: number; lng: number };

export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: () => api<Me>('/users/me'), enabled, staleTime: 60_000 });
}

export type VersionInfo = {
  min_version: string;
  latest: string;
  apk_url: string | null;
  changelog: string | null;
  update_required?: boolean;
  update_available?: boolean;
  support?: string;
};

export function useAppVersion() {
  return useQuery({
    queryKey: qk.version,
    queryFn: () => api<VersionInfo>('/app/version', { auth: false, query: { current: appVersion(), app: APP_KIND } }),
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

export type AppSession = { id: number; device_id: string; device_name: string | null; last_used_at: string; current: boolean };

export function useSessions() {
  return useQuery({ queryKey: qk.sessions, queryFn: () => api<AppSession[]>('/auth/app/sessions') });
}

export type Credentials = { login: string | null; has_password: boolean; password_set_at: string | null };

export function useCredentials() {
  return useQuery({ queryKey: qk.credentials, queryFn: () => api<Credentials>('/auth/app/credentials') });
}

// ── Katalog ───────────────────────────────────────────────────────────────────
export type Catalog = {
  services: { code: string; name: string; is_active: boolean }[];
  vehicle_categories: { code: string; name: string; services: string[] }[];
};

export function useCatalog() {
  return useQuery({ queryKey: qk.catalog, queryFn: () => api<Catalog>('/catalog', { auth: false }), staleTime: 30 * 60_000 });
}

// ── Taksi ─────────────────────────────────────────────────────────────────────
export type OrderStatus = 'searching' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_drivers';

export type TaxiOrder = {
  id: number;
  status: OrderStatus;
  pickup_address: string;
  pickup_lat: number | string;
  pickup_lng: number | string;
  dropoff_address: string;
  dropoff_lat: number | string;
  dropoff_lng: number | string;
  distance_km: number | string | null;
  duration_min: number | null;
  estimated_price: number | string;
  final_price: number | string | null;
  payment_method: string | null;
  passenger_rated: boolean;
  created_at: string;
  cancel_reason?: string | null;
  driver?: {
    name: string;
    phone: string | null;
    car_model: string;
    car_number: string;
    car_color: string;
    rating: number;
    lat: number | null;
    lng: number | null;
  } | null;
};

export const ACTIVE_STATUSES: OrderStatus[] = ['searching', 'accepted', 'driver_arrived', 'in_progress'];

export function useActiveOrder(enabled = true) {
  return useQuery({
    queryKey: qk.activeOrder,
    queryFn: () => api<TaxiOrder | null>('/orders/active'),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useOrder(id: number, poll: boolean) {
  return useQuery({
    queryKey: qk.order(id),
    queryFn: () => api<TaxiOrder>(`/orders/${id}`),
    // socket uzilsa ham holat yangilanadi
    refetchInterval: poll ? 5000 : false,
  });
}

export function useRides() {
  return useQuery({ queryKey: qk.rides, queryFn: () => api<TaxiOrder[]>('/users/me/rides') });
}

/** Oxirgi borilgan manzillar (taksi tarixidan, takrorlarsiz) */
export function recentPlaces(rides: TaxiOrder[] | undefined, limit = 4): SavedPlace[] {
  const seen = new Set<string>();
  const out: SavedPlace[] = [];
  for (const o of rides ?? []) {
    const key = (o.dropoff_address || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ address: o.dropoff_address, lat: Number(o.dropoff_lat), lng: Number(o.dropoff_lng) });
    if (out.length >= limit) break;
  }
  return out;
}

export type NearbyCars = { cars: { lat: number; lng: number; distance_km: number }[]; eta_min: number | null };

// ── Po'puti ───────────────────────────────────────────────────────────────────
export type Trip = {
  id: number;
  driver_id: number;
  from_address: string;
  to_address: string;
  departure_at: string;
  price_per_seat: number | string;
  seats_total: number;
  seats_available: number;
  status: string;
  driver_name: string;
  driver_last_name?: string | null;
  driver_rating?: number | string | null;
  driver_phone?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle_plate?: string | null;
  allow_parcels?: boolean;
  note?: string | null;
  is_owner?: boolean;
  my_booking?: { id: number; seats: number; status: string } | null;
};

export type Booking = {
  id: number;
  trip_id: number;
  seats: number;
  status: string;
  from_address: string;
  to_address: string;
  departure_at: string;
  price_per_seat: number | string;
  driver_name: string;
  driver_phone: string | null;
};

export function useTrip(id: number) {
  return useQuery({ queryKey: qk.trip(id), queryFn: () => api<Trip>(`/carpool/trips/${id}`) });
}

export function useBookings() {
  return useQuery({ queryKey: qk.bookings, queryFn: () => api<Booking[]>('/carpool/bookings/my') });
}

// ── Yuk va texnika so'rovlari ─────────────────────────────────────────────────
export type RequestOffer = {
  id: number;
  provider_id: number;
  first_name: string;
  last_name: string | null;
  provider_rating: number | string | null;
  provider_phone?: string | null;
  vehicle_model: string | null;
  vehicle_plate?: string | null;
  vehicle_category?: string | null;
  price: number | string;
  message: string | null;
  available_at: string | null;
  status: string;
};

export type ServiceRequest = {
  id: number;
  service_type: 'cargo' | 'equipment';
  vehicle_category: string | null;
  title: string | null;
  description: string | null;
  from_address: string;
  to_address: string | null;
  scheduled_at: string | null;
  budget: number | string | null;
  estimated_price: number | string | null;
  final_price?: number | string | null;
  status: string;
  offers_count?: number;
  created_at: string;
  is_client?: boolean;
  offers?: RequestOffer[];
};

export function useMyRequests() {
  return useQuery({ queryKey: qk.requests, queryFn: () => api<ServiceRequest[]>('/requests/my') });
}

export function useRequest(id: number) {
  return useQuery({ queryKey: qk.request(id), queryFn: () => api<ServiceRequest>(`/requests/${id}`), refetchInterval: 20_000 });
}

// ── Bildirishnomalar ──────────────────────────────────────────────────────────
export type Notification = {
  id: number;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  data?: Record<string, any> | null;
};

export function useUnread(enabled = true) {
  return useQuery({
    queryKey: qk.unread,
    queryFn: () => api<{ unread: number }>('/notifications/unread-count'),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: async () => {
      const r = await api<Notification[] | { items: Notification[] }>('/notifications');
      return Array.isArray(r) ? r : r.items ?? [];
    },
  });
}
