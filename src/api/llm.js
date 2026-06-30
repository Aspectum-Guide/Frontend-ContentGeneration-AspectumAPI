import apiClient from './client';

export const llmAPI = {
  keys: {
    list: () => apiClient.get('/llm/keys/'),
    create: (data) => apiClient.post('/llm/keys/', data),
    update: (keyId, data) => apiClient.patch(`/llm/keys/${keyId}/`, data),
    delete: (keyId) => apiClient.delete(`/llm/keys/${keyId}/`),
  },

  usage: {
    summary: (params = {}) => apiClient.get('/llm/usage/summary/', { params }),
    logs: (params = {}) => apiClient.get('/llm/usage/logs/', { params }),
  },
};

