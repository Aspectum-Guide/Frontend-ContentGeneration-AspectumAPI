/**
 * JWT Token Manager for ContentGeneration Frontend
 * Handles token storage, validation, and automatic refresh
 * Based on mobile app TokenManager pattern
 */

const TOKEN_KEY = 'jwt_tokens';
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer before expiry

class TokenManager {
  constructor() {
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.refreshQueue = [];
    this.lastRefreshTime = 0;
    this.REFRESH_COOLDOWN = 1000; // 1 second between refresh attempts
    this.REFRESH_TIMEOUT_MS = 10000;
  }

  /**
   * Decode JWT payload without verification
   * JWT format: header.payload.signature
   */
  decodeJwtPayload(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = parts[1];
      // JWT uses base64url (not base64). atob expects base64 with padding.
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('[TokenManager] Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Validate JWT token
   * Returns validation status and whether refresh is needed
   */
  validateToken(token) {
    if (!token) {
      return {
        isValid: false,
        isExpired: false,
        needsRefresh: false,
        error: 'Token is missing',
      };
    }

    try {
      const payload = this.decodeJwtPayload(token);
      if (!payload || !payload.exp) {
        return {
          isValid: false,
          isExpired: false,
          needsRefresh: false,
          error: 'Invalid token payload',
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp;
      const isExpired = now >= exp;
      const needsRefresh = now >= (exp - TOKEN_EXPIRY_BUFFER / 1000);

      return {
        isValid: !isExpired,
        isExpired,
        needsRefresh,
      };
    } catch (error) {
      console.error('[TokenManager] Token validation failed:', error);
      return {
        isValid: false,
        isExpired: false,
        needsRefresh: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Save tokens to localStorage
   */
  saveTokens(tokens) {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({
        access: tokens.access,
        refresh: tokens.refresh,
        expiresAt: tokens.expiresAt || Date.now() + 3600000, // 1 hour default
      }));
      console.log('[TokenManager] Tokens saved successfully');
      return true;
    } catch (error) {
      console.error('[TokenManager] Failed to save tokens:', error);
      return false;
    }
  }

  /**
   * Get tokens from localStorage
   */
  getTokens() {
    try {
      const tokenData = localStorage.getItem(TOKEN_KEY);
      if (!tokenData) {
        return null;
      }
      return JSON.parse(tokenData);
    } catch (error) {
      console.error('[TokenManager] Failed to get tokens:', error);
      return null;
    }
  }

  /**
   * Clear tokens from localStorage
   */
  clearTokens() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      console.log('[TokenManager] Tokens cleared');
      return true;
    } catch (error) {
      console.error('[TokenManager] Failed to clear tokens:', error);
      return false;
    }
  }

  /**
   * Get access token if valid
   */
  getValidAccessToken() {
    const tokens = this.getTokens();
    if (!tokens) {
      return null;
    }

    const validation = this.validateToken(tokens.access);
    if (validation.isValid && !validation.needsRefresh) {
      return tokens.access;
    }

    return null;
  }

  /**
   * Refresh tokens using refresh token
   * Handles race conditions by queuing multiple requests
   */
  async refreshTokens(refreshToken) {
    // If already refreshing, queue this request
    if (this.isRefreshing && this.refreshPromise) {
      return new Promise((resolve) => {
        this.refreshQueue.push({ resolve });
      });
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastRefreshTime < this.REFRESH_COOLDOWN) {
      return {
        success: false,
        error: 'Refresh cooldown active',
        isTransient: true,
      };
    }

    // Start new refresh
    this.isRefreshing = true;
    this.lastRefreshTime = now;
    this.refreshPromise = this.performRefresh(refreshToken);

    try {
      const result = await this.refreshPromise;
      this.processQueue(result);
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        isTransient: true,
      };
      this.processQueue(errorResult);
      return errorResult;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Process queued refresh requests
   */
  processQueue(result) {
    this.refreshQueue.forEach(({ resolve }) => {
      resolve(result);
    });
    this.refreshQueue = [];
  }

  /**
   * Perform actual token refresh API call
   */
  async performRefresh(refreshToken) {
    try {
      // Validate refresh token before attempting refresh
      const refreshValidation = this.validateToken(refreshToken);
      if (!refreshValidation.isValid) {
        return {
          success: false,
          error: 'Refresh token is invalid',
          isExpired: refreshValidation.isExpired,
          isAuthError: true,
        };
      }

      // Get API URL from environment
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REFRESH_TIMEOUT_MS);

      // Call refresh endpoint
      const response = await fetch(`${apiUrl}/auth/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Refresh token expired',
            isExpired: true,
            isAuthError: true,
          };
        }
        if (response.status === 400 || response.status === 403) {
          return {
            success: false,
            error: `Refresh rejected: HTTP ${response.status}`,
            isAuthError: true,
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.access) {
        console.error('[TokenManager] Invalid response format:', data);
        return {
          success: false,
          error: 'Invalid response format',
          isAuthError: true,
        };
      }

      // Validate new access token
      const accessValidation = this.validateToken(data.access);
      if (!accessValidation.isValid) {
        console.error('[TokenManager] New access token is invalid');
        return {
          success: false,
          error: 'New access token is invalid',
          isAuthError: true,
        };
      }

      const newTokens = {
        access: data.access,
        refresh: data.refresh || refreshToken,
        expiresAt: Date.now() + 3600000, // ~1 hour
      };

      // Save new tokens
      this.saveTokens(newTokens);

      console.log('[TokenManager] Tokens refreshed successfully');
      return { success: true, data: newTokens };
    } catch (error) {
      console.error('[TokenManager] Refresh failed:', error);
      const isTimeout = error?.name === 'AbortError';
      return {
        success: false,
        error: isTimeout ? 'Refresh request timeout' : (error instanceof Error ? error.message : 'Unknown error'),
        isTransient: true,
      };
    }
  }

  /**
   * Ensure we have valid tokens
   * Refreshes if needed or returns error
   */
  async ensureValidTokens() {
    try {
      const tokens = this.getTokens();
      if (!tokens) {
        return { isValid: false, error: 'No tokens found' };
      }

      // Check access token
      const accessValidation = this.validateToken(tokens.access);
      if (accessValidation.isValid && !accessValidation.needsRefresh) {
        return { isValid: true, tokens };
      }

      // If expired or needs refresh
      if (accessValidation.isExpired || accessValidation.needsRefresh) {
        console.log('[TokenManager] Access token needs refresh');

        if (!tokens.refresh) {
          return { isValid: false, error: 'No refresh token available' };
        }

        const refreshResult = await this.refreshTokens(tokens.refresh);
        if (refreshResult.success && refreshResult.data) {
          return { isValid: true, tokens: refreshResult.data };
        } else {
          return { isValid: false, error: refreshResult.error };
        }
      }

      return { isValid: false, error: 'Token validation failed' };
    } catch (error) {
      console.error('[TokenManager] Error ensuring valid tokens:', error);
      return { isValid: false, error: 'Token validation error' };
    }
  }
}

// Export singleton instance
export default new TokenManager();
