import { QueryClient } from '@tanstack/react-query';

import { ApiError, onSessionChange } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // 401/403/404 — qayta urinish foydasiz
      retry: (n, e) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2,
    },
  },
});

// Chiqishda oldingi foydalanuvchining ma'lumoti keshda qolmasin (KAMCHILIKLAR-ANDROID #7)
onSessionChange((signedIn) => {
  if (!signedIn) queryClient.clear();
});
