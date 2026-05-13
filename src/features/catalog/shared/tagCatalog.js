import { getMultiLangValue } from './i18n';
import { unwrapEnvelope } from './normalize';

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

export function mapCityTagCatalogRow(f) {
  const title = f?.title && typeof f.title === 'object' ? f.title : {};
  const desc = f?.description && typeof f.description === 'object' ? f.description : {};
  const name = Object.keys(title).length ? title : (typeof f?.name === 'string' ? { ru: f.name } : {});
  return {
    ...f,
    id: f.id,
    name,
    slug: f.name || String(f.id),
    emoji: typeof desc.emoji === 'string' ? desc.emoji : '',
    description: f.description,
    type: 'tag',
  };
}

export function mapEventFilterCatalogRow(f) {
  const title = f?.title && typeof f.title === 'object' ? f.title : {};
  const desc = f?.description && typeof f.description === 'object' ? f.description : {};
  const name = Object.keys(title).length ? title : (typeof f?.name === 'string' ? { ru: f.name } : {});
  return {
    ...f,
    id: f.id,
    name,
    slug: f.name || String(f.id),
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

export function buildCityTagCreatePayload(newFilter) {
  const titleObj = newFilter?.name && typeof newFilter.name === 'object' ? newFilter.name : {};
  const ru = titleObj.ru || getMultiLangValue(titleObj) || '';
  return {
    type: 'tag',
    parent_id: null,
    name: makeUniqueTagName(ru, 'city-tag'),
    title: Object.keys(titleObj).length ? titleObj : (ru ? { ru } : {}),
    description: newFilter?.emoji?.trim() ? { emoji: newFilter.emoji.trim() } : {},
    index: 0,
    is_show: true,
  };
}

export function buildCityTagUpdatePayload(editingFilter) {
  const payload = {
    type: 'tag',
    parent_id: null,
    title: editingFilter.name,
  };
  const desc = typeof editingFilter.description === 'object' && editingFilter.description
    ? { ...editingFilter.description }
    : {};
  if (editingFilter.emoji?.trim()) desc.emoji = editingFilter.emoji.trim();
  else delete desc.emoji;
  payload.description = desc;
  return payload;
}

export function buildEventFilterCreatePayload(newFilter) {
  const titleObj = newFilter?.name && typeof newFilter.name === 'object' ? newFilter.name : {};
  const ru = titleObj.ru || getMultiLangValue(titleObj) || '';
  const title = Object.keys(titleObj).length ? titleObj : (ru ? { ru } : {});
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

export function buildEventFilterUpdatePayload(editingFilter) {
  const payload = {
    type: editingFilter.type,
    title: editingFilter.name,
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
