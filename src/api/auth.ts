import apiClient from './client';
import { fetchWithSlashFallback } from '../utils/fetchWithSlashFallback';
import {
  AuthLoginRequestSchema,
  AuthTokenPairSchema,
} from './contract/auth';

/**
 * Auth endpoints may toggle trailing-slash strictness on backend.
 * We retry once on 404 with/without trailing slash.
 */
export const authAPI = {
  /**
   * Raw login fetch (returns Response).
   * Use `loginJson` to get validated token pair.
   */
  login: async (payload: unknown, { baseUrl }: { baseUrl?: string } = {}) => {
    const body = AuthLoginRequestSchema.parse(payload);
    const apiBase = baseUrl ?? (import.meta.env.VITE_API_URL || '/api/v1');
    const url = `${apiBase}/auth/login/`;

    return fetchWithSlashFallback(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  /**
   * Login and parse tokens according to contract.
   */
  loginJson: async (payload: unknown, opts: { baseUrl?: string } = {}) => {
    const resp = await authAPI.login(payload, opts);
    const data = await resp.json().catch(() => ({}));
    return { resp, data: AuthTokenPairSchema.safeParse(data) };
  },

  // Refresh via apiClient base (TokenManager owns the refresh orchestration).
  // Без trailing slash: auth-роуты бэкенда зарегистрированы без слэша.
  refresh: (data: unknown) => apiClient.post('/auth/token/refresh', data),
};

