import { getMultiLangValue } from './i18n';
import {
  collectIdsFromTree,
  ensureAppLanguages,
  removeFilterIdsFromTree,
  unwrapEnvelope,
  upsertEventFilterInTree,
} from './normalize';

function makeSlug(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function makeUniqueTagName(title, prefix = 'tag') {
  const base = makeSlug(title) || prefix;
  return `${base}-${Date.now().toString(36)}`;
}

/** Axios response → created filter object (city or event). */
export function unwrapCreatedFilter(res) {
  const payload = res?.data;
  if (payload == null) return null;

  const tryNode = (node) => {
    if (node == null) return null;
    if (Array.isArray(node)) {
      const first = node.find((x) => x && typeof x === 'object' && x.id != null);
      return first || null;
    }
    if (typeof node !== 'object') return null;
    if (node.id != null) return node;
    const nestedKeys = ['data', 'filter', 'city_filter', 'event_filter', 'result', 'item'];
    for (const key of nestedKeys) {
      const picked = tryNode(node[key]);
      if (picked) return picked;
    }
    return null;
  };

  const unwrapped = unwrapEnvelope(payload);
  return tryNode(unwrapped) || tryNode(payload);
}

/** Normalize POST response body to a consistent filter shape for local state. */
export function normalizeCreatedFilter(raw, appLanguages) {
  if (!raw || raw.id == null) return null;

  const parent = raw.parent;
  const parentId =
    raw.parent_id != null && raw.parent_id !== ''
      ? raw.parent_id
      : parent?.id ?? parent ?? null;

  const title = appLanguages?.length
    ? ensureAppLanguages(raw.title, appLanguages)
    : raw.title;

  return {
    ...raw,
    id: raw.id,
    name: typeof raw.name === 'object' ? raw.name : raw.name,
    title,
    description: raw.description,
    type: raw.type,
    parent_id: parentId,
    parent: typeof parent === 'object' ? parent : undefined,
    image_url: raw.image_url ?? raw.imageUrl,
    index: raw.index,
    is_show: raw.is_show ?? raw.isShow,
  };
}

export function isCityFilterItem(item) {
  if (!item) return false;
  const type = String(item.type || 'tag').toLowerCase();
  return type !== 'folder';
}

export function isEventFilterItem(item) {
  return Boolean(item?.id);
}

/**
 * Mark id as locally deleted and remove from created overlay (Map or ref.current).
 * @param {string|number} id
 * @param {Set} deletedRef
 * @param {Map} [createdRef]
 */
export function applyLocalFilterDeletion(id, deletedRef, createdRef) {
  const idStr = String(id);
  deletedRef.add(idStr);
  createdRef?.delete(idStr);
  return idStr;
}

/** Merge a flat filter list with local create/delete overlays. */
export function mergeFlatFilterListWithLocalOverlays(
  rows,
  locallyCreatedRef,
  locallyDeletedRef,
  { cityTagsOnly = false } = {},
) {
  let nextRows = Array.isArray(rows) ? [...rows] : [];

  nextRows = nextRows.filter(
    (item) => !locallyDeletedRef.has(String(item.id)),
  );

  const fetchedIds = new Set(nextRows.map((item) => String(item.id)));

  for (const [id, item] of locallyCreatedRef.entries()) {
    if (cityTagsOnly && !isCityFilterItem(item)) continue;

    if (fetchedIds.has(id)) {
      locallyCreatedRef.delete(id);
    } else if (!locallyDeletedRef.has(id)) {
      nextRows = upsertFlatFilterRow(nextRows, item);
    }
  }

  return nextRows;
}

/** Merge fetched city tag rows with local create/delete overlays. */
export function mergeCityTagCatalogWithLocalOverlays(
  rows,
  locallyCreatedRef,
  locallyDeletedRef,
) {
  return mergeFlatFilterListWithLocalOverlays(
    rows,
    locallyCreatedRef,
    locallyDeletedRef,
    { cityTagsOnly: true },
  );
}

/** Merge fetched city filter tree (folders / nested tags only, not flat catalog tags). */
export function mergeCityFilterTreeWithLocalOverlays(
  tree,
  locallyCreatedRef,
  locallyDeletedRef,
) {
  let nextTree = Array.isArray(tree) ? tree : [];

  nextTree = removeFilterIdsFromTree(nextTree, locallyDeletedRef);

  const fetchedIds = collectIdsFromTree(nextTree);

  for (const [id, item] of locallyCreatedRef.entries()) {
    const type = String(item?.type || '').toLowerCase();
    const hasParent =
      item?.parent_id != null && String(item.parent_id) !== '';

    if (type === 'tag' && !hasParent) {
      continue;
    }

    if (fetchedIds.has(id)) {
      locallyCreatedRef.delete(id);
    } else if (!locallyDeletedRef.has(id)) {
      nextTree = upsertEventFilterInTree(nextTree, item);
      fetchedIds.add(id);
    }
  }

  return nextTree;
}

/** Merge fetched event filter tree with local create/delete overlays. */
export function mergeEventFilterTreeWithLocalOverlays(
  tree,
  locallyCreatedRef,
  locallyDeletedRef,
) {
  let nextTree = Array.isArray(tree) ? tree : [];

  nextTree = removeFilterIdsFromTree(nextTree, locallyDeletedRef);

  const fetchedIds = collectIdsFromTree(nextTree);

  for (const [id, item] of locallyCreatedRef.entries()) {
    if (!isEventFilterItem(item)) continue;

    if (fetchedIds.has(id)) {
      locallyCreatedRef.delete(id);
    } else if (!locallyDeletedRef.has(id)) {
      nextTree = upsertEventFilterInTree(nextTree, item);
      fetchedIds.add(id);
    }
  }

  return nextTree;
}

export function upsertFlatFilterRow(rows = [], row) {
  const id = String(row?.id ?? '');

  if (!id) return rows;

  const next = rows.filter((item) => String(item.id) !== id);

  const nameKey = (r) =>
    typeof r?.name === 'string'
      ? r.name
      : getMultiLangValue(r?.name) || String(r?.slug || r?.id || '');

  return [...next, row].sort((a, b) => {
    const indexA = Number.isFinite(Number(a?.index)) ? Number(a.index) : 0;
    const indexB = Number.isFinite(Number(b?.index)) ? Number(b.index) : 0;

    if (indexA !== indexB) return indexA - indexB;

    return nameKey(a).localeCompare(nameKey(b));
  });
}

export function mapCityTagCatalogRow(f, appLanguages) {
  const rawTitle = f?.title && typeof f.title === 'object' ? f.title : {};
  const fallbackTitle = typeof f?.name === 'string' && f.name && !rawTitle.ru && !rawTitle.en
    ? { ru: f.name }
    : {};
  const title = Object.keys(rawTitle).length ? rawTitle : fallbackTitle;
  const desc = f?.description && typeof f.description === 'object' ? f.description : {};
  const name = appLanguages?.length
    ? ensureAppLanguages(title, appLanguages)
    : title;
  return {
    ...f,
    id: f.id,
    name,
    title: name,
    slug: typeof f?.name === 'string' ? f.name : String(f.id),
    emoji: typeof desc.emoji === 'string' ? desc.emoji : '',
    description: f.description,
    type: 'tag',
  };
}

export function mapEventFilterCatalogRow(f, appLanguages) {
  const rawTitle = f?.title && typeof f.title === 'object' ? f.title : {};
  const fallbackTitle = typeof f?.name === 'string' && f.name && !rawTitle.ru && !rawTitle.en
    ? { ru: f.name }
    : {};
  const title = Object.keys(rawTitle).length ? rawTitle : fallbackTitle;
  const desc = f?.description && typeof f.description === 'object' ? f.description : {};
  const name = appLanguages?.length
    ? ensureAppLanguages(title, appLanguages)
    : title;
  return {
    ...f,
    id: f.id,
    name,
    title: name,
    slug: typeof f?.name === 'string' ? f.name : String(f.id),
    emoji: typeof desc.emoji === 'string' ? desc.emoji : '',
    type: f.type || (f.parent_id ? 'tag' : 'folder'),
  };
}

export function mapCityTagForCityEditor(f) {
  const row = mapCityTagCatalogRow(f);
  return {
    ...row,
    display_name: getMultiLangValue(row.name) || row.slug || String(row.id),
  };
}

export function mapEventTagForEventEditor(f) {
  const row = mapEventFilterCatalogRow(f);
  const label = getMultiLangValue(row.name) || row.slug || String(row.id);
  return {
    ...row,
    display_name: label,
  };
}

export function buildCityTagCreatePayload(newFilter, appLanguages, defaultLang = 'ru') {
  const titleObj = newFilter?.name && typeof newFilter.name === 'object' ? newFilter.name : {};
  const normalized = appLanguages?.length
    ? ensureAppLanguages(titleObj, appLanguages, defaultLang)
    : titleObj;
  const ru = normalized.ru || getMultiLangValue(normalized) || '';
  return {
    type: 'tag',
    parent_id: null,
    name: makeUniqueTagName(ru, 'city-tag'),
    title: normalized,
    description: newFilter?.emoji?.trim() ? { emoji: newFilter.emoji.trim() } : {},
    index: 0,
    is_show: true,
  };
}

export function buildCityTagUpdatePayload(editingFilter, appLanguages) {
  const title = appLanguages?.length
    ? ensureAppLanguages(editingFilter.name, appLanguages)
    : editingFilter.name;
  const payload = {
    type: 'tag',
    parent_id: null,
    title,
  };
  const desc = typeof editingFilter.description === 'object' && editingFilter.description
    ? { ...editingFilter.description }
    : {};
  if (editingFilter.emoji?.trim()) desc.emoji = editingFilter.emoji.trim();
  else delete desc.emoji;
  payload.description = desc;
  return payload;
}

export function buildEventFilterCreatePayload(newFilter, appLanguages, defaultLang = 'ru') {
  const titleObj = newFilter?.name && typeof newFilter.name === 'object' ? newFilter.name : {};
  const title = appLanguages?.length
    ? ensureAppLanguages(titleObj, appLanguages, defaultLang)
    : (Object.keys(titleObj).length ? titleObj : (titleObj.ru ? titleObj : {}));
  const ru = title.ru || getMultiLangValue(title) || '';
  const isFolder = newFilter.kind !== 'tag';
  if (isFolder) {
    return {
      type: 'folder',
      parent_id: null,
      name: makeUniqueTagName(ru || 'folder', 'event-folder'),
      title,
      description: newFilter?.emoji?.trim() ? { emoji: newFilter.emoji.trim() } : {},
      index: 0,
      is_show: true,
    };
  }
  const parentId = newFilter.parent_folder_id;
  if (!parentId) {
    const err = new Error('Выберите папку для тега');
    err.code = 'parent_folder_required';
    throw err;
  }
  return {
    type: 'tag',
    parent_id: parentId,
    name: makeUniqueTagName(ru || 'tag', 'event-tag'),
    title,
    description: newFilter?.emoji?.trim() ? { emoji: newFilter.emoji.trim() } : {},
    index: 0,
    is_show: true,
  };
}

export function buildEventFilterUpdatePayload(editingFilter, appLanguages) {
  const title = appLanguages?.length
    ? ensureAppLanguages(editingFilter.name, appLanguages)
    : editingFilter.name;
  const payload = {
    type: editingFilter.type,
    title,
    parent_id: editingFilter.type === 'tag' ? (editingFilter.parent_id || null) : null,
  };
  const desc = typeof editingFilter.description === 'object' && editingFilter.description
    ? { ...editingFilter.description }
    : {};
  if (editingFilter.emoji?.trim()) desc.emoji = editingFilter.emoji.trim();
  else delete desc.emoji;
  payload.description = desc;
  return payload;
}
