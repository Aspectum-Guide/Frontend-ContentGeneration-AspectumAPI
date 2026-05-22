export const DEFAULT_APP_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'it', label: 'Italian' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
];

/**
 * Ensure a multilingual object has every app language key (missing → '').
 * Preserves existing values; does not add keys outside appLanguages unless already present.
 */
export const ensureAppLanguages = (value, appLanguages, defaultLang = 'ru') => {
  const langs = Array.isArray(appLanguages) && appLanguages.length
    ? appLanguages
    : DEFAULT_APP_LANGUAGES;
  const out = Object.fromEntries(langs.map((lang) => [lang.code, '']));

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, val]) => {
      const lang = String(key || '').trim().toLowerCase();
      if (!lang) return;
      if (Object.prototype.hasOwnProperty.call(out, lang)) {
        out[lang] = val == null ? '' : String(val);
      }
    });
    return out;
  }

  if (typeof value === 'string') {
    const lang = out[defaultLang] !== undefined ? defaultLang : langs[0]?.code;
    if (lang) out[lang] = value;
  }

  return out;
};

/** Map API `{ code, label }` to MultiLangInput `{ code, name }` (preferred language first). */
export function mapAppLanguagesForMultiLangInput(appLanguages, preferredFirst = 'ru') {
  const langs = Array.isArray(appLanguages) && appLanguages.length
    ? appLanguages
    : DEFAULT_APP_LANGUAGES;
  const sorted = [...langs].sort((a, b) => {
    if (a.code === preferredFirst) return -1;
    if (b.code === preferredFirst) return 1;
    return 0;
  });
  return sorted.map(({ code, label, name }) => ({
    code,
    name: label || name || code,
  }));
}

/** Parse GET /generation/app-languages/ (or fallback). */
export function parseAppLanguagesResponse(res) {
  const payload = res?.data;
  if (Array.isArray(payload?.languages) && payload.languages.length) {
    return payload.languages.map(({ code, label }) => ({
      code: String(code || '').trim().toLowerCase(),
      label: String(label || code || ''),
    })).filter((row) => row.code);
  }
  if (payload?.success && Array.isArray(payload.languages)) {
    return payload.languages.map(({ code, label }) => ({
      code: String(code || '').trim().toLowerCase(),
      label: String(label || code || ''),
    })).filter((row) => row.code);
  }
  return DEFAULT_APP_LANGUAGES;
}

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

const getTreeChildArray = (node) => {
  if (!node || typeof node !== 'object') return { key: 'children', list: [] };
  for (const key of FILTER_TREE_CHILD_KEYS) {
    if (Array.isArray(node[key])) {
      return { key, list: node[key] };
    }
  }
  return { key: 'children', list: [] };
};

export function getFilterChildren(node) {
  return getTreeChildArray(node).list;
}

export function sortFilterRows(rows = []) {
  return [...rows].sort((a, b) => {
    const indexA = Number.isFinite(Number(a?.index)) ? Number(a.index) : 0;
    const indexB = Number.isFinite(Number(b?.index)) ? Number(b.index) : 0;

    if (indexA !== indexB) return indexA - indexB;

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

/** Collect all node ids from an event filter tree (depth-first). */
export function collectIdsFromTree(tree = [], out = null) {
  const ids = out || new Set();
  if (!Array.isArray(tree)) return ids;

  for (const node of tree) {
    if (!node || node.id == null) continue;
    ids.add(String(node.id));
    collectIdsFromTree(getFilterChildren(node), ids);
  }

  return ids;
}

/**
 * Insert or replace an event filter node (root folder or tag in folder).
 * Recurses into nested folders when parent is not at the current level.
 */
export function upsertEventFilterInTree(tree = [], item) {
  const itemId = String(item?.id || '');
  const parentId = String(
    item?.parent_id != null && item?.parent_id !== ''
      ? item.parent_id
      : item?.parent?.id ?? '',
  );

  if (!itemId) return tree;

  const baseTree = Array.isArray(tree) ? tree : [];

  // Root-level folder (no parent)
  if (!parentId) {
    const withoutSame = baseTree.filter((node) => String(node.id) !== itemId);
    const { key, list } = getTreeChildArray(item);

    return sortFilterRows([
      ...withoutSame,
      {
        ...item,
        type: item.type || 'folder',
        [key]: list,
      },
    ]);
  }

  let inserted = false;

  const nextTree = baseTree.map((node) => {
    const nodeId = String(node?.id || '');
    const childKey = getTreeChildArray(node).key;
    const children = getFilterChildren(node);

    if (nodeId === parentId) {
      inserted = true;
      const { key } = getTreeChildArray(node);

      return {
        ...node,
        [key]: sortFilterRows([
          ...children.filter((child) => String(child.id) !== itemId),
          {
            ...item,
            type: item.type || 'tag',
            parent_id: item.parent_id ?? parentId,
          },
        ]),
      };
    }

    const nested = upsertEventFilterInTree(children, item);
    if (nested !== children) {
      inserted = true;
      return { ...node, [childKey]: nested };
    }

    return node;
  });

  return inserted ? nextTree : baseTree;
}

/** Insert or replace a root-level event folder node. */
export function upsertEventFilterFolderInTree(tree = [], folder) {
  return upsertEventFilterInTree(tree, {
    ...folder,
    type: folder?.type || 'folder',
    parent_id: folder?.parent_id ?? null,
  });
}

/** Insert or replace a tag under a folder in the event filter tree. */
export function upsertEventFilterTagInTree(tree = [], parentFolderId, tag) {
  const pid = String(parentFolderId || '');
  if (!pid || !tag?.id) return tree;

  return upsertEventFilterInTree(tree, {
    ...tag,
    type: tag.type || 'tag',
    parent_id: tag.parent_id ?? pid,
  });
}

export function removeFilterNodeFromTree(nodes = [], deletedId) {
  return removeFilterIdsFromTree(nodes, new Set([String(deletedId)]));
}
