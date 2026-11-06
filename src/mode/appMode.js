/**
 * Два режима одной панели.
 *
 * studio — нода с ContentGeneration (`/generation/` отвечает 200/401/403).
 * admin  — боевая нода (`APP_ROLE=serve`): маршрута генерации нет, ответ 404.
 *
 * `VITE_APP_MODE=studio|admin` перебивает пробу. Пустое значение — смотрим ноду.
 */

export const STUDIO = 'studio';
export const ADMIN = 'admin';
export const APP_MODE_STORAGE_KEY = 'cg.appMode';

/** Экраны, которые ходят в ContentGeneration и на serve не живут. */
const STUDIO_PREFIXES = [
  '/generation',
  '/ai',
  '/tasks',
  '/export',
  '/import',
  '/catalog/cities',
  '/catalog/events',
  '/catalog/photos',
  '/catalog/audio-guides',
  '/catalog/interactive-locations',
  '/catalog/external-products/linking',
];

export function isStudioPath(pathname) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  return STUDIO_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** 404 — генерации на ноде нет. 200/401/403 — маршрут смонтирован. */
export function modeFromProbeStatus(status) {
  if (status === 404) return ADMIN;
  if (status === 200 || status === 401 || status === 403) return STUDIO;
  return null;
}

export function landingPath(mode) {
  return mode === ADMIN ? '/catalog' : '/generation';
}

export function explicitAppMode(env = import.meta.env) {
  const value = String(env?.VITE_APP_MODE || '').trim().toLowerCase();
  return value === ADMIN || value === STUDIO ? value : null;
}

export function readStoredAppMode(storage = globalThis.sessionStorage) {
  try {
    const value = storage?.getItem(APP_MODE_STORAGE_KEY);
    return value === ADMIN || value === STUDIO ? value : null;
  } catch {
    return null;
  }
}

export function storeAppMode(mode, storage = globalThis.sessionStorage) {
  if (mode !== ADMIN && mode !== STUDIO) return;
  try {
    storage?.setItem(APP_MODE_STORAGE_KEY, mode);
  } catch {
    /* приватный режим — режим просто не запомнится до следующей пробы */
  }
}

export function filterByMode(items, mode, getPath = (item) => item.to) {
  if (mode !== ADMIN || !Array.isArray(items)) return items;
  return items.filter((item) => !isStudioPath(getPath(item)));
}

export function filterNavSections(sections, mode) {
  if (mode !== ADMIN) return sections;
  return sections
    .map((section) => ({ ...section, items: filterByMode(section.items, mode) }))
    .filter((section) => section.items.length > 0);
}

export function filterCatalogSections(sections, mode) {
  if (mode !== ADMIN) return sections;
  return sections
    .map((section) => ({ ...section, items: filterByMode(section.items, mode) }))
    .filter((section) => section.items.length > 0);
}

export async function probeAppMode({
  fetchImpl = globalThis.fetch,
  apiBase,
  storage,
  env,
} = {}) {
  const forced = explicitAppMode(env);
  if (forced) {
    storeAppMode(forced, storage);
    return forced;
  }

  const base = String(apiBase ?? (import.meta.env.VITE_API_URL || '/api/v1')).replace(/\/$/, '');
  try {
    const response = await fetchImpl(`${base}/generation/workspaces/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    const detected = modeFromProbeStatus(response?.status) || readStoredAppMode(storage) || STUDIO;
    storeAppMode(detected, storage);
    return detected;
  } catch {
    return readStoredAppMode(storage) || STUDIO;
  }
}
