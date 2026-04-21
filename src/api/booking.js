import apiClient from './client';

export const ticketTypesAPI = {
  list: (params) => apiClient.get('/booking/ticket-types/', { params }),
  get: (ticketTypeId) => apiClient.get(`/booking/ticket-types/${ticketTypeId}/`),
  create: (data) => apiClient.post('/booking/ticket-types/', data),
  update: (ticketTypeId, data) => apiClient.patch(`/booking/ticket-types/${ticketTypeId}/`, data),
  delete: (ticketTypeId) => apiClient.delete(`/booking/ticket-types/${ticketTypeId}/`),
};

export const bookingReferenceAPI = {
  events: (params) => apiClient.get('/events/', { params }),
};
