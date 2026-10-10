import apiClient from './client';
import { getWorkspace, withWorkspaceParams } from '../utils/workspace';

const BASE = '/generation';

/** App-wide languages from settings.LANGUAGES (tags catalog, forms). */
export const appLanguagesAPI = {
  list: () => apiClient.get(`${BASE}/app-languages/`),
};

// ─── Tags (catalog bulk actions) ─────────────────────────────────────────────
export const tagsAPI = {
  translateSelected: (payload) =>
    apiClient.post(`${BASE}/tags/translate-selected/`, payload),
};

// ─── Workspaces ──────────────────────────────────────────────────────────────
/** Пространства (Россия / Европа / …) для переключателя в боковой панели. */
export const workspacesAPI = {
  list: () => apiClient.get(`${BASE}/workspaces/`),
};

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessionsAPI = {
  // Только сессии текущего пространства (и ещё без страны — чтобы не терялись).
  list: () => apiClient.get(`${BASE}/sessions/`, { params: withWorkspaceParams() }),
  get: (sessionId, config = {}) => apiClient.get(`${BASE}/sessions/${sessionId}/`, config),
  create: (data = {}) => apiClient.post(`${BASE}/sessions/create/`, data),
  close: (sessionId, mode = 'save') => apiClient.post(`${BASE}/sessions/${sessionId}/close/`, { mode }),
  closeAll: () => apiClient.post(`${BASE}/sessions/close-all-my-active/`, {}),
  forceClose: (sessionId) => apiClient.post(`${BASE}/sessions/${sessionId}/force-close/`, {}),
  delete: (sessionId) => apiClient.delete(`${BASE}/sessions/${sessionId}/delete/`),
  publish: (sessionId) => apiClient.post(`${BASE}/sessions/${sessionId}/publish/`, {}),
  translate: (sessionId, data = {}) => apiClient.post(`${BASE}/sessions/${sessionId}/translate/`, data),
  // Бэкенд принимает только POST (тело: {close_batch?: boolean})
  checkConflicts: (sessionId, data = {}) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/publish/check-conflicts/`, data),
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

// ─── Interactive locations ─────────────────────────────────────────────────────
export const interactiveLocationsAPI = {
  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/interactive-locations/`, data),
  get: (sessionId, locationId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/interactive-locations/${locationId}/`),
  update: (sessionId, locationId, data) =>
    apiClient.patch(
      `${BASE}/sessions/${sessionId}/interactive-locations/${locationId}/update/`,
      data,
    ),
  delete: (sessionId, locationId) =>
    apiClient.delete(
      `${BASE}/sessions/${sessionId}/interactive-locations/${locationId}/delete/`,
    ),
};

// ─── Attractions ─────────────────────────────────────────────────────────────
export const attractionsAPI = {
  list: (sessionId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attractions/`),
  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attractions/`, data),
  get: (sessionId, attrId, config = {}) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attractions/${attrId}/`, config),
  update: (sessionId, attrId, data) =>
    apiClient.patch(`${BASE}/sessions/${sessionId}/attractions/${attrId}/update/`, data),
  delete: (sessionId, attrId) =>
    apiClient.delete(`${BASE}/sessions/${sessionId}/attractions/${attrId}/delete/`),
  saveContent: (sessionId, attrId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attractions/${attrId}/content/`, data),
};

export const attractionCommerceAPI = {
  listItinerary: (sessionId, attractionId) => apiClient.get(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/itinerary/`),
  addItinerary: (sessionId, attractionId, data) => apiClient.post(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/itinerary/`, data),
  updateItinerary: (sessionId, attractionId, stepId, data) =>
    apiClient.patch(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/itinerary/${stepId}/`, data),
  deleteItinerary: (sessionId, attractionId, stepId) =>
    apiClient.delete(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/itinerary/${stepId}/`),
  listInclusions: (sessionId, attractionId) => apiClient.get(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/inclusions/`),
  addInclusion: (sessionId, attractionId, data) => apiClient.post(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/inclusions/`, data),
  updateInclusion: (sessionId, attractionId, itemId, data) =>
    apiClient.patch(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/inclusions/${itemId}/`, data),
  deleteInclusion: (sessionId, attractionId, itemId) =>
    apiClient.delete(`${BASE}/sessions/${sessionId}/attractions/${attractionId}/inclusions/${itemId}/`),
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

// ─── Attraction Audio Guides ─────────────────────────────────────────────────
export const attractionAudioGuidesAPI = {
  create: (sessionId, data) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/attraction-audio-guides/`, data),

  get: (sessionId, guideId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/`),

  update: (sessionId, guideId, data) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/update/`,
      data,
    ),

  delete: (sessionId, guideId) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/delete/`,
      {},
    ),

  generatePlan: (sessionId, guideId, payload) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/generate-plan/`,
      payload,
    ),

  generateMainText: (sessionId, guideId, payload) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/generate-main-text/`,
      payload,
    ),

  generateMainTextItem: (sessionId, guideId, payload) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/generate-main-text-item/`,
      payload,
    ),

  generateTrackAudio: (sessionId, guideId, trackId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/tracks/${trackId}/generate-audio/`,
      payload,
    ),

  generateChapteredTrackAudio: (sessionId, guideId, trackId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/tracks/${trackId}/generate-chaptered-audio/`,
      payload,
    ),

  getMissingAudioStatus: (sessionId, params = {}) =>
    apiClient.get(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/generate-missing-audio/`,
      { params },
    ),

  generateMissingAudio: (sessionId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/generate-missing-audio/`,
      payload,
    ),

  regenerateChapterAudio: (sessionId, guideId, trackId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/tracks/${trackId}/regenerate-chapter-audio/`,
      payload,
    ),

  generateTtsStress: (sessionId, guideId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attraction-audio-guides/${guideId}/generate-tts-stress/`,
      payload,
    ),

  buildStressDictionary: (sessionId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/build-stress-dictionary/`,
      payload,
    ),
};

export const ttsAPI = {
  getSettings: () => apiClient.get(`${BASE}/tts/settings/`),
  getElevenLabsSettings: ({ refresh = false } = {}) =>
    apiClient.get(`${BASE}/tts/elevenlabs/settings/`, {
      params: refresh ? { refresh: 1 } : undefined,
      skipApiGetCache: refresh,
    }),
  updateElevenLabsAudioProcessing: (settings) =>
    apiClient.patch(`${BASE}/tts/elevenlabs/audio-processing/`, { settings }),
  updateAudioProcessing: (settings) =>
    apiClient.patch(`${BASE}/tts/audio-processing/`, { settings }),
};

// ─── Audio uploads / streaming ───────────────────────────────────────────────
const generationAudioFilePath = (audioId) =>
  `${BASE}/audio/${encodeURIComponent(String(audioId ?? '').trim())}/file/`;

export const audioAPI = {
  upload: (formData) =>
    apiClient.post(`${BASE}/audio/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Authenticated binary GET (JWT via apiClient). Prefer over raw `/media/...` in <audio>. */
  getBlobByAudioId: (audioId) =>
    apiClient.get(generationAudioFilePath(audioId), {
      responseType: 'blob',
      skipApiGetCache: true,
      params: { _: Date.now() },
    }),

  /**
   * Fetch audio as blob: plain UUID, or URL/path containing `/generation/audio/<uuid>/file/`.
   * Direct `/media/session/...` URLs are not supported here (use audio id from the track).
   */
  getBlob: (audioUrlOrId) => {
    const raw = String(audioUrlOrId ?? '').trim();
    if (!raw) {
      return Promise.reject(new Error('Empty audio reference'));
    }
    const fromPath = raw.match(/\/generation\/audio\/([0-9a-f-]{36})\/file\/?/i);
    if (fromPath) {
      return apiClient.get(generationAudioFilePath(fromPath[1]), {
        responseType: 'blob',
        skipApiGetCache: true,
        params: { _: Date.now() },
      });
    }
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      return apiClient.get(generationAudioFilePath(raw), {
        responseType: 'blob',
        skipApiGetCache: true,
        params: { _: Date.now() },
      });
    }
    return Promise.reject(new Error('Unsupported audio reference for authenticated fetch'));
  },
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
  create: (data) => apiClient.post(`${BASE}/cities/create/`, data),
  get: (cityId) => apiClient.get(`${BASE}/cities/${cityId}/`),
  update: (cityId, data) => apiClient.patch(`${BASE}/cities/${cityId}/update/`, data),
  delete: (cityId) => apiClient.delete(`${BASE}/cities/${cityId}/delete/`),
  exportJson: () =>
    apiClient.get(`${BASE}/cities/export/`, { responseType: 'blob' }),
  listUsefulInformation: (cityId) =>
    apiClient.get(`${BASE}/cities/${cityId}/useful-information/`),
  createUsefulInformation: (cityId, data) =>
    apiClient.post(`${BASE}/cities/${cityId}/useful-information/`, data),
  updateUsefulInformation: (cityId, infoId, data) =>
    apiClient.patch(`${BASE}/cities/${cityId}/useful-information/${infoId}/`, data),
  deleteUsefulInformation: (cityId, infoId) =>
    apiClient.delete(`${BASE}/cities/${cityId}/useful-information/${infoId}/`),
  // CityAPI list (used in CitiesCatalog)
  list: (params) => apiClient.get('/city/list', { params }),
};

// ─── Admin utilities ─────────────────────────────────────────────────────────
export const adminAPI = {
  calculateNearestEvents: (cityId) =>
    apiClient.get(
      cityId
        ? `/admin/calculate-nearest-events/${cityId}`
        : '/admin/calculate-nearest-events',
    ),
};

// ─── IAP admin (city product sync) ─────────────────────────────────────────────
export const iapAdminAPI = {
  syncCity: (cityId) => apiClient.post(`/iap/admin/cities/${cityId}/sync`),
  bulkSync: (cityIds) =>
    apiClient.post('/iap/admin/cities/bulk-sync/', {
      city_ids: cityIds?.length ? cityIds : undefined,
    }),
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
    apiClient.get('media/commons/search/', {
      params: { q: query, limit, page },
    }),
  importCommons: (data) =>
    apiClient.post('media/commons/import/', data),
  // «Библиотека»: все источники конвейера одним запросом (best + по источникам)
  photoLibrary: (params) =>
    apiClient.get(`${BASE}/photo-library/`, { params }),
};

// ─── Generation Tasks ─────────────────────────────────────────────────────────
export const tasksAPI = {
  list: () => apiClient.get(`${BASE}/tasks/`),
  get: (taskId) => apiClient.get(`${BASE}/tasks/${taskId}/`),
};

// ─── City Filters ─────────────────────────────────────────────────────────────
// Canonical REST (CityAPI) — same store as Session Wizard / static reference JS
export const cityFiltersAPI = {
  getTree: () => apiClient.get('/city/filters/tree/'),
  /** Flat list; default backend: type=tag, is_show=true. Pass all=1 to include hidden. */
  getTags: (params = {}) =>
    apiClient.get('/city/filters/', { params: { type: 'tag', ...params } }),
  get: (id) => apiClient.get(`/city/filters/${id}/`),
  create: (payload) => apiClient.post('/city/filters/', payload),
  update: (id, payload) => apiClient.patch(`/city/filters/${id}/`, payload),
  delete: (id) => apiClient.delete(`/city/filters/${id}/`),
};

// ─── Event Filters ────────────────────────────────────────────────────────────
function withFolderWorkspace(payload) {
  const code = getWorkspace();
  if (!code || !payload || payload.type !== 'folder' || 'workspace' in payload) return payload;
  return { ...payload, workspace: code };
}

// Canonical CRUD + tree (EventsAPI) — same store as Session Wizard / static reference JS
export const eventFiltersAPI = {
  // Теги текущего пространства и общие; у папки в ответе поле workspace.
  getTree: () => apiClient.get('/events/filters/tree/', { params: withWorkspaceParams() }),
  get: (id) => apiClient.get(`/events/filters/${id}/`),
  // Новая папка попадает в текущее пространство, если его не указали явно.
  create: (payload) => apiClient.post('/events/filters/', withFolderWorkspace(payload)),
  update: (id, payload) => apiClient.patch(`/events/filters/${id}/`, payload),
  delete: (id) => apiClient.delete(`/events/filters/${id}/`),
};

// ─── Content authors (EventsAPI) ────────────────────────────────────────────
export const contentAuthorsAPI = {
  list: () => apiClient.get('/events/authors/'),
  create: (payload) => apiClient.post('/events/authors/', payload),
  update: (id, payload) => apiClient.patch(`/events/authors/${id}/`, payload),
  delete: (id) => apiClient.delete(`/events/authors/${id}/`),
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
  /** Session Wizard: AI batch attractions inside existing session */
  attractionsJsonStart: (data) =>
    apiClient.post(`${BASE}/ai/attractions-json/start/`, data),
  attractionsCreateFromTask: (taskId, payload = {}) =>
    apiClient.post(`${BASE}/ai/attractions-json/tasks/${taskId}/create-attractions/`, payload),
  interactiveLocationsJsonStart: (data) =>
    apiClient.post(`${BASE}/ai/interactive-locations-json/start/`, data),
  interactiveLocationsCreateFromTask: (taskId, payload = {}) =>
    apiClient.post(
      `${BASE}/ai/interactive-locations-json/tasks/${taskId}/create-interactive-locations/`,
      payload,
    ),
  cityInfoJsonStart: (data) =>
    apiClient.post(`${BASE}/ai/city-info-json/start/`, data),
  cityInfoCreateFromTask: (taskId, payload = {}) =>
    apiClient.post(`${BASE}/ai/city-info-json/tasks/${taskId}/create-city-info/`, payload),
  attractionInfoJsonStart: (data) =>
    apiClient.post(`${BASE}/ai/attraction-info-json/start/`, data),
  attractionInfoCreateFromTask: (taskId, payload = {}) =>
    apiClient.post(
      `${BASE}/ai/attraction-info-json/tasks/${taskId}/create-attraction-info/`,
      payload,
    ),
  /**
   * Оркестратор «Сгенерировать город целиком» — одно действие.
   * Возвращает { task_id } родительской задачи; поллить как обычную задачу
   * (result_data.summary = { children_total, children_done, children_failed }).
   * payload: { prompt, lang?, attractions_count?, city_info_count?,
   *            attraction_info_count?, provider?, generation_mode?, use_web_search? }
   */
  generateCityFull: (sessionId, payload = {}) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/generate-city-full/`, payload),
  /** Последняя задача «город целиком» (для resume после обновления страницы). */
  cityFullActive: (sessionId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/generate-city-full/active/`),
  /** Кнопка «Стоп»: останавливает активную генерацию города. */
  cityFullCancel: (sessionId) =>
    apiClient.post(`${BASE}/sessions/${sessionId}/generate-city-full/cancel/`),
  /** Ф2: перегенерация описания одной достопримечательности. */
  regenerateAttractionDetail: (sessionId, attrId, payload = {}) =>
    apiClient.post(
      `${BASE}/sessions/${sessionId}/attractions/${attrId}/regenerate-detail/`,
      payload,
    ),
  /** Совокупная стоимость AI-генерации в рамках сессии (город + перегенерации). */
  sessionGenerationCost: (sessionId) =>
    apiClient.get(`${BASE}/sessions/${sessionId}/generation-cost/`),
  /** Вкладка «Промпты»: базовые промпты/правила генерации. */
  listPrompts: () => apiClient.get(`${BASE}/ai/prompts/`),
  savePrompt: (key, text) => apiClient.post(`${BASE}/ai/prompts/${key}/`, { text }),
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
  listExternalProducts: (params) =>
    apiClient.get(`${BASE}/events/external-products/reference/`, { params }),
  setExternalProduct: (eventId, externalProductId, options = {}) =>
    apiClient.post(`${BASE}/events/${eventId}/external-product/`, {
      external_product_id: externalProductId,
      ...(typeof options.syncEventContent === 'boolean' ? { sync_event_content: options.syncEventContent } : {}),
    }),
  createEventFromExternalProduct: (productId) =>
    apiClient.post(`${BASE}/events/external-products/${productId}/create-event/`, {}),
  listEventCandidatesForExternalProduct: (productId, params) =>
    apiClient.get(`${BASE}/events/external-products/${productId}/event-candidates/`, { params }),
  listInformation: (eventId) =>
    apiClient.get(`${BASE}/events/${eventId}/information/`),
  createInformation: (eventId, data) =>
    apiClient.post(`${BASE}/events/${eventId}/information/`, data),
  updateInformation: (eventId, infoId, data) =>
    apiClient.patch(`${BASE}/events/${eventId}/information/${infoId}/`, data),
  deleteInformation: (eventId, infoId) =>
    apiClient.delete(`${BASE}/events/${eventId}/information/${infoId}/`),
  listFeed: (eventId) =>
    apiClient.get(`${BASE}/events/${eventId}/feed/`),
  createFeedItem: (eventId, data) =>
    apiClient.post(`${BASE}/events/${eventId}/feed/`, data),
  updateFeedItem: (eventId, feedId, data) =>
    apiClient.patch(`${BASE}/events/${eventId}/feed/${feedId}/`, data),
  deleteFeedItem: (eventId, feedId) =>
    apiClient.delete(`${BASE}/events/${eventId}/feed/${feedId}/`),
  // Shop-only content (BookingAPI.EventItineraryStep/EventInclusion) — see ARCHITECTURE.md.
  listItinerary: (eventId) =>
    apiClient.get(`${BASE}/events/${eventId}/itinerary/`),
  createItineraryStep: (eventId, data) =>
    apiClient.post(`${BASE}/events/${eventId}/itinerary/`, data),
  updateItineraryStep: (eventId, stepId, data) =>
    apiClient.patch(`${BASE}/events/${eventId}/itinerary/${stepId}/`, data),
  deleteItineraryStep: (eventId, stepId) =>
    apiClient.delete(`${BASE}/events/${eventId}/itinerary/${stepId}/`),
  listInclusions: (eventId) =>
    apiClient.get(`${BASE}/events/${eventId}/inclusions/`),
  createInclusion: (eventId, data) =>
    apiClient.post(`${BASE}/events/${eventId}/inclusions/`, data),
  updateInclusion: (eventId, itemId, data) =>
    apiClient.patch(`${BASE}/events/${eventId}/inclusions/${itemId}/`, data),
  deleteInclusion: (eventId, itemId) =>
    apiClient.delete(`${BASE}/events/${eventId}/inclusions/${itemId}/`),
  filtersReference: () =>
    apiClient.get(`${BASE}/events/filters-reference/`, { params: withWorkspaceParams() }),
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

export const eventAudioGuidesAPI = {
  list: (eventId) =>
    apiClient.get(`${BASE}/event-audio-guides/`, { params: eventId ? { event_id: eventId } : {} }),
  create: (data) => apiClient.post(`${BASE}/event-audio-guides/`, data),
  update: (guideId, data) =>
    apiClient.patch(`${BASE}/event-audio-guides/${guideId}/`, data),
  delete: (guideId) => apiClient.delete(`${BASE}/event-audio-guides/${guideId}/`),
  upsertTrack: (guideId, data) =>
    apiClient.post(`${BASE}/event-audio-guides/${guideId}/tracks/`, data),
  deleteTrack: (guideId, trackId) =>
    apiClient.delete(`${BASE}/event-audio-guides/${guideId}/tracks/${trackId}/delete/`),
};

export const ilCatalogAPI = {
  list: (params) => apiClient.get(`${BASE}/interactive-locations/`, { params }),
  create: (data) => apiClient.post(`${BASE}/interactive-locations/`, data),
  update: (id, data) => apiClient.patch(`${BASE}/interactive-locations/${id}/`, data),
  delete: (id) => apiClient.delete(`${BASE}/interactive-locations/${id}/`),
};

export const ilPhotosAPI = {
  list: (cityId) => apiClient.get(`${BASE}/cities/${cityId}/il-photos/`),
  create: (cityId, data) => apiClient.post(`${BASE}/cities/${cityId}/il-photos/`, data),
  update: (cityId, photoId, data) => apiClient.patch(`${BASE}/cities/${cityId}/il-photos/${photoId}/`, data),
  remove: (cityId, photoId) => apiClient.delete(`${BASE}/cities/${cityId}/il-photos/${photoId}/`),
};
