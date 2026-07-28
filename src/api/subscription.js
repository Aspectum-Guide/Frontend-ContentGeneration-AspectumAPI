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
  bulkGenerate: (data) => apiClient.post('/subscription/activation-codes/bulk-generate/', data),
};

export const citySubscriptionsAPI = {
  list: (params) => apiClient.get('/subscription/city-subscriptions/', { params }),
  get: (id) => apiClient.get(`/subscription/city-subscriptions/${id}/`),
  create: (data) => apiClient.post('/subscription/city-subscriptions/', data),
  update: (id, data) => apiClient.patch(`/subscription/city-subscriptions/${id}/`, data),
  delete: (id) => apiClient.delete(`/subscription/city-subscriptions/${id}/`),
};

export const subscriptionUsersAdminAPI = {
  list: (params) => apiClient.get('/subscription/admin/users/', { params }),
  get: (id) => apiClient.get(`/subscription/admin/users/${id}/`),
  grantSubscriptionType: (id, data) =>
    apiClient.post(`/subscription/admin/users/${id}/grant-subscription-type/`, data),
  grantAllCities: (id, data) =>
    apiClient.post(`/subscription/admin/users/${id}/grant-all-cities/`, data),
  revokeAllCities: (id) =>
    apiClient.post(`/subscription/admin/users/${id}/revoke-all-cities/`),
};

export const iapPurchasesAdminAPI = {
  list: (params) => apiClient.get('/subscription/admin/iap-purchases/', { params }),
  get: (id) => apiClient.get(`/subscription/admin/iap-purchases/${id}/`),
  update: (id, data) => apiClient.patch(`/subscription/admin/iap-purchases/${id}/`, data),
};

export const codeUsageLogsAPI = {
  list: (params) => apiClient.get('/subscription/code-usage-logs/', { params }),
  get: (id) => apiClient.get(`/subscription/code-usage-logs/${id}/`),
};
