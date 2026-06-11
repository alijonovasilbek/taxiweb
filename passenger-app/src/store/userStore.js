import { create } from 'zustand';
import api from '../services/api';

export const useUserStore = create((set) => ({
  token: localStorage.getItem('taxigo_token'),
  user: null,
  isLoading: false,

  login: async (initData) => {
    set({ isLoading: true });
    if (initData === 'dev_mock') {
      const mockUser = { id: 1, first_name: 'Test', last_name: 'User', username: 'testuser', rating: '5.00', total_rides: 0 };
      localStorage.setItem('taxigo_token', 'dev_token');
      set({ token: 'dev_token', user: mockUser, isLoading: false });
      return;
    }
    try {
      const { data } = await api.post('/auth/verify-telegram', { initData });
      localStorage.setItem('taxigo_token', data.token);
      if (data.role === 'driver') {
        localStorage.setItem('taxigo_driver_token', data.token);
        window.location.replace('/driver/');
        return;
      }
      if (data.role === 'admin') {
        localStorage.setItem('taxigo_admin_token', data.token);
        window.location.replace('/admin/');
        return;
      }
      set({ token: data.token, user: data.user, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/users/me');
      set({ user: data });
    } catch {}
  },
}));
