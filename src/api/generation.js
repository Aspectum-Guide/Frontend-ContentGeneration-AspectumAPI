import apiClient from './client';

// Сессии генерации
export const sessionsAPI = {
  // Получить список сессий
  list: () => apiClient.get('/generation/sessions/'),
  
  // Получить детали сессии
  get: (sessionId) => apiClient.get(`/generation/sessions/${sessionId}/`),
  
  // Создать новую сессию
  create: (data) => apiClient.post('/generation/sessions/', data),
  
  // Обновить сессию
  update: (sessionId, data) => apiClient.patch(`/generation/sessions/${sessionId}/`, data),
  
  // Удалить сессию
  delete: (sessionId) => apiClient.delete(`/generation/sessions/${sessionId}/`),
  
  // Изменить статус
  changeStatus: (sessionId, status) => 
    apiClient.post(`/generation/sessions/${sessionId}/change_status/`, { status }),
  
  // Получить статистику
  getStats: (sessionId) => 
    apiClient.get(`/generation/sessions/${sessionId}/stats/`),
  
  // Опубликовать город в основную базу
  publish: (sessionId) => 
    apiClient.post(`/generation/ai-settings/publish/`, { session: sessionId }),
};

// Задачи генерации
export const tasksAPI = {
  // Получить задачу
  get: (taskId) => apiClient.get(`/generation/tasks/${taskId}/`),
  
  // Получить задачи сессии
  getBySession: (sessionId) => apiClient.get(`/generation/tasks/?session=${sessionId}`),
};

// Города в сессиях
export const citiesAPI = {
  // Получить город сессии
  get: (sessionId) => apiClient.get(`/generation/cities/?session=${sessionId}`),
  
  // Создать/обновить город
  createOrUpdate: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'name' || key === 'description') {
          formData.append(key, JSON.stringify(data[key]));
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return apiClient.post('/generation/cities/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Генерация города через ИИ
  aiGenerate: (sessionId, cityName, country, provider = null) => {
    const data = {
      session: sessionId,
      city_name: cityName,
      country: country,
    };
    if (provider) {
      data.provider = provider;
    }
    return apiClient.post('/generation/cities/ai-generate/', data);
  },
  
  // Опубликовать город в основную базу
  publish: (sessionId) => apiClient.post('/generation/ai-settings/publish/', { session: sessionId }),
  
  // Обновить город
  update: (cityId, data) => apiClient.patch(`/generation/cities/${cityId}/`, data),
  
  // Удалить город
  delete: (cityId) => apiClient.delete(`/generation/cities/${cityId}/`),
};

// Достопримечательности
export const attractionsAPI = {
  // Получить список достопримечательностей
  list: (sessionId) => apiClient.get(`/generation/attractions/?session=${sessionId}`),
  
  // Получить достопримечательность
  get: (attractionId) => apiClient.get(`/generation/attractions/${attractionId}/`),
  
  // Создать достопримечательность
  create: (data) => apiClient.post('/generation/attractions/', data),
  
  // Обновить достопримечательность
  update: (attractionId, data) => apiClient.patch(`/generation/attractions/${attractionId}/`, data),
  
  // Удалить достопримечательность
  delete: (attractionId) => apiClient.delete(`/generation/attractions/${attractionId}/`),
};

// Контент достопримечательностей
export const contentsAPI = {
  // Получить контент
  list: (attractionId) => apiClient.get(`/generation/contents/?attraction=${attractionId}`),
  
  // Создать контент
  create: (data) => apiClient.post('/generation/contents/', data),
  
  // Обновить контент
  update: (contentId, data) => apiClient.patch(`/generation/contents/${contentId}/`, data),
  
  // Удалить контент
  delete: (contentId) => apiClient.delete(`/generation/contents/${contentId}/`),
};

// Медиафайлы
export const mediaAPI = {
  // Получить медиафайлы
  list: (sessionId, attractionId = null) => {
    let url = `/generation/media/?session=${sessionId}`;
    if (attractionId) url += `&attraction=${attractionId}`;
    return apiClient.get(url);
  },
  
  // Загрузить медиафайл
  upload: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return apiClient.post('/generation/media/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Удалить медиафайл
  delete: (mediaId) => apiClient.delete(`/generation/media/${mediaId}/`),
};
