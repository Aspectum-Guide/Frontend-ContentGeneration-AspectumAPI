import axios from 'axios';

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерсептор для добавления JWT токена
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерсептор для обработки ошибок
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Токен истек
      localStorage.removeItem('access_token');
      // Редирект на логин отключен (работаем без авторизации)
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
