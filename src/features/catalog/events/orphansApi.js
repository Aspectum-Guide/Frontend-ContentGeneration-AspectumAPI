import apiClient from '../../../api/client';

const BASE = '/generation/events';

export const orphanEventsAPI = {
  listOrphans: (params) => apiClient.get(`${BASE}/orphans/`, { params }),
  listArchived: (params) => apiClient.get(`${BASE}/archived/`, { params }),
  assignCity: (id, cityId) => apiClient.post(`${BASE}/${id}/assign-city/`, { city_id: cityId }),
  archive: (id) => apiClient.post(`${BASE}/${id}/archive/`, {}),
  restore: (id) => apiClient.post(`${BASE}/${id}/restore/`, {}),
  purge: (id) => apiClient.post(`${BASE}/${id}/purge/`, {}),
};
