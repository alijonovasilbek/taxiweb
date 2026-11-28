import { useQuery } from '@tanstack/react-query';

import { appVersion } from '../lib/device';
import { api } from './client';

export type Section = 'taxi' | 'carpool' | 'requests';

export type ProviderHome = {
  phone_required: boolean;
  user: {
    id: number;
    first_name: string;
    phone: string | null;
    phone_verified: boolean | null;
    roles: string[];
    eligible_roles: string[];
    provider_rating: number | null;
  };
  sections: Section[];
  pending_vehicles: number;
  taxi: {
    id: number;
    status: string;
    is_online: boolean;
    is_on_ride: boolean;
    rating: string | number;
    total_rides: number;
    car_model: string;
    car_number: string;
    car_color: string;
  } | null;
  active_order: Record<string, any> | null;
  active_jobs: { id: number; service_type: string; title: string | null; from_address: string; to_address: string | null; status: string; scheduled_at: string | null }[];
  carpool_trips: { id: number; from_address: string; to_address: string; departure_at: string; seats_total: number; seats_available: number; status: string; pending_bookings: number }[];
  new_requests: number;
  earnings_today: number;
  unread_notifications: number;
};

export const qk = {
  home: ['provider-home'] as const,
  version: ['app-version'] as const,
  vehicles: ['vehicles-my'] as const,
  sessions: ['sessions'] as const,
  credentials: ['credentials'] as const,
  driverActive: ['driver-active'] as const,
  earnings: ['driver-earnings'] as const,
};

export function useProviderHome(enabled = true) {
  return useQuery({ queryKey: qk.home, queryFn: () => api<ProviderHome>('/provider/home'), enabled, refetchInterval: 60_000 });
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
    queryFn: () => api<VersionInfo>('/app/version', { auth: false, query: { current: appVersion() } }),
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

export type Vehicle = {
  id: number;
  category: string;
  model: string;
  plate_number: string | null;
  color: string | null;
  seats?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  missing_docs?: { code: string; name: string }[];
  documents?: { id: number; doc_type: string; status: string; file_url: string; created_at: string }[];
  photo_url?: string | null;
  year?: number | null;
  capacity_kg?: number | null;
  reject_reason?: string | null;
};

export function useMyVehicles() {
  return useQuery({ queryKey: qk.vehicles, queryFn: () => api<Vehicle[]>('/vehicles/my') });
}

export type AppSession = { id: number; device_id: string; device_name: string | null; last_used_at: string; current: boolean };

export function useSessions() {
  return useQuery({ queryKey: qk.sessions, queryFn: () => api<AppSession[]>('/auth/app/sessions') });
}

export type Credentials = { login: string | null; has_password: boolean; password_set_at: string | null };

export function useCredentials() {
  return useQuery({ queryKey: qk.credentials, queryFn: () => api<Credentials>('/auth/app/credentials') });
}

export type TaxiOrder = {
  id: number;
  status: 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
  pickup_address: string;
  pickup_lat: string | number;
  pickup_lng: string | number;
  dropoff_address: string;
  dropoff_lat: string | number;
  dropoff_lng: string | number;
  distance_km: string | number | null;
  duration_min: number | null;
  estimated_price: string | number;
  payment_method: string;
  passenger_name: string | null;
  passenger_phone: string | null;
  passenger_rating: string | number | null;
};

export type DriverActive = { driver: { id: number; is_online: boolean; is_on_ride: boolean; status: string } | null; order: TaxiOrder | null };

export function useDriverActive(enabled = true) {
  return useQuery({
    queryKey: qk.driverActive,
    queryFn: () => api<DriverActive>('/orders/driver/active'),
    enabled,
    refetchInterval: 30_000,
  });
}

/** Daromad ekrani: bugun, oxirgi 7 kun ustunlari, liniyada vaqt, oxirgi safarlar */
export type Earnings = {
  total_earnings: number;
  total_rides: number;
  today_earnings: number;
  today_rides: number;
  online_min_today: number;
  rating: number;
  week: { date: string; weekday: number; total: number; rides: number }[];
  recent: { id: number; pickup_address: string; dropoff_address: string; final_price: number | string | null;
    completed_at: string; payment_method: string | null; tariff_name: string | null }[];
};

export function useEarnings(enabled = true) {
  return useQuery({
    queryKey: qk.earnings,
    queryFn: () => api<Earnings>('/drivers/me/earnings'),
    enabled,
  });
}

// ── Po'puti ──
export type Trip = {
  id: number;
  from_address: string;
  to_address: string;
  departure_at: string;
  seats_total: number;
  seats_available: number;
  price_per_seat: string | number;
  status: 'active' | 'full' | 'departed' | 'completed' | 'cancelled';
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
  pending_bookings?: number;
  note?: string | null;
};

export type Booking = {
  id: number;
  seats: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  first_name: string;
  last_name: string | null;
  passenger_rating: string | number | null;
  contact_phone: string | null;
  pickup_note: string | null;
};

export const tripKeys = { my: ['trips-my'] as const, one: (id: number) => ['trip', id] as const };

export function useMyTrips() {
  return useQuery({ queryKey: tripKeys.my, queryFn: () => api<Trip[]>('/carpool/trips/my') });
}

export function useTrip(id: number) {
  return useQuery({ queryKey: tripKeys.one(id), queryFn: () => api<Trip & { bookings?: Booking[] }>(`/carpool/trips/${id}`) });
}

// ── Yuk / texnika so'rovlari ──
export type ServiceRequest = {
  id: number;
  service_type: 'cargo' | 'equipment';
  vehicle_category: string | null;
  title: string | null;
  description: string | null;
  from_address: string;
  from_lat: string | number;
  from_lng: string | number;
  to_address: string | null;
  scheduled_at: string | null;
  budget: string | number | null;
  estimated_price: string | number | null;
  distance_km?: number | null;
  status: string;
  client_name: string;
  client_rating: string | number | null;
  weight_kg?: number | null;
  work_volume?: string | null;
  my_offer_status?: string | null;
  my_offer_price?: string | number | null;
  match_score?: number;
};

export type MyOffer = { id: number; price: string | number; status: string; message: string | null; vehicle_id: number };

export const reqKeys = {
  feed: ['req-feed'] as const,
  jobs: ['req-jobs'] as const,
  one: (id: number) => ['req', id] as const,
};

export function useRequestFeed() {
  return useQuery({
    queryKey: reqKeys.feed,
    queryFn: () => api<{ vehicles: { id: number; category: string; model: string; plate_number: string | null }[]; requests: ServiceRequest[]; hint: string | null }>('/requests/feed'),
  });
}

export function useJobs() {
  return useQuery({
    queryKey: reqKeys.jobs,
    queryFn: () => api<{ jobs: ServiceRequest[]; pending_offers: (MyOffer & { request_id: number; title: string | null; service_type: string; from_address: string })[] }>('/requests/jobs'),
  });
}

export function useRequest(id: number) {
  return useQuery({
    queryKey: reqKeys.one(id),
    queryFn: () => api<ServiceRequest & { my_offer: MyOffer | null; is_provider: boolean; client_phone?: string | null; work_volume?: string | null }>(`/requests/${id}`),
  });
}
