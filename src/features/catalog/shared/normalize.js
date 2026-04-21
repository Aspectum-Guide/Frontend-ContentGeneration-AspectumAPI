export function normalizeListResponse(data, listKeys = ['results', 'data', 'items', 'events', 'filters', 'tags']) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  for (const key of listKeys) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

export function normalizeTotalResponse(data, fallbackCount) {
  if (!data || typeof data !== 'object') {
    return fallbackCount;
  }

  return data.total ?? data.count ?? fallbackCount;
}

export function normalizePaginatedResponse(data, listKeys) {
  const items = normalizeListResponse(data, listKeys);
  const total = normalizeTotalResponse(data, items.length);
  return { items, total };
}
