export function createEmptyEvent() {
  return {
    id: null,
    title: {},
    description: {},
    tag_ids: [],
    city_id: '',
    is_show: true,
    is_bookable: false,
    image_url: null,
    image_copyright: '',
    lat: null,
    lon: null,
    media: null,
  };
}

export function fromApiEventRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    ...row,
    id: row.id,
    title: row.title && typeof row.title === 'object' ? row.title : {},
    description: row.description && typeof row.description === 'object' ? row.description : {},
    tag_ids: (row.tag_ids || row.tags || []).map(String),
    city_id: row.city_id ? String(row.city_id) : '',
    is_show: row.is_show ?? true,
    is_bookable: row.is_bookable ?? false,
    audio_guide_count: row.audio_guide_count ?? 0,
    image_url: row.image_url || row?.media?.image?.url || null,
    image_copyright: row.image_copyright || row?.media?.image?.copyright || '',
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    media: row.media || null,
  };
}

export function mergeEventWithDetail(row, detail) {
  const base = fromApiEventRow(row) || createEmptyEvent();
  const d = detail && typeof detail === 'object' ? detail : {};
  return {
    ...base,
    title: d.title || base.title || {},
    description: d.description || base.description || {},
    city_id: d.city_id ? String(d.city_id) : (base.city_id || ''),
    tag_ids: (d.tag_ids || d.tags || base.tag_ids || []).map(String),
    is_show: d.is_show ?? base.is_show ?? true,
    is_bookable: d.is_bookable ?? base.is_bookable ?? false,
    audio_guide_count: d.audio_guide_count ?? base.audio_guide_count ?? 0,
    image_url: d.image_url || base.image_url || null,
    image_copyright: d.image_copyright || base.image_copyright || '',
    lat: d.lat ?? base.lat ?? null,
    lon: d.lon ?? base.lon ?? null,
    media: d.media || base.media || null,
  };
}

export function toApiEventPayload(event) {
  const payload = {
    title: event?.title || {},
    description: event?.description || {},
    is_show: !!event?.is_show,
    is_bookable: !!event?.is_bookable,
    city_id: event?.city_id || null,
    tag_ids: (event?.tag_ids || []).filter(Boolean).map(String),
  };
  if (event?.lat != null) payload.lat = Number(event.lat);
  if (event?.lon != null) payload.lon = Number(event.lon);
  return payload;
}

