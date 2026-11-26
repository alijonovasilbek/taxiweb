import { useQuery } from '@tanstack/react-query';

import { appVersion } from '../lib/device';
import { api } from './client';

export type Section = 'taxi' | 'carpool' | 'requests';

export type ProviderHome = {
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
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  missing_docs?: { code: string; name: string }[];
};

export function useMyVehicles() {
  return useQuery({ queryKey: qk.vehicles, queryFn: () => api<Vehicle[]>('/vehicles/my') });
}

export type AppSession = { id: number; device_id: string; device_name: string | null; last_used_at: string; current: boolean };

export function useSessions() {
  return useQuery({ queryKey: qk.sessions, queryFn: () => api<AppSession[]>('/auth/app/sessions') });
}
