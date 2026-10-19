import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('./utils/TokenManager', () => ({
  default: { getTokens: vi.fn(() => null), validateToken: vi.fn(), refreshTokens: vi.fn(), clearTokens: vi.fn() },
}));
vi.mock('./api/auth.ts', () => ({ authAPI: { me: vi.fn(), loginJson: vi.fn() } }));

// App.jsx reads VITE_NAV_SCOPE when it is imported, so each scope needs a fresh module graph.
async function routesFor(scope) {
  vi.resetModules();
  vi.stubEnv('VITE_NAV_SCOPE', scope);
  const { routes } = await import('./App.jsx');
  return routes.map((route) => route.path);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('App routes per deployment scope', () => {
  it('the default build serves everything', async () => {
    const paths = await routesFor('');
    expect(paths).toEqual(expect.arrayContaining(['/generation', '/ai/settings', '/tasks', '/catalog', '/catalog/cities', '/export/zip']));
  });

  it('the studio build has no catalog routes', async () => {
    const paths = await routesFor('studio');
    expect(paths).toEqual(expect.arrayContaining(['/generation', '/generation/:sessionId', '/ai/settings', '/tasks', '/export/zip', '/import/google-sheet', '/token-auth', '*']));
    expect(paths.filter((p) => p.startsWith('/catalog'))).toEqual([]);
  });

  it('the catalog build has no generation, AI or task routes', async () => {
    const paths = await routesFor('catalog');
    expect(paths).toEqual(expect.arrayContaining(['/catalog', '/catalog/cities', '/catalog/booking-setup', '/export/zip', '/token-auth', '*']));
    expect(paths.filter((p) => /^\/(generation|ai|tasks)/.test(p))).toEqual([]);
  });
});
