/** Settings written at container start into /app-config.js (see docker/40-app-config.sh). */
export function runtimeConfig() {
  try {
    const config = typeof window !== 'undefined' ? window.__APP_CONFIG__ : null;
    return config && typeof config === 'object' ? config : {};
  } catch {
    return {};
  }
}
