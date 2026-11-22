import { DEFAULT_LOCALE_DEFS, normalizeId } from './sessionWizardShared.jsx';

export function normalizeAttractionFeedItem(item = {}) {
  const eventId = normalizeId(
    item.event_id ?? item.event ?? item.attraction_id ?? item.attraction,
  ) || null;
  const sessionAttractionId = normalizeId(
    item.session_attraction_id ?? item.session_attraction,
  ) || null;
  let assignedAttractionType = item.assigned_attraction_type ?? 'none';
  if (!item.assigned_attraction_type) {
    if (eventId) assignedAttractionType = 'database';
    else if (sessionAttractionId) assignedAttractionType = 'draft';
  }
  return {
    ...item,
    id: item.id ?? null,
    item_type: item.item_type || 'text',
    text: item.text ?? {},
    image_id: item.image_id ?? item.image?.id ?? item.image ?? null,
    image_url:
      item.image_url ?? item.imageUrl ?? item.localUrl ?? item.local_url
      ?? item.image?.url ?? item.image?.file ?? null,
    image_original_url:
      item.image_original_url ?? item.imageOriginalUrl ?? item.original_image_url
      ?? item.originalImageUrl ?? item.image?.original_url ?? item.image?.source_url
      ?? item.image?.file_page_url ?? '',
    image_copyright:
      item.image_copyright ?? item.imageCopyright ?? item.copyright
      ?? item.image?.copyright ?? '',
    index: Number(item.index ?? 0),
    event: eventId,
    event_id: eventId,
    attraction: eventId,
    attraction_id: eventId,
    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,
    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: item.assigned_attraction_name ?? null,
    isNew: item.isNew ?? false,
  };
}

export function createEmptyAttractionFeedItem(itemType = 'text') {
  const text = DEFAULT_LOCALE_DEFS.reduce((result, locale) => {
    const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';
    if (lang) result[lang] = '';
    return result;
  }, {});
  return {
    id: `attraction-feed-${Date.now()}`,
    item_type: itemType,
    text,
    image_id: null,
    image_url: '',
    image_original_url: '',
    image_copyright: '',
    index: 0,
    assigned_attraction_type: 'none',
    event: null,
    event_id: null,
    attraction: null,
    attraction_id: null,
    session_attraction: null,
    session_attraction_id: null,
    isNew: true,
  };
}

export function buildAttractionFeedPayload(item, text = null) {
  const assignedType = item.assigned_attraction_type ?? 'none';
  const event = assignedType === 'database'
    ? item.event_id ?? item.event ?? item.attraction_id ?? item.attraction ?? null
    : null;
  const sessionAttraction = assignedType === 'draft'
    ? item.session_attraction_id ?? item.session_attraction ?? null
    : null;
  const image = item.image_id ?? item.image?.id ?? item.image ?? null;
  return {
    item_type: item.item_type || 'text',
    text: text ?? item.text ?? {},
    image_id: image,
    image,
    image_original_url: item.image_original_url ?? item.imageOriginalUrl ?? '',
    image_copyright:
      item.image_copyright ?? item.imageCopyright ?? item.copyright ?? '',
    index: Number(item.index ?? 0),
    assigned_attraction_type: assignedType,
    event,
    event_id: event,
    attraction: event,
    attraction_id: event,
    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };
}

export function collectAttractionFeedLocaleTexts(localeData) {
  const text = {};
  Object.values(localeData || {}).forEach((locale) => {
    if (locale?.lang) text[locale.lang] = locale.text || '';
  });
  return text;
}

export function buildAttractionFeedPersistSnapshot(item, localeData) {
  if (!item?.id) return null;
  const normalizedItem = normalizeAttractionFeedItem(item);
  const text = normalizedItem.item_type === 'text'
    ? collectAttractionFeedLocaleTexts(localeData)
    : {};
  return JSON.stringify(buildAttractionFeedPayload(normalizedItem, text));
}
