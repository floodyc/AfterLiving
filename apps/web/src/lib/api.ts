import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  register: (email: string, password: string) =>
    api.post('/api/auth/register', { email, password }),
  magicLink: (email: string) =>
    api.post('/api/auth/magic-link', { email }),
};

export const plansApi = {
  getAll: () => api.get('/api/plans'),
  getOne: (id: string) => api.get(`/api/plans/${id}`),
  create: (data: any) => api.post('/api/plans', data),
  update: (id: string, data: any) => api.patch(`/api/plans/${id}`, data),
  suspend: (id: string) => api.post(`/api/plans/${id}/suspend`),
};

export const messagesApi = {
  getAll: (planId: string) => api.get(`/api/messages?planId=${planId}`),
  getOne: (id: string) => api.get(`/api/messages/${id}`),
  create: (data: any) => api.post('/api/messages', data),
  revoke: (id: string) => api.post(`/api/messages/${id}/revoke`),
  delete: (id: string) => api.delete(`/api/messages/${id}`),
};

export const uploadsApi = {
  getUploadUrl: (messageId: string, metadata: any) =>
    api.post(`/api/uploads/${messageId}/url`, metadata),
  finalize: (messageId: string, encryptedDataKey: string) =>
    api.post('/api/uploads/finalize', { messageId, encryptedDataKey }),
  getDownloadUrl: (messageId: string) =>
    api.get(`/api/uploads/${messageId}/download-url`),
};

export const verifiersApi = {
  getAll: (planId: string) => api.get(`/api/verifiers?planId=${planId}`),
  invite: (data: any) => api.post('/api/verifiers', data),
  accept: (token: string) => api.post('/api/verifiers/accept', { token }),
  decline: (token: string) => api.post('/api/verifiers/decline', { token }),
  revoke: (id: string) => api.post(`/api/verifiers/${id}/revoke`),
};

export const releasesApi = {
  getAll: (planId: string) => api.get(`/api/releases?planId=${planId}`),
  create: (data: any) => api.post('/api/releases', data),
  approve: (data: any) => api.post('/api/releases/approve', data),
};

export const adminApi = {
  getUsers: () => api.get('/api/admin/users'),
  lockUser: (userId: string, locked: boolean) =>
    api.post('/api/admin/users/lock', { userId, locked }),
  getReleases: () => api.get('/api/admin/releases'),
  getRelease: (id: string) => api.get(`/api/admin/releases/${id}`),
  approveRelease: (id: string) => api.post(`/api/admin/releases/${id}/approve`),
  denyRelease: (id: string) => api.post(`/api/admin/releases/${id}/deny`),
  getStats: () => api.get('/api/admin/stats'),
};
