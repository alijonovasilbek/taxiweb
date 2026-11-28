import { create } from 'zustand';

/** Backend `new_order` hodisasi (order_service._order_payload) */
export type Offer = {
  order_id: number;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  distance_km: number;
  duration_min: number;
  price: number;
  payment_method: string;
  passenger_rating: number;
  timeout: number;
  distance_to_pickup_km?: number;
  tariff_name?: string | null;
};

type OfferState = {
  offer: (Offer & { expiresAt: number }) | null;
  /** Bir xil taklif socket va (keyinroq) push orqali ikki marta kelsa — bitta ekran (PLAN-ANDROID §7) */
  seen: Set<number>;
  show: (o: Offer) => boolean;
  close: (orderId?: number) => void;
};

export const useOffer = create<OfferState>((set, get) => ({
  offer: null,
  seen: new Set(),
  show: (o) => {
    if (get().seen.has(o.order_id)) return false;
    get().seen.add(o.order_id);
    set({ offer: { ...o, expiresAt: Date.now() + (o.timeout || 15) * 1000 } });
    return true;
  },
  close: (orderId) => {
    const cur = get().offer;
    if (!cur || orderId === undefined || cur.order_id === orderId) set({ offer: null });
  },
}));
