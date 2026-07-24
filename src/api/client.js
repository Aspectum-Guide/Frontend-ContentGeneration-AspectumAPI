import axios from 'axios';
import TokenManager from '../utils/TokenManager';
import { redirectToAuth } from '../utils/authRedirect';

// Определяем базовый URL для API
// В Vite переменные окружения доступны через import.meta.env
// Используем VITE_API_URL или dev-proxy '/api/v1'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const IS_DEV = import.meta.env.DEV;

if (IS_DEV) {
  console.log('🔧 API Client initialized with baseURL:', API_BASE_URL);
}

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // JWT-only: не используем cookie-based auth/CSRF
  withCredentials: false,
  // Не считаем 3xx успешными — ловим 302 в интерсепторе
  validateStatus: (status) => status >= 200 && status < 300,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-flight GET dedupe (e.g. React 18 double-effects firing the same request
// twice) + retry on 429. No response caching here on purpose: catalog pages
// own their own reload timing (useCatalogResource + onAfterSave/onAfterDelete
// reload right after a mutation), and a blanket "serve this response again
// for 2s" cache was a second, uncoordinated caching layer on top of that —
// see docs/CATALOG_REFACTOR_BLUEPRINT.md for the fuller picture (TanStack
// Query is the other one, used only by SessionsList.jsx).
const inFlightRequests = new Map();
const MAX_429_RETRIES = 3;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Wrap GET to add dedupe/retry behaviour
const originalGet = apiClient.get.bind(apiClient);
apiClient.get = async (url, config = {}) => {
  const { skipApiGetCache, ...axiosConfig } = config;

  const paramsKey = axiosConfig.params ? JSON.stringify(axiosConfig.params) : '';
  const key = `GET:${url}?${paramsKey}`;
  // `skipApiGetCache: true` means "don't dedupe this with an in-flight
  // request for the same URL" — callers use it to force a genuinely
  // independent fresh request (e.g. re-fetching a session right after an
  // async generation task completes, where coalescing with a stale in-flight
  // request for the same URL would return outdated data).
  const inFlightKey = skipApiGetCache === true ? `${key}#skip` : key;

  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey);
  }

  // Make request with retry on 429
  const makeRequest = async () => {
    let attempt = 0;
    for (;;) {
      try {
        return await originalGet(url, axiosConfig);
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

  const promise = makeRequest().finally(() => inFlightRequests.delete(inFlightKey));
  inFlightRequests.set(inFlightKey, promise);
  return promise;
};

// Интерсептор для добавления JWT access токена
apiClient.interceptors.request.use(
  async (config) => {
    const tokens = TokenManager.getTokens();

    config.withCredentials = false;
    config.headers = config.headers || {};

    if (tokens?.access) {
      // Используем формат "Bearer <access_token>" для JWT
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    
    if (IS_DEV) {
      console.log('📤 API Request:', {
        method: config.method.toUpperCase(),
        url: config.baseURL + config.url,
        hasToken: !!tokens?.access,
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
    if (IS_DEV) {
      console.log('📥 API Response:', {
        status: response.status,
        url: response.config.baseURL + response.config.url,
        method: response.config.method?.toUpperCase(),
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

    // Обработка 302 — бэкенд вернул редирект вместо JSON
    // (случается если @login_required сработал до ApiLoginRequiredRedirectMiddleware)
    if (error.response?.status === 302) {
      console.warn('⚠️ [APIClient] 302 redirect received — token may be invalid');
      const tokens = TokenManager.getTokens();
      if (tokens?.refresh) {
        try {
          const refreshResult = await TokenManager.refreshTokens(tokens.refresh);
          if (refreshResult.success && refreshResult.data) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${refreshResult.data.access}`;
            return apiClient(config);
          }
        } catch { /* ignore */ }
      }
      redirectToAuth();
      return Promise.reject(error);
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
            redirectToAuth();
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
          redirectToAuth();
        }
        return Promise.reject(refreshError);
      }
    }

    // Если это 401 из самого endpoint refresh, то токены некорректны
    if (error.response?.status === 401 && config?.url?.includes('/auth/token/refresh')) {
      console.log('🚨 [APIClient] 401 from refresh endpoint - forcing logout');
      redirectToAuth();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
