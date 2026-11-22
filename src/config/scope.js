import { createElement } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * One codebase, two deployments. VITE_NAV_SCOPE=studio|catalog (see config/nav.js) trims the
 * menu AND the routes, so a build only contains and serves its own area; 'all' (default)
 * keeps everything, which is what dev and the current new.studio build use.
 *
 *   studio   generation: /generation, /ai, /tasks
 *   catalog  live catalog: /catalog (cities, events, booking, subscriptions)
 *   shared   login, account, export/import and the 404 page exist in both
 */
const OWNED_PREFIXES = {
  studio: ['/generation', '/ai', '/tasks'],
  catalog: ['/catalog'],
};
const OTHER_SCOPE = { studio: 'catalog', catalog: 'studio' };

const isUnder = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

export function isScoped(scope) {
  return scope === 'studio' || scope === 'catalog';
}

/** False when the path belongs to the other deployment. Shared paths are always in scope. */
export function isPathInScope(path, scope) {
  if (!isScoped(scope)) return true;
  return !OWNED_PREFIXES[OTHER_SCOPE[scope]].some((prefix) => isUnder(path, prefix));
}

/** Where a signed-in user lands: the catalog build starts at the catalog, everything else at sessions. */
export function landingPath(scope) {
  return scope === 'catalog' ? '/catalog' : '/generation';
}

/**
 * Drops the other deployment's routes (they fall through to the 404) and, in a scoped build,
 * turns "/" into a redirect to the build's landing page instead of the generic home page.
 */
export function filterRoutesByScope(routes, scope) {
  if (!isScoped(scope)) return routes;
  return routes
    .filter((route) => route.path === '*' || isPathInScope(route.path, scope))
    .map((route) => (route.path === '/'
      ? { ...route, element: createElement(Navigate, { to: landingPath(scope), replace: true }) }
      : route));
}
