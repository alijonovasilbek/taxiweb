import { create } from 'zustand';
import api from '../services/api';

export const useUserStore = create((set, get) => ({
  token: localStorage.getItem('taxigo_token'),
  user: null,
  isLoading: false,
  error: null,

  login: async (initData) => {
    set({ isLoading: true, error: null });
    try {
      let data;
      if (initData === 'dev_mock') {
        // Lokal ishlab chiqish: backend DEV_MODE=true bo'lsa haqiqiy token olinadi
        const tgId = Number(localStorage.getItem('dev_tg_id') || 999999999);
        ({ data } = await api.post('/auth/dev-login', { telegram_id: tgId, role: 'passenger', first_name: 'Test' }));
      } else {
        // Har doim yagona foydalanuvchi tokeni (bitta akkaunt — bir nechta rol)
        ({ data } = await api.post('/auth/verify-telegram', { initData, role: 'passenger' }));
      }
      localStorage.setItem('taxigo_token', data.token);
      set({ token: data.token, user: data.user, isLoading: false });
      get().fetchMe();
    } catch (err) {
      // initData yaroqsiz/eskirgan bo'lsa ham saqlangan token hali ishlashi mumkin — uni sinab ko'ramiz
      if (get().token) {
        set({ isLoading: false, error: null });
        const me = await get().fetchMe();
        if (me) return;
        localStorage.removeItem('taxigo_token');
        set({ token: null });
      }
      const detail = err?.response?.data?.detail;
      set({ isLoading: false, error: typeof detail === 'string' ? detail : null });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/users/me');
      set({ user: data });
      return data;
    } catch (err) {
      if (!get().user) {
        const detail = err?.response?.data?.detail;
        set({ error: typeof detail === 'string' ? detail : "Server bilan aloqa yo'q" });
      }
      return null;
    }
  },

  setUser: (user) => set({ user }),
  hasRole: (role) => Boolean(get().user?.roles?.includes(role)),
}));
