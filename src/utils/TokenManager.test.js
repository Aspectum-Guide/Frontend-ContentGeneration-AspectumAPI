import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tokenManager from './TokenManager';

function base64UrlEncode(obj) {
  const base64 = btoa(JSON.stringify(obj));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds a syntactically valid (unsigned) JWT with the given payload claims. */
function makeToken(payload) {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fake-signature`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function freshAccessToken() {
  return makeToken({ exp: nowSeconds() + 3600 }); // valid for an hour
}

function freshRefreshToken() {
  return makeToken({ exp: nowSeconds() + 30 * 24 * 3600 });
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => body,
  };
}

/**
 * Some Node versions ship an experimental built-in `localStorage` that shadows
 * jsdom's implementation but lacks setItem/clear (throws unless launched with
 * --localstorage-file). Stub a plain in-memory store instead of depending on
 * whichever one wins in a given environment.
 */
function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
  // Singleton instance: reset internal refresh/cooldown state between tests.
  tokenManager.isRefreshing = false;
  tokenManager.refreshPromise = null;
  tokenManager.refreshQueue = [];
  tokenManager.lastRefreshTime = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TokenManager.decodeJwtPayload', () => {
  it('decodes a well-formed base64url JWT payload', () => {
    const token = makeToken({ exp: 12345, sub: 'user-1' });
    expect(tokenManager.decodeJwtPayload(token)).toEqual({ exp: 12345, sub: 'user-1' });
  });

  it('returns null for a token that does not have 3 segments', () => {
    expect(tokenManager.decodeJwtPayload('not-a-jwt')).toBeNull();
  });
});

describe('TokenManager.validateToken', () => {
  it('flags a missing token as invalid without touching decode', () => {
    const result = tokenManager.validateToken(null);
    expect(result).toEqual(
      expect.objectContaining({ isValid: false, isExpired: false, needsRefresh: false })
    );
  });

  it('accepts a token far from expiry', () => {
    const token = makeToken({ exp: nowSeconds() + 3600 });
    const result = tokenManager.validateToken(token);
    expect(result.isValid).toBe(true);
    expect(result.isExpired).toBe(false);
    expect(result.needsRefresh).toBe(false);
  });

  it('marks a token inside the expiry buffer as needing refresh but still valid', () => {
    const token = makeToken({ exp: nowSeconds() + 60 }); // inside 5-minute buffer
    const result = tokenManager.validateToken(token);
    expect(result.isValid).toBe(true);
    expect(result.needsRefresh).toBe(true);
  });

  it('marks a past-expiry token as expired and invalid', () => {
    const token = makeToken({ exp: nowSeconds() - 10 });
    const result = tokenManager.validateToken(token);
    expect(result.isValid).toBe(false);
    expect(result.isExpired).toBe(true);
  });

  it('treats a token without an exp claim as an invalid payload', () => {
    const token = makeToken({ sub: 'user-1' });
    const result = tokenManager.validateToken(token);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token payload');
  });
});

describe('TokenManager storage round-trip', () => {
  it('saves and reads back tokens from localStorage', () => {
    const access = freshAccessToken();
    const refresh = freshRefreshToken();

    expect(tokenManager.saveTokens({ access, refresh })).toBe(true);
    expect(tokenManager.getTokens()).toEqual(
      expect.objectContaining({ access, refresh })
    );
  });

  it('returns null when nothing is stored', () => {
    expect(tokenManager.getTokens()).toBeNull();
  });

  it('clears stored tokens', () => {
    tokenManager.saveTokens({ access: freshAccessToken(), refresh: freshRefreshToken() });
    tokenManager.clearTokens();
    expect(tokenManager.getTokens()).toBeNull();
  });
});

describe('TokenManager.getValidAccessToken', () => {
  it('returns the access token when valid and not near expiry', () => {
    const access = freshAccessToken();
    tokenManager.saveTokens({ access, refresh: freshRefreshToken() });
    expect(tokenManager.getValidAccessToken()).toBe(access);
  });

  it('returns null when no tokens are stored', () => {
    expect(tokenManager.getValidAccessToken()).toBeNull();
  });

  it('returns null when the access token needs refresh, even though not yet expired', () => {
    const access = makeToken({ exp: nowSeconds() + 60 }); // inside buffer
    tokenManager.saveTokens({ access, refresh: freshRefreshToken() });
    expect(tokenManager.getValidAccessToken()).toBeNull();
  });
});

describe('TokenManager.refreshTokens', () => {
  it('performs a successful refresh and persists the new tokens', async () => {
    const refresh = freshRefreshToken();
    const newAccess = freshAccessToken();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access: newAccess, refresh })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await tokenManager.refreshTokens(refresh);

    expect(result.success).toBe(true);
    expect(result.data.access).toBe(newAccess);
    expect(tokenManager.getTokens().access).toBe(newAccess);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/token/refresh'),
      expect.any(Object)
    );
  });

  it('rejects an already-expired refresh token without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const expiredRefresh = makeToken({ exp: nowSeconds() - 10 });
    const result = await tokenManager.refreshTokens(expiredRefresh);

    expect(result.success).toBe(false);
    expect(result.isAuthError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a 401 as an auth error (session must end)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));

    const result = await tokenManager.refreshTokens(freshRefreshToken());

    expect(result.success).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.isAuthError).toBe(true);
  });

  it('surfaces a 403 as an auth error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {})));

    const result = await tokenManager.refreshTokens(freshRefreshToken());

    expect(result.success).toBe(false);
    expect(result.isAuthError).toBe(true);
  });

  it('treats a network abort (timeout) as transient, not an auth error', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const result = await tokenManager.refreshTokens(freshRefreshToken());

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(true);
    expect(result.isAuthError).toBeUndefined();
  });

  it('rejects a response body missing the access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { refresh: 'x' })));

    const result = await tokenManager.refreshTokens(freshRefreshToken());

    expect(result.success).toBe(false);
    expect(result.isAuthError).toBe(true);
  });

  it('enforces the cooldown window between consecutive refresh attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access: freshAccessToken(), refresh: freshRefreshToken() })
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await tokenManager.refreshTokens(freshRefreshToken());
    expect(first.success).toBe(true);

    // Immediately retrying should hit the cooldown guard, not fetch again.
    const second = await tokenManager.refreshTokens(freshRefreshToken());
    expect(second.success).toBe(false);
    expect(second.isTransient).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('queues concurrent refresh calls and resolves them all with the single in-flight result', async () => {
    let resolveFetch;
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingFetch));

    const refresh = freshRefreshToken();
    const call1 = tokenManager.refreshTokens(refresh);
    const call2 = tokenManager.refreshTokens(refresh);
    const call3 = tokenManager.refreshTokens(refresh);

    const newAccess = freshAccessToken();
    resolveFetch(jsonResponse(200, { access: newAccess, refresh }));

    const [r1, r2, r3] = await Promise.all([call1, call2, call3]);

    // Only one network request for all 3 concurrent callers (single-flight).
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r1.success).toBe(true);
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
    expect(r1.data.access).toBe(newAccess);
  });
});

describe('TokenManager.ensureValidTokens', () => {
  it('reports invalid when no tokens are stored', async () => {
    const result = await tokenManager.ensureValidTokens();
    expect(result.isValid).toBe(false);
  });

  it('returns the stored tokens as-is when the access token is still fresh', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const access = freshAccessToken();
    tokenManager.saveTokens({ access, refresh: freshRefreshToken() });

    const result = await tokenManager.ensureValidTokens();

    expect(result.isValid).toBe(true);
    expect(result.tokens.access).toBe(access);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('transparently refreshes when the access token is near expiry', async () => {
    const refresh = freshRefreshToken();
    const nearExpiryAccess = makeToken({ exp: nowSeconds() + 60 });
    tokenManager.saveTokens({ access: nearExpiryAccess, refresh });

    const newAccess = freshAccessToken();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { access: newAccess, refresh }))
    );

    const result = await tokenManager.ensureValidTokens();

    expect(result.isValid).toBe(true);
    expect(result.tokens.access).toBe(newAccess);
  });

  it('reports invalid with the underlying error when refresh fails', async () => {
    const refresh = freshRefreshToken();
    tokenManager.saveTokens({ access: makeToken({ exp: nowSeconds() + 60 }), refresh });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));

    const result = await tokenManager.ensureValidTokens();

    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('reports invalid when the access token is stale and there is no refresh token', async () => {
    tokenManager.saveTokens({ access: makeToken({ exp: nowSeconds() - 10 }), refresh: '' });

    const result = await tokenManager.ensureValidTokens();

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('No refresh token available');
  });
});
