import axios from 'axios';
import TokenManager from '../utils/TokenManager';

// Определяем базовый URL для API
// В Vite переменные окружения доступны через import.meta.env
// Используем VITE_API_URL или dev-proxy '/api'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const IS_DEV = import.meta.env.DEV;
const CSRF_BOOTSTRAP_URL = '/generation/csrf-token/';

let csrfBootstrapPromise = null;
let csrfTokenCache = '';

if (IS_DEV) {
  console.log('🔧 API Client initialized with baseURL:', API_BASE_URL);
}

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Content-Type': 'application/json',
  },
});

function getCookie(name) {
  if (typeof document === 'undefined') return '';

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const prefix = `${name}=`;
  const matched = cookies.find((cookie) => cookie.startsWith(prefix));
  return matched ? decodeURIComponent(matched.slice(prefix.length)) : '';
}

function isUnsafeMethod(method) {
  return ['post', 'put', 'patch', 'delete'].includes((method || '').toLowerCase());
}

async function ensureCsrfCookie() {
  const existingToken = getCookie('csrftoken') || csrfTokenCache;
  if (existingToken) return existingToken;

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = apiClient
      .get(CSRF_BOOTSTRAP_URL, {
        withCredentials: true,
        headers: { 'X-CSRFToken': undefined },
      })
      .then((response) => {
        const responseToken = response?.data?.csrf_token || '';
        if (responseToken) {
          csrfTokenCache = responseToken;
        }
        return responseToken;
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  const bootstrappedToken = await csrfBootstrapPromise;
  return getCookie('csrftoken') || csrfTokenCache || bootstrappedToken || '';
}

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
    for (;;) {
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

// Интерсептор для добавления JWT access токена
apiClient.interceptors.request.use(
  async (config) => {
    const tokens = TokenManager.getTokens();
    const method = config.method?.toLowerCase() || 'get';

    config.withCredentials = true;
    config.headers = config.headers || {};

    if (tokens?.access) {
      // Используем формат "Bearer <access_token>" для JWT
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }

    if (isUnsafeMethod(method) && config.url !== CSRF_BOOTSTRAP_URL) {
      const csrfToken = await ensureCsrfCookie();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    if (IS_DEV) {
      console.log('📤 API Request:', {
        method: config.method.toUpperCase(),
        url: config.baseURL + config.url,
        hasToken: !!tokens?.access,
        hasCsrf: !!config.headers['X-CSRFToken'],
      });
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерсептор для обработки ошибок и автоматического обновления токена
apiClient.interceptors.response.use(
  (response) => {
    if (response?.config?.url === CSRF_BOOTSTRAP_URL) {
      const responseToken = response?.data?.csrf_token || '';
      if (responseToken) {
        csrfTokenCache = responseToken;
      }
    }
    if (IS_DEV) {
      console.log('📥 API Response:', {
        status: response.status,
        url: response.config.baseURL + response.config.url,
        data: response.data,
      });
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    
    if (IS_DEV) {
      console.error('❌ API Error:', {
        status: error.response?.status,
        url: config?.url,
        message: error.message,
        retry: config?._retry,
      });
    }

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

          // Разлогиниваем только при аутентификационной ошибке refresh токена.
          if (refreshResult.isAuthError || refreshResult.isExpired) {
            console.log('🔥 [APIClient] Clearing tokens due to expired refresh');
            TokenManager.clearTokens();
            window.location.replace('/token-auth');
            return Promise.reject(error);
          }

          // Временные сетевые/инфраструктурные ошибки не должны убивать сессию.
          if (refreshResult.isTransient) {
            console.warn('⚠️ [APIClient] Refresh failed due to transient error, keeping session');
            return Promise.reject(error);
          }

          throw new Error(refreshResult.error || 'Token refresh failed');
        }
      } catch (refreshError) {
        console.error('❌ [APIClient] Token refresh error:', refreshError);
        // Сбрасываем сессию только если refresh действительно невалиден/просрочен.
        if (refreshError?.isAuthError || refreshError?.isExpired) {
          TokenManager.clearTokens();
          window.location.replace('/token-auth');
        }
        return Promise.reject(refreshError);
      }
    }

    // Если это 401 из самого endpoint refresh, то токены некорректны
    if (error.response?.status === 401 && config?.url?.includes('/auth/token/refresh')) {
      console.log('🚨 [APIClient] 401 from refresh endpoint - forcing logout');
      TokenManager.clearTokens();
      window.location.replace('/token-auth');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
