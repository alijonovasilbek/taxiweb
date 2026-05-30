import { create } from 'zustand';
import api from '../services/api';

export const useOrderStore = create((set, get) => ({
  activeOrder: null,
  driver: null,
  driverLocation: null,

  createOrder: async ({ pickup, dropoff, paymentMethod }) => {
    const { data } = await api.post('/orders', { pickup, dropoff, paymentMethod });
    set({ activeOrder: data });
    return data;
  },

  fetchActive: async () => {
    try {
      const { data } = await api.get('/orders/active');
      set({ activeOrder: data });
    } catch {}
  },

  setDriverLocation: (loc) => set({ driverLocation: loc }),
  setDriver: (driver) => set({ driver }),
  setActiveOrder: (order) => set({ activeOrder: order }),
  clear: () => set({ activeOrder: null, driver: null, driverLocation: null }),
}));
