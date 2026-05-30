import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taxigo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const token = localStorage.getItem('taxigo_token');
    if (err.response?.status === 401 && token !== 'dev_token') {
      localStorage.removeItem('taxigo_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;
