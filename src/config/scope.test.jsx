import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { filterRoutesByScope, isPathInScope, landingPath } from './scope';

const page = (name) => <p>{name}</p>;
const routes = [
  { path: '/token-auth', element: page('login') },
  { path: '/', element: page('home') },
  { path: '/account/settings', element: page('account') },
  { path: '/generation', element: page('sessions') },
  { path: '/generation/:sessionId', element: page('wizard') },
  { path: '/ai/settings', element: page('ai') },
  { path: '/tasks', element: page('tasks') },
  { path: '/catalog', element: page('catalog home') },
  { path: '/catalog/cities', element: page('cities') },
  { path: '/export/zip', element: page('export') },
  { path: '*', element: page('404') },
];

const paths = (list) => list.map((route) => route.path);

describe('route scope', () => {
  it('keeps every route in the default (all) build', () => {
    expect(filterRoutesByScope(routes, 'all')).toBe(routes);
    expect(filterRoutesByScope(routes, undefined)).toBe(routes);
  });

  it('studio build drops the catalog routes only', () => {
    const kept = paths(filterRoutesByScope(routes, 'studio'));
    expect(kept).toEqual(expect.arrayContaining(['/generation', '/generation/:sessionId', '/ai/settings', '/tasks', '/export/zip', '/token-auth', '/account/settings', '*']));
    expect(kept.some((p) => p.startsWith('/catalog'))).toBe(false);
  });

  it('catalog build drops generation, AI and tasks routes only', () => {
    const kept = paths(filterRoutesByScope(routes, 'catalog'));
    expect(kept).toEqual(expect.arrayContaining(['/catalog', '/catalog/cities', '/export/zip', '/token-auth', '/account/settings', '*']));
    for (const gone of ['/generation', '/generation/:sessionId', '/ai/settings', '/tasks']) {
      expect(kept).not.toContain(gone);
    }
  });

  it('does not treat a lookalike prefix as the other deployment', () => {
    expect(isPathInScope('/catalogue', 'studio')).toBe(true);
    expect(isPathInScope('/aim', 'catalog')).toBe(true);
    expect(isPathInScope('/ai', 'catalog')).toBe(false);
    expect(isPathInScope('/catalog/cities', 'studio')).toBe(false);
  });

  it('knows where each build lands', () => {
    expect(landingPath('studio')).toBe('/generation');
    expect(landingPath('catalog')).toBe('/catalog');
    expect(landingPath('all')).toBe('/generation');
  });

  it('redirects "/" to the landing page in a scoped build and 404s the other area', () => {
    const open = (scope, path) => {
      const router = createMemoryRouter(filterRoutesByScope(routes, scope), { initialEntries: [path] });
      render(<RouterProvider router={router} />);
      return router;
    };

    const studio = open('studio', '/');
    expect(studio.state.location.pathname).toBe('/generation');
    expect(screen.getByText('sessions')).toBeTruthy();
  });

  it('shows the 404 for the other deployment\'s URLs', () => {
    const router = createMemoryRouter(filterRoutesByScope(routes, 'catalog'), { initialEntries: ['/generation'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText('404')).toBeTruthy();
  });
});
