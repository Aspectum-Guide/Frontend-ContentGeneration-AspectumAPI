import apiClient from './client';

const BASE = '/generation';

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessionsAPI = {
  list: () => apiClient.get(`${BASE}/sessions/`),
  get: (sessionId) => apiClient.get(`${BASE}/sessions/${sessionId}/`),
  create: (data = {}) => apiClient.post(`${BASE}/sessions/create/`, data),
  close: (sessionId, mode = 'save') => apiClient.post(`${BASE}/sessions/${sessionId}/close/`, { mode }),
  closeAll: () => apiClient.post(`${BASE}/sessions/close-all-my-active/`, {}),
  forceClose: (sessionId) => apiClient.post(`${BASE}/sessions/${sessionId}/force-close/`, {}),
  delete: (sessionId) => apiClient.delete(`${BASE}/sessions/${sessionId}/delete/`),
  publish: (sessionId) => apiClient.post(`${BASE}/sessions/${sessionId}/publish/`, {}),
  translate: (sessionId, data = {}) => apiClient.post(`${BASE}/sessions/${sessionId}/translate/`, data),
  checkConflicts: (sessionId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/publish/check-conflicts/`),
  updateCity: (sessionId, data) =>
    apiClient.patch(`${BASE}/sessions/${sessionId}/city/`, data),
  createCityDraft: (sessionId, data = {}) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/city-drafts/`, data),
  deleteCityDraft: (sessionId, draftId) =>
    apiClient.delete(`${BASE}/sessions/${sessionId}/city-drafts/${draftId}/delete/`),
  setPrimaryCityDraft: (sessionId, draftId) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/city-drafts/${draftId}/primary/`, {}),
  uploadFromFile: (jsonText) =>
    apiClient.post(`${BASE}/sessions/upload/`, jsonText, {
      headers: { 'Content-Type': 'application/json' },
    }),
};

// ─── Attractions ─────────────────────────────────────────────────────────────
export const attractionsAPI = {
  list: (sessionId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attractions/`),
  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attractions/`, data),
  get: (sessionId, attrId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attractions/${attrId}/`),
  update: (sessionId, attrId, data) =>
    apiClient.patch(`${BASE}/sessions/${sessionId}/attractions/${attrId}/update/`, data),
  delete: (sessionId, attrId) =>
    apiClient.delete(`${BASE}/sessions/${sessionId}/attractions/${attrId}/delete/`),
  saveContent: (sessionId, attrId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attractions/${attrId}/content/`, data),
};

// ─── Attraction Useful Info ─────────────────────────────────────────────────
export const attractionInfosAPI = {
  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attraction-info/`, data),

  get: (sessionId, attractionInfoId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attraction-info/${attractionInfoId}/`),

  update: (sessionId, attractionInfoId, data) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-info/${attractionInfoId}/update/`,
      data
    ),

  delete: (sessionId, attractionInfoId) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-info/${attractionInfoId}/delete/`,
      {}
    ),
};

// ─── EventsAPI / published attractions ───────────────────────────────────────
export const referenceAttractionsAPI = {
  list: (params = {}) => apiClient.get('/events/', { params }),
};

// ─── Attraction Feed Items ───────────────────────────────────────────────────
export const attractionFeedAPI = {
  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attraction-feed/`, data),

  get: (sessionId, itemId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attraction-feed/${itemId}/`),

  update: (sessionId, itemId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attraction-feed/${itemId}/update/`, data),

  delete: (sessionId, itemId) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attraction-feed/${itemId}/delete/`, {}),
};

// ─── City Useful Info ────────────────────────────────────────────────────────
export const cityInfosAPI = {
  list: (sessionId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/city-info/`),

  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/city-info/`, data),

  get: (sessionId, cityInfoId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/city-info/${cityInfoId}/`),

  update: (sessionId, cityInfoId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/city-info/${cityInfoId}/update/`, data),

  delete: (sessionId, cityInfoId) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/city-info/${cityInfoId}/delete/`, {}),
};

// ─── Cities (reference) ───────────────────────────────────────────────────────
export const citiesAPI = {
  get: (cityId) => apiClient.get(`${BASE}/cities/${cityId}/`),
  update: (cityId, data) => apiClient.patch(`${BASE}/cities/${cityId}/update/`, data),
  delete: (cityId) => apiClient.delete(`${BASE}/cities/${cityId}/delete/`),
  exportJson: () =>
    apiClient.get(`${BASE}/cities/export/`, { responseType: 'blob' }),
  // CityAPI list (used in EventGeneration, CitiesCatalog)
  list: (params) => apiClient.get('/city/list', { params }),
};

// ─── Images ──────────────────────────────────────────────────────────────────
export const imagesAPI = {
  upload: (formData) =>
    apiClient.post(`${BASE}/image/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  get: (imageId) => apiClient.get(`${BASE}/images/${imageId}/`),
  update: (imageId, data) =>
    apiClient.patch(`${BASE}/images/${imageId}/update/`, data),
  delete: (imageId) => apiClient.delete(`${BASE}/images/${imageId}/delete/`),
  // Wikimedia Commons integration
  searchCommons: (query, limit = 10, page = 1) =>
    apiClient.get(`/media/commons/search/`, {
      params: { q: query, limit, page },
    }),
  importCommons: (data) =>
    apiClient.post(`/media/commons/import/`, data),
};

// ─── Generation Tasks ─────────────────────────────────────────────────────────
export const tasksAPI = {
  list: () => apiClient.get(`${BASE}/tasks/`),
  get: (taskId) => apiClient.get(`${BASE}/tasks/${taskId}/`),
};

// ─── City Filters ─────────────────────────────────────────────────────────────
// Session wizard / tree CRUD (canonical REST under /city/filters/)
export const cityFiltersAPI = {
  getTree: () => apiClient.get('/city/filters/tree/'),
  create: (payload) => apiClient.post('/city/filters/', payload),
  update: (id, payload) => apiClient.patch(`/city/filters/${id}/`, payload),
  delete: (id) => apiClient.delete(`/city/filters/${id}/`),
  list: () => apiClient.get(`${BASE}/city-filters/`),
  get: (filterId) => apiClient.get(`${BASE}/city-filters/${filterId}/`),
  /** Legacy catalog admin paths (TagsFiltersCatalogPage) */
  createLegacy: (data) => apiClient.post(`${BASE}/city-filters/create/`, data),
  updateLegacy: (filterId, data) =>
    apiClient.patch(`${BASE}/city-filters/${filterId}/update/`, data),
  deleteLegacy: (filterId) =>
    apiClient.delete(`${BASE}/city-filters/${filterId}/delete/`),
};

// ─── Event Filters ────────────────────────────────────────────────────────────
export const eventFiltersAPI = {
  list: () => apiClient.get(`${BASE}/event-filters/`),
  get: (filterId) => apiClient.get(`${BASE}/event-filters/${filterId}/`),
  create: (data) => apiClient.post(`${BASE}/event-filters/create/`, data),
  update: (filterId, data) =>
    apiClient.patch(`${BASE}/event-filters/${filterId}/update/`, data),
  delete: (filterId) =>
    apiClient.delete(`${BASE}/event-filters/${filterId}/delete/`),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiAPI = {
  getSettings: () => apiClient.get(`${BASE}/ai/settings/`),
  updateSettings: (data) => apiClient.post(`${BASE}/ai/settings/update/`, data),
  test: (message, search = false) =>
    apiClient.post(`${BASE}/ai/test/`, { message, search }),
  streamStart: (data) => apiClient.post(`${BASE}/ai/stream/start/`, data),
  streamStatus: (streamId) =>
    apiClient.get(`${BASE}/ai/stream/${streamId}/`),
  searchImages: (data) =>
    apiClient.post(`${BASE}/ai/search-images/`, data),
  citiesJsonStart: (data) =>
    apiClient.post(`${BASE}/ai/cities-json/start/`, data),
  citiesTaskCreateSessions: (taskId) =>
    apiClient.post(`${BASE}/ai/cities-json/tasks/${taskId}/create-sessions/`, {}),
  citiesJson: (data) => apiClient.post(`${BASE}/ai/cities-json/`, data),
};

// ─── Events (reference) ───────────────────────────────────────────────────────
export const eventsAPI = {
  list: (params) =>
    apiClient.get(`${BASE}/events/reference/`, { params }),
  create: (data) => apiClient.post(`${BASE}/events/create/`, data),
  get: (eventId) => apiClient.get(`${BASE}/events/${eventId}/`),
  update: (eventId, data) =>
    apiClient.patch(`${BASE}/events/${eventId}/update/`, data),
  delete: (eventId) =>
    apiClient.delete(`${BASE}/events/${eventId}/delete/`),
  setMedia: (eventId, data) =>
    apiClient.post(`${BASE}/events/${eventId}/media/`, data),
  filtersReference: () =>
    apiClient.get(`${BASE}/events/filters-reference/`),
  cities: () => apiClient.get(`${BASE}/events/cities/`),
  generate: (data) => apiClient.post(`${BASE}/events/generate/`, data),
  generateTasks: () => apiClient.get(`${BASE}/events/generate/tasks/`),
  generateStatus: (taskId) =>
    apiClient.get(`${BASE}/events/generate/${taskId}/`),
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const exportAPI = {
  zip: () =>
    apiClient.get(`${BASE}/export/zip/`, { responseType: 'blob' }),
  cities: () =>
    apiClient.get(`${BASE}/cities/export/`, { responseType: 'blob' }),
};

// ─── Import ───────────────────────────────────────────────────────────────────
export const importAPI = {
  fromZip: (formData) =>
    apiClient.post(`${BASE}/import/zip/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  fromSheets: (data) => apiClient.post(`${BASE}/import/sheets/`, data),
  fromSheetsStatus: (params) =>
    apiClient.get(`${BASE}/import/sheets/status/`, { params }),
  events: (formData) =>
    apiClient.post(`${BASE}/events/import/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Legacy exports for SessionWizard / Step1City backward compatibility ──────
// sessionsAPI already exported above
// citiesAPI.get(sessionId) — no longer maps to session cities;
// use sessionsAPI.get(sessionId) and read session.city_data
export { citiesAPI as citiesAPI_legacy };
