import apiClient from './client';

export const subscriptionTypesAPI = {
  list: (params) => apiClient.get('/subscription/subscription-types/', { params }),
  get: (id) => apiClient.get(`/subscription/subscription-types/${id}/`),
  create: (data) => apiClient.post('/subscription/subscription-types/', data),
  update: (id, data) => apiClient.patch(`/subscription/subscription-types/${id}/`, data),
  delete: (id) => apiClient.delete(`/subscription/subscription-types/${id}/`),
};

export const activationCodesAPI = {
  list: (params) => apiClient.get('/subscription/activation-codes/', { params }),
  get: (id) => apiClient.get(`/subscription/activation-codes/${id}/`),
  create: (data) => apiClient.post('/subscription/activation-codes/', data),
  update: (id, data) => apiClient.patch(`/subscription/activation-codes/${id}/`, data),
  delete: (id) => apiClient.delete(`/subscription/activation-codes/${id}/`),
};
