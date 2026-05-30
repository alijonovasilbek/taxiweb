import { create } from 'zustand';
import api from '../services/api';

export const useDriverStore = create((set) => ({
  token: localStorage.getItem('taxigo_driver_token'),
  driver: null,
  isLoading: false,

  login: async (initData) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/verify-telegram', { initData, role: 'driver' });
      localStorage.setItem('taxigo_driver_token', data.token);
      set({ token: data.token, driver: data.driver, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/drivers/me');
      set({ driver: data });
    } catch {}
  },

  setDriver: (driver) => set({ driver }),
}));
