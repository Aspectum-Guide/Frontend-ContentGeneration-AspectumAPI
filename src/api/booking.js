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
  bookableEvents: (params) => apiClient.get('/generation/events/reference/', { params: { ...params, is_bookable: true, page_size: 500 } }),
};

export const eventSlotAvailabilitiesAPI = {
  list: (params) => apiClient.get('/booking/slot-availabilities/', { params }),
  get: (id) => apiClient.get(`/booking/slot-availabilities/${id}/`),
  create: (data) => apiClient.post('/booking/slot-availabilities/', data),
  update: (id, data) => apiClient.patch(`/booking/slot-availabilities/${id}/`, data),
  delete: (id) => apiClient.delete(`/booking/slot-availabilities/${id}/`),
  bulkCreate: (data) => apiClient.post('/booking/slot-availabilities/bulk-create/', data),
};

export const ticketPricesAPI = {
  list: (params) => apiClient.get('/booking/ticket-prices/', { params }),
  get: (id) => apiClient.get(`/booking/ticket-prices/${id}/`),
  create: (data) => apiClient.post('/booking/ticket-prices/', data),
  update: (id, data) => apiClient.patch(`/booking/ticket-prices/${id}/`, data),
  delete: (id) => apiClient.delete(`/booking/ticket-prices/${id}/`),
  bulkCreate: (data) => apiClient.post('/booking/ticket-prices/bulk-create/', data),
};

export const bookingReservationsAPI = {
  list: (params) => apiClient.get('/booking/reservations/', { params }),
  get: (id) => apiClient.get(`/booking/reservations/${id}/`),
};

export const eventTicketTypePricesAPI = {
  list: (params) => apiClient.get('/booking/event-ticket-type-prices/', { params }),
  get: (id) => apiClient.get(`/booking/event-ticket-type-prices/${id}/`),
  create: (data) => apiClient.post('/booking/event-ticket-type-prices/', data),
  update: (id, data) => apiClient.patch(`/booking/event-ticket-type-prices/${id}/`, data),
  delete: (id) => apiClient.delete(`/booking/event-ticket-type-prices/${id}/`),
};

export const pricingRulesAPI = {
  list: (params) => apiClient.get('/booking/pricing-rules/', { params }),
  get: (id) => apiClient.get(`/booking/pricing-rules/${id}/`),
  create: (data) => apiClient.post('/booking/pricing-rules/', data),
  update: (id, data) => apiClient.patch(`/booking/pricing-rules/${id}/`, data),
  delete: (id) => apiClient.delete(`/booking/pricing-rules/${id}/`),
};

export const bookingAnalyticsAPI = {
  summary: (params) => apiClient.get('/booking/analytics/', { params }),
};
