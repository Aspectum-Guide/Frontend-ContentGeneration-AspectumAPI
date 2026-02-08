import axios from 'axios';

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
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
