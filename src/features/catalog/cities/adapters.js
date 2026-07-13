export function fromApiCity(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    ...row,
    id: row.id,
    name: row.name && typeof row.name === 'object' ? row.name : (row.name ? { ru: String(row.name) } : {}),
    description: row.description && typeof row.description === 'object' ? row.description : {},
    country: row.country && typeof row.country === 'object' ? row.country : {},
    city_filter_ids: Array.isArray(row.city_filter_ids) ? row.city_filter_ids.map(String) : [],
    lat: row.lat ?? '',
    lon: row.lon ?? '',
    image_id: row.image_id ?? null,
    image_url: row.image_url ?? null,
    image_copyright: row.image_copyright ?? '',
    is_show: row.is_show ?? true,
    iap_sku: row.iap_sku ?? '',
    iap_price_usd: row.iap_price_usd ?? '',
    iap_apple_status: row.iap_apple_status ?? 'not_created',
    iap_google_status: row.iap_google_status ?? 'not_created',
    iap_synced_at: row.iap_synced_at ?? null,
  };
}

export function mergeCityRowWithApiDetail(row, detail) {
  const base = fromApiCity(row) || {};
  const d = detail && typeof detail === 'object' ? detail : {};

  return {
    ...base,
    name: d.name || base.name || {},
    description: d.description || base.description || {},
    country: d.country || base.country || {},
    lat: d.lat ?? base.lat ?? '',
    lon: d.lon ?? base.lon ?? '',
    image_id: d.image_id ?? base.image_id ?? null,
    image_url: d.image_url ?? base.image_url ?? null,
    image_copyright: d.image_copyright ?? base.image_copyright ?? '',
    city_filter_ids: (d.city_filter_ids || base.city_filter_ids || []).map(String),
    is_show: d.is_show ?? base.is_show ?? true,
    iap_sku: d.iap_sku ?? base.iap_sku ?? '',
    iap_price_usd: d.iap_price_usd ?? base.iap_price_usd ?? '',
    iap_apple_status: d.iap_apple_status ?? base.iap_apple_status ?? 'not_created',
    iap_google_status: d.iap_google_status ?? base.iap_google_status ?? 'not_created',
    iap_synced_at: d.iap_synced_at ?? base.iap_synced_at ?? null,
  };
}

export function toApiCityUpdatePayload(city) {
  const payload = {
    name: city?.name || {},
    description: city?.description || {},
    country: city?.country || {},
    city_filter_ids: (city?.city_filter_ids || []).map(String),
    is_show: !!city?.is_show,
  };

  const latVal = city?.lat;
  const lonVal = city?.lon;
  if (latVal !== '' && latVal != null) payload.lat = parseFloat(latVal);
  if (lonVal !== '' && lonVal != null) payload.lon = parseFloat(lonVal);
  if (city?.image_id !== undefined) payload.image_id = city.image_id;
  if (city?.image_copyright !== undefined) payload.image_copyright = city.image_copyright;
  if (city?.iap_sku !== undefined) payload.iap_sku = city.iap_sku;
  if (city?.iap_price_usd !== '' && city?.iap_price_usd != null) payload.iap_price_usd = city.iap_price_usd;

  return payload;
}

