import { create } from 'zustand';
import api from '../services/api';

export const useDriverStore = create((set) => ({
  token: localStorage.getItem('taxigo_driver_token'),
  driver: null,
  isLoading: false,

  login: async (login, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/driver-login', { login, password });
      localStorage.setItem('taxigo_driver_token', data.token);
      set({ token: data.token, driver: data.driver, isLoading: false });
      return { success: true };
    } catch (error) {
      localStorage.removeItem('taxigo_driver_token');
      set({ token: null, driver: null, isLoading: false });
      return { success: false, message: error.response?.data?.detail || 'Login yoki parol noto\'g\'ri' };
    }
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/drivers/me');
      set({ driver: data, isLoading: false });
      return data;
    } catch {
      set({ driver: null, isLoading: false });
      return null;
    }
  },

  setSession: (token, driver = null) => {
    if (token) localStorage.setItem('taxigo_driver_token', token);
    else localStorage.removeItem('taxigo_driver_token');
    set({ token, driver });
  },
  clearSession: () => {
    localStorage.removeItem('taxigo_driver_token');
    set({ token: null, driver: null, isLoading: false });
  },
  setDriver: (driver) => set({ driver }),
}));
