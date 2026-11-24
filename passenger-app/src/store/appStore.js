import { create } from 'zustand';
import api from '../services/api';

let toastId = 0;

export const useAppStore = create((set, get) => ({
  catalog: null,
  unread: 0,
  toasts: [],

  loadCatalog: async () => {
    if (get().catalog) return get().catalog;
    try {
      const { data } = await api.get('/catalog');
      set({ catalog: data });
      return data;
    } catch {
      return null;
    }
  },

  category: (code) => get().catalog?.vehicle_categories?.find((c) => c.code === code),
  categoriesFor: (service) => (get().catalog?.vehicle_categories || []).filter((c) => c.services.includes(service)),

  refreshUnread: async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      set({ unread: data.unread });
    } catch {}
  },
  setUnread: (n) => set({ unread: n }),
  incUnread: () => set((s) => ({ unread: s.unread + 1 })),

  toast: (title, message = '', type = 'info', link = null) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, title, message, type, link }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
