import apiClient from './client';

// Коды Apple (offer codes) — только глобальная версия, iPhone. Сервер —
// AspectumAPI IAPurchasesAPI (docs/APPLE_OFFER_CODES.md).
export const appleCodesAdminAPI = {
  overview: () => apiClient.get('/iap/admin/apple-codes/'),
  createProduct: (subscriptionTypeId, attachExisting = false) =>
    apiClient.post('/iap/admin/apple-codes/', {
      subscription_type_id: subscriptionTypeId,
      attach_existing: attachExisting,
    }),
  refreshProduct: (id) => apiClient.post(`/iap/admin/apple-codes/products/${id}/refresh`),
  createOffer: (data) => apiClient.post('/iap/admin/apple-codes/offers/', data),
  deactivateOffer: (id) => apiClient.patch(`/iap/admin/apple-codes/offers/${id}/`, { is_active: false }),
  createBatch: (offerId, data) => apiClient.post(`/iap/admin/apple-codes/offers/${offerId}/batches/`, data),
  downloadCodes: (batchId) =>
    apiClient.get(`/iap/admin/apple-codes/batches/${batchId}/codes.csv`, { responseType: 'blob' }),
};
