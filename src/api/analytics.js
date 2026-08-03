import apiClient from './client';

export const productAnalyticsAPI = {
  summary: (params = {}) => apiClient.get('/analytics/summary/', { params }),
};
