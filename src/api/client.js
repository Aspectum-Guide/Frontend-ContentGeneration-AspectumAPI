import axios from 'axios';
import TokenManager from '../utils/TokenManager';

// Определяем базовый URL для API
// В Vite переменные окружения доступны через import.meta.env
// Используем VITE_API_URL или адрес API сервера по умолчанию
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://dev2.aspectum-guide.com/api/v1';

console.log('🔧 API Client initialized with baseURL:', API_BASE_URL);

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Отправляем cookies для аутентификации
});

// Simple in-memory cache and in-flight dedupe for GET requests to reduce 429
const inFlightRequests = new Map();
const responseCache = new Map();
const CACHE_TTL = 2000; // ms
const MAX_429_RETRIES = 3;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Wrap GET to add dedupe/cache/retry behaviour
const originalGet = apiClient.get.bind(apiClient);
apiClient.get = async (url, config = {}) => {
  const paramsKey = config.params ? JSON.stringify(config.params) : '';
  const key = `GET:${url}?${paramsKey}`;

  // Return cached response if fresh
  const cached = responseCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return Promise.resolve(cached.value);
  }

  // If identical request in flight, return the same promise
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  // Make request with retry on 429
  const makeRequest = async () => {
    let attempt = 0;
    while (true) {
      try {
        const resp = await originalGet(url, config);
        // cache shallowly
        responseCache.set(key, { value: resp, expiry: Date.now() + CACHE_TTL });
        return resp;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 429 && attempt < MAX_429_RETRIES) {
          attempt += 1;
          const retryAfter = parseInt(err?.response?.headers?.['retry-after']) || (500 * attempt);
          await sleep(retryAfter);
          continue;
        }
        throw err;
      }
    }
  };

  const promise = makeRequest().finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, promise);
  return promise;
};

// Интерсептор для добавления JWT access токена и CSRF токена
apiClient.interceptors.request.use(
  (config) => {
    const tokens = TokenManager.getTokens();
    if (tokens?.access) {
      // Используем формат "Bearer <access_token>" для JWT
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    
    // Добавляем CSRF токен для POST/PUT/PATCH/DELETE запросов
    const csrfMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (csrfMethods.includes(config.method?.toUpperCase())) {
      // Получаем CSRF токен из cookie (Django устанавливает csrftoken)
      const csrftoken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
      
      if (csrftoken) {
        config.headers['X-CSRFToken'] = csrftoken;
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
      } else {
        console.warn('⚠️ CSRF token not found in cookies!');
      }
    }
    
    console.log('📤 API Request:', {
      method: config.method.toUpperCase(),
      url: config.baseURL + config.url,
      hasToken: !!tokens?.access,
      hasCsrf: !!config.headers['X-CSRFToken'],
    });
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерсептор для обработки ошибок и автоматического обновления токена
apiClient.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', {
      status: response.status,
      url: response.config.baseURL + response.config.url,
      data: response.data,
    });
    return response;
  },
  async (error) => {
    const config = error.config;
    
    console.error('❌ API Error:', {
      status: error.response?.status,
      url: config?.url,
      message: error.message,
      retry: config?._retry,
    });

    // Обработка 401 ошибки - попытка обновить токен и повторить запрос
    if (
      error.response?.status === 401 &&
      !config?._retry &&
      !config?.url?.includes('/auth/token/refresh')
    ) {
      config._retry = true;

      try {
        console.log('🔄 [APIClient] 401 error detected, attempting token refresh...');

        const tokens = TokenManager.getTokens();
        if (!tokens?.refresh) {
          throw new Error('No refresh token available');
        }

        // Попытка обновить токен
        const refreshResult = await TokenManager.refreshTokens(tokens.refresh);

        if (refreshResult.success && refreshResult.data) {
          console.log('✅ [APIClient] Token refresh successful, retrying request');

          // Обновляем заголовок Authorization в оригинальном запросе
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${refreshResult.data.access}`;

          // Повторяем оригинальный запрос с новым токеном
          return apiClient(config);
        } else {
          console.log('❌ [APIClient] Token refresh failed:', refreshResult.error);

          // Если refresh токен истек, перенаправляем на страницу входа
          if (refreshResult.isExpired) {
            console.log('🔥 [APIClient] Clearing tokens due to expired refresh');
            TokenManager.clearTokens();
            window.location.href = '/token-auth';
          }

          throw new Error(refreshResult.error || 'Token refresh failed');
        }
      } catch (refreshError) {
        console.error('❌ [APIClient] Token refresh error:', refreshError);
        TokenManager.clearTokens();
        window.location.href = '/token-auth';
        return Promise.reject(refreshError);
      }
    }

    // Если это 401 из самого endpoint refresh, то токены некорректны
    if (error.response?.status === 401 && config?.url?.includes('/auth/token/refresh')) {
      console.log('🚨 [APIClient] 401 from refresh endpoint - forcing logout');
      TokenManager.clearTokens();
      window.location.href = '/token-auth';
    }

    return Promise.reject(error);
  }
);

export default apiClient;
