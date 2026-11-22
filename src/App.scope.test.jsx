import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchRoutes } from 'react-router-dom';

afterEach(() => vi.unstubAllEnvs());

describe.each(['studio', 'catalog'])('actual application routes: %s', (scope) => {
  it('registers its menu destinations, shared routes and landing page, excluding the other area', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_NAV_SCOPE', scope);
    const { routes } = await import('./App.jsx');
    const { getNavGroups } = await import('./config/nav.js');
    const { landingPath } = await import('./config/scope.js');
    const matchedPath = (path) => matchRoutes(routes, path)?.at(-1)?.route.path;

    for (const group of getNavGroups()) {
      for (const item of group.items) {
        expect(matchedPath(item.to), item.to).toBe(item.to);
      }
    }
    for (const path of ['/token-auth', '/account/settings', '/export/zip', '/import/google-sheet']) {
      expect(matchedPath(path), path).toBe(path);
    }
    expect(routes.find((route) => route.path === '/').element.props.to).toBe(landingPath(scope));
    const excluded = scope === 'studio'
      ? ['/catalog', '/catalog/cities', '/catalog/booking', '/catalog/subscription-types']
      : ['/generation', '/generation/123', '/ai/settings', '/tasks/audio-queue'];
    for (const path of excluded) expect(matchedPath(path), path).toBe('*');
    expect(getNavGroups().some((group) => group.id === 'sessions')).toBe(scope === 'studio');
  });
});
