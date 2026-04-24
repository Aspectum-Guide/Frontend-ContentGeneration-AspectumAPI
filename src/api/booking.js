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

export const eventSlotAvailabilitiesAPI = {
  list: (params) => apiClient.get('/booking/slot-availabilities/', { params }),
  get: (id) => apiClient.get(`/booking/slot-availabilities/${id}/`),
  create: (data) => apiClient.post('/booking/slot-availabilities/', data),
  update: (id, data) => apiClient.patch(`/booking/slot-availabilities/${id}/`, data),
  delete: (id) => apiClient.delete(`/booking/slot-availabilities/${id}/`),
};

export const ticketPricesAPI = {
  list: (params) => apiClient.get('/booking/ticket-prices/', { params }),
  get: (id) => apiClient.get(`/booking/ticket-prices/${id}/`),
  create: (data) => apiClient.post('/booking/ticket-prices/', data),
  update: (id, data) => apiClient.patch(`/booking/ticket-prices/${id}/`, data),
  delete: (id) => apiClient.delete(`/booking/ticket-prices/${id}/`),
};

export const bookingReservationsAPI = {
  list: (params) => apiClient.get('/booking/reservations/', { params }),
  get: (id) => apiClient.get(`/booking/reservations/${id}/`),
};
