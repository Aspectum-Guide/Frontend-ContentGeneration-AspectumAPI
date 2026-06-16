/**
 * Fetch helper that retries once with/without trailing slash on 404.
 * Useful when backend toggles APPEND_SLASH / router strictness.
 */
export async function fetchWithSlashFallback(url, options) {
  const firstUrl = String(url || '');
  const resp = await fetch(firstUrl, options);

  // Only fallback on 404: route mismatch (often trailing slash).
  if (resp.status !== 404) return resp;

  const hasSlash = firstUrl.endsWith('/');
  const secondUrl = hasSlash ? firstUrl.slice(0, -1) : `${firstUrl}/`;

  // Avoid infinite retries / useless second try.
  if (!secondUrl || secondUrl === firstUrl) return resp;

  return fetch(secondUrl, options);
}

