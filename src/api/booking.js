import apiClient from './client';

const bookingGet = (url, params = {}, { skipCache = false } = {}) => {
  const { skipApiGetCache, ...query } = params;
  return apiClient.get(url, {
    params: query,
    skipApiGetCache: skipCache || skipApiGetCache === true,
  });
};

/** Типы билетов (global catalog, optional event-compat filter). */
export const ticketTypesAPI = {
  list: (params = {}) => bookingGet('/booking/ticket-types/', params, { skipCache: true }),
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

/** Публичные цены слота (тот же движок, что в приложении). */
export const eventSlotPricingAPI = {
  get: (eventId, params) => apiClient.get(`/booking/events/${eventId}/pricing/`, { params }),
};

export const ticketTypesForceAPI = {
  /**
   * POST /api/v1/booking/force-purge-event-ticket-types/
   * Только вручную: rebind + удаление event-owned TicketType.
   */
  purgeEventTicketTypes: (eventId) =>
    apiClient.post('/booking/force-purge-event-ticket-types/', { event: eventId }),
};

export const bookingAnalyticsAPI = {
  summary: (params) => apiClient.get('/booking/analytics/', { params }),
};
