/** Unwrap `{ status: 'ok', data }` from EventsAPI / CityAPI JSON envelopes. */
export function unwrapEnvelope(payload) {
  if (payload != null && typeof payload === 'object' && payload.status === 'ok' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

/**
 * Flatten EventsAPI filter tree nodes (with `children`) into a list with `parent_id`.
 */
export function flattenEventFilterTree(nodes, parentId = null, out = []) {
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const id = node.id;
    const pid = node.parent_id != null && node.parent_id !== undefined ? node.parent_id : parentId;
    out.push({ ...node, parent_id: pid });
    if (Array.isArray(node.children) && node.children.length) {
      flattenEventFilterTree(node.children, id, out);
    }
  }
  return out;
}

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

const FILTER_TREE_CHILD_KEYS = [
  'children',
  'subfilters',
  'tags',
  'items',
  'child_filters',
  'filters',
];

/** Remove any nodes whose id is in deletedIdsSet, recursing into known child-array properties. */
export function removeFilterIdsFromTree(nodes = [], deletedIdsSet) {
  if (!Array.isArray(nodes)) return [];
  if (!deletedIdsSet || deletedIdsSet.size === 0) return nodes;

  const set = deletedIdsSet instanceof Set ? deletedIdsSet : new Set(deletedIdsSet);

  return nodes
    .filter((node) => node && !set.has(String(node.id)))
    .map((node) => {
      let out = { ...node };
      for (const key of FILTER_TREE_CHILD_KEYS) {
        if (Array.isArray(node[key])) {
          out = { ...out, [key]: removeFilterIdsFromTree(node[key], set) };
        }
      }
      return out;
    });
}

export function removeFilterNodeFromTree(nodes = [], deletedId) {
  return removeFilterIdsFromTree(nodes, new Set([String(deletedId)]));
}
