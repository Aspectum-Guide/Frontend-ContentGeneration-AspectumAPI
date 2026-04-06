const IS_DEV = import.meta.env.DEV;
const STORAGE_KEY = 'aspectum:analytics:events';
const MAX_STORED_EVENTS = 500;

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (value instanceof Date) {
      out[key] = value.toISOString();
      continue;
    }
  }
  return out;
}

export function trackEvent(eventName, payload = {}) {
  if (!eventName) return;
  const data = sanitizePayload(payload);
  const entry = {
    eventName,
    payload: data,
    ts: Date.now(),
  };

  storeEvent(entry);

  if (IS_DEV) {
    console.info('[Analytics]', eventName, data);
  }

  if (typeof window !== 'undefined') {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, data);
    }

    window.dispatchEvent(new CustomEvent('aspectum:analytics', {
      detail: entry,
    }));
  }
}

function readStoredEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeEvent(entry) {
  if (typeof window === 'undefined') return;
  try {
    const events = readStoredEvents();
    events.push(entry);
    const trimmed = events.slice(-MAX_STORED_EVENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage errors (quota/private mode)
  }
}

export function getStoredAnalyticsEvents() {
  return readStoredEvents();
}

export function clearStoredAnalyticsEvents() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getProjectAnalyticsSummary() {
  const events = readStoredEvents();

  const sessionSetByEvent = {
    open_session: new Set(),
    save_city_success: new Set(),
    publish_session_success: new Set(),
  };

  for (const item of events) {
    if (!item || !item.eventName || !item.payload) continue;
    if (!sessionSetByEvent[item.eventName]) continue;
    const sid = item.payload.sessionId;
    if (sid) sessionSetByEvent[item.eventName].add(String(sid));
  }

  const openSessions = sessionSetByEvent.open_session.size;
  const firstSaveSessions = sessionSetByEvent.save_city_success.size;
  const publishSessions = sessionSetByEvent.publish_session_success.size;

  const pct = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(2)) : 0);

  return {
    totalEvents: events.length,
    funnel: {
      openSessions,
      firstSaveSessions,
      publishSessions,
      openToFirstSaveRatePct: pct(firstSaveSessions, openSessions),
      firstSaveToPublishRatePct: pct(publishSessions, firstSaveSessions),
      openToPublishRatePct: pct(publishSessions, openSessions),
    },
  };
}

export default trackEvent;