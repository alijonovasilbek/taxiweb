import { create } from 'zustand';

export const useRideStore = create((set) => ({
  pendingOrder: null,
  activeRide: null,
  isOnline: false,

  setPendingOrder: (order) => set({ pendingOrder: order }),
  clearPending: () => set({ pendingOrder: null }),
  setActiveRide: (ride) => set({ activeRide: ride }),
  clearRide: () => set({ activeRide: null }),
  setOnline: (v) => set({ isOnline: v }),
}));
