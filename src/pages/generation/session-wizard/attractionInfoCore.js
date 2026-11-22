import { DEFAULT_LOCALE_DEFS, normalizeId } from './sessionWizardShared.jsx';

export function normalizeAttractionInfo(info = {}) {
  const eventId = info.event_id ?? info.event ?? info.attraction_id ?? info.attraction ?? null;
  const sessionAttractionId = info.session_attraction_id ?? info.session_attraction ?? null;
  let assignedAttractionType = info.assigned_attraction_type ?? 'none';
  if (!info.assigned_attraction_type) {
    if (eventId) assignedAttractionType = 'database';
    else if (sessionAttractionId) assignedAttractionType = 'draft';
  }
  return {
    ...info,
    id: info.id ?? null,
    name: info.name ?? {},
    description: info.description ?? {},
    event: eventId,
    event_id: eventId,
    attraction: eventId,
    attraction_id: eventId,
    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,
    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: info.assigned_attraction_name ?? null,
  };
}

export function buildAttractionInfoPayload(info, name, description) {
  const assignedType = info.assigned_attraction_type ?? 'none';
  const event = assignedType === 'database'
    ? info.event_id ?? info.event ?? info.attraction_id ?? info.attraction ?? null
    : null;
  const sessionAttraction = assignedType === 'draft'
    ? info.session_attraction_id ?? info.session_attraction ?? null
    : null;
  return {
    name: name ?? info.name ?? {},
    description: description ?? info.description ?? {},
    assigned_attraction_type: assignedType,
    event,
    event_id: event,
    attraction: event,
    attraction_id: event,
    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };
}

export function createEmptyAttractionInfo({
  activeAttractionId = null,
  sourceLocaleData = null,
} = {}) {
  const normalizedAttractionId = normalizeId(activeAttractionId);
  const shouldAttachToDraft = Boolean(normalizedAttractionId);
  const sourceEntries = sourceLocaleData && Object.keys(sourceLocaleData).length > 0
    ? Object.entries(sourceLocaleData).map(([key, locale]) => ({ key, ...locale }))
    : DEFAULT_LOCALE_DEFS;
  const name = {};
  const description = {};
  sourceEntries.forEach((locale) => {
    const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';
    if (lang) {
      name[lang] = '';
      description[lang] = '';
    }
  });
  return {
    id: `attraction-info-${Date.now()}`,
    name,
    description,
    assigned_attraction_type: shouldAttachToDraft ? 'draft' : 'none',
    attraction: null,
    attraction_id: null,
    session_attraction: shouldAttachToDraft ? normalizedAttractionId : null,
    session_attraction_id: shouldAttachToDraft ? normalizedAttractionId : null,
    isNew: true,
  };
}

export function collectAttractionInfoLocaleTexts(localeData) {
  const name = {};
  const description = {};
  Object.values(localeData || {}).forEach((locale) => {
    if (!locale?.lang) return;
    name[locale.lang] = locale.name || '';
    description[locale.lang] = locale.description || '';
  });
  return { name, description };
}

export function buildAttractionInfoPersistSnapshot(info, localeData) {
  if (!info?.id) return null;
  const { name, description } = collectAttractionInfoLocaleTexts(localeData);
  return JSON.stringify(
    buildAttractionInfoPayload(normalizeAttractionInfo(info), name, description),
  );
}
