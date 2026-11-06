import apiClient from './client';

/**
 * Справочники, которые есть и на студии, и на боевой ноде.
 * Не ходить сюда в `/generation/`: на serve этого префикса нет.
 */
export const staffCatalogAPI = {
  languages: () => apiClient.get('/languages/'),
  workspaces: () => apiClient.get('/city/workspaces/'),
  events: (params = {}) => apiClient.get('/events/staff-catalog/', { params }),
  /** Иконка тега. Поле multipart — `image`, как у MediaAPI ImageViewSet. */
  uploadImage: (file) => {
    const body = new FormData();
    body.append('image', file);
    return apiClient.post('/media/images/', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

/** Все страницы staff-каталога событий. Скрытые события включены, архив нет. */
export async function listAllStaffEvents(params = {}, pageSize = 200) {
  const events = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await staffCatalogAPI.events({ ...params, page, page_size: pageSize });
    const data = response?.data;
    const list = Array.isArray(data?.events) ? data.events : [];
    events.push(...list);
    totalPages = Number(data?.total_pages) || 1;
    if (!list.length) break;
    page += 1;
  }

  return events;
}
