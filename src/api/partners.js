import apiClient from './client';

// Партнёры: управление (только сотрудники) и отчёты, которые видит и сам партнёр.
export const partnersAdminAPI = {
  list: (params) => apiClient.get('/partners/admin/partners/', { params }),
  get: (id) => apiClient.get(`/partners/admin/partners/${id}/`),
  create: (data) => apiClient.post('/partners/admin/partners/', data),
  update: (id, data) => apiClient.patch(`/partners/admin/partners/${id}/`, data),
  invite: (id, email) => apiClient.post(`/partners/admin/partners/${id}/invite/`, { email }),
  revokeMember: (id, memberId) =>
    apiClient.post(`/partners/admin/partners/${id}/members/${memberId}/revoke/`),
  ledger: (id) => apiClient.get(`/partners/admin/partners/${id}/ledger/`),
  addAdjustment: (id, data) => apiClient.post(`/partners/admin/partners/${id}/adjustments/`, data),
  syncRuns: () => apiClient.get('/partners/admin/ledger/sync/'),
  syncNow: () => apiClient.post('/partners/admin/ledger/sync/'),
};

export const partnerReportsAPI = {
  summary: (id, params) => apiClient.get(`/partners/${id}/summary/`, { params }),
  entries: (id, params) => apiClient.get(`/partners/${id}/entries/`, { params }),
  clients: (id) => apiClient.get(`/partners/${id}/clients/`),
  codes: (id) => apiClient.get(`/partners/${id}/codes/`),
  entriesCsv: (id, params) =>
    apiClient.get(`/partners/${id}/entries.csv`, { params, responseType: 'blob' }),
};
