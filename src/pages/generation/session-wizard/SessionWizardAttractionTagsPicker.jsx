import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeId } from './sessionWizardShared.jsx';

function getMultilangDisplay(value, fallback = '') {
  if (!value) return fallback;

  if (typeof value === 'string') return value || fallback;

  if (typeof value === 'object') {
    return (
      value.ru ||
      value.en ||
      value.it ||
      Object.values(value).find(
        (item) => typeof item === 'string' && item.trim()
      ) ||
      fallback
    );
  }

  return fallback;
}

const CHILD_KEYS = [
  'children',
  'tags',
  'items',
  'child_filters',
  'filters',
  'subfilters',
];

function getFilterChildren(node) {
  if (!node || typeof node !== 'object') return [];
  for (const key of CHILD_KEYS) {
    const raw = node[key];
    if (Array.isArray(raw)) return raw;
  }
  return [];
}

function getSearchBlob(node) {
  const namePart =
    typeof node?.name === 'string'
      ? node.name
      : node?.name && typeof node.name === 'object'
        ? Object.values(node.name)
            .filter((v) => typeof v === 'string')
            .join(' ')
        : '';

  const parts = [
    namePart,
    getMultilangDisplay(node?.title),
    getMultilangDisplay(node?.description),
    ...(typeof node?.title === 'object' && node.title
      ? Object.values(node.title).filter((v) => typeof v === 'string')
      : []),
    ...(typeof node?.description === 'object' && node.description
      ? Object.values(node.description).filter((v) => typeof v === 'string')
      : []),
  ];

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function collectTagItems(nodes) {
  const out = [];
  const seen = new Set();

  function add(node) {
    const id = normalizeId(node.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(node);
  }

  function walk(items) {
    if (!Array.isArray(items)) return;
    for (const node of items) {
      if (!node || typeof node !== 'object') continue;
      const t = String(node.type || node.filter_type || '').toLowerCase();
      const children = getFilterChildren(node);

      if (t === 'folder') {
        walk(children);
        continue;
      }
      if (t === 'tag') {
        add(node);
        continue;
      }
      if (children.length > 0) {
        walk(children);
        continue;
      }
      if (normalizeId(node.id) && (node.name || node.title)) {
        add(node);
      }
    }
  }

  walk(Array.isArray(nodes) ? nodes : []);
  return out;
}

function countSelectedTagsInFolder(folder, selectedSet) {
  const children = getFilterChildren(folder).filter(
    (ch) => String(ch.type || '').toLowerCase() === 'tag',
  );
  return children.reduce(
    (n, ch) => n + (selectedSet.has(normalizeId(ch.id)) ? 1 : 0),
    0,
  );
}

function pillLabelForNode(node) {
  if (!node) return '';
  const title = node.title;
  if (typeof title === 'object' && title) {
    const fromTitle =
      title.ru ||
      title.en ||
      Object.values(title).find((v) => typeof v === 'string' && v.trim());
    if (fromTitle) return fromTitle;
  }
  return (
    getMultilangDisplay(node.display_name) ||
    getMultilangDisplay(node.name) ||
    normalizeId(node.id)
  );
}

function pillLabelForId(tagId, tagById) {
  const node = tagById.get(tagId);
  if (node) return pillLabelForNode(node);
  const short = tagId.length > 12 ? `${tagId.slice(0, 8)}…` : tagId;
  return tagId ? `Неизвестный тег (${short})` : 'Неизвестный тег';
}

export default function SessionWizardAttractionTagsPicker({
  selectedTags = [],
  eventFilterTree = [],
  eventFilterTreeLoading = false,
  eventFilterTreeError = '',
  onToggleTag,
  onReloadEventFilters,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  const tagItems = useMemo(
    () => collectTagItems(eventFilterTree),
    [eventFilterTree],
  );

  const tagById = useMemo(() => {
    const m = new Map();
    tagItems.forEach((node) => {
      const id = normalizeId(node.id);
      if (id) m.set(id, node);
    });
    return m;
  }, [tagItems]);

  const selectedTagIds = useMemo(
    () => new Set(selectedTags.map(normalizeId).filter(Boolean)),
    [selectedTags],
  );

  const q = String(search || '').trim().toLowerCase();

  const folderSections = useMemo(() => {
    const folders = Array.isArray(eventFilterTree) ? eventFilterTree : [];
    return folders
      .map((folder) => {
        const fid = normalizeId(folder.id);
        const children = getFilterChildren(folder).filter(
          (ch) => String(ch.type || '').toLowerCase() === 'tag',
        );
        const visibleTags = !q
          ? children
          : children.filter((ch) => getSearchBlob(ch).includes(q));
        const folderMatches = getSearchBlob(folder).includes(q);
        if (visibleTags.length === 0 && q && !folderMatches) return null;
        return { folder, fid, visibleTags };
      })
      .filter(Boolean);
  }, [eventFilterTree, q]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const toggle = useCallback(
    (tagId) => {
      const id = normalizeId(tagId);
      if (!id) return;
      onToggleTag?.(id);
    },
    [onToggleTag],
  );

  const listLoading = eventFilterTreeLoading && tagItems.length === 0;

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100">
      <div>
        <h3 className="text-base font-semibold text-gray-900">
          Теги достопримечательности
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Только выбор из справочника. Управление — во вкладке «Теги».
        </p>
      </div>

      {listLoading && (
        <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
          Загрузка тегов…
        </div>
      )}

      {eventFilterTreeError && tagItems.length === 0 && !listLoading && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800 space-y-2">
          <p>{eventFilterTreeError}</p>
          <button
            type="button"
            onClick={() => onReloadEventFilters?.()}
            className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 rounded-lg hover:bg-red-100"
          >
            Повторить
          </button>
        </div>
      )}

      {!listLoading && tagItems.length === 0 && !eventFilterTreeError && (
        <div className="text-sm text-gray-600 py-4 px-3 border border-dashed border-gray-200 rounded-lg bg-gray-50">
          Теги событий пока не созданы. Создайте папки и теги во вкладке «Теги».
        </div>
      )}

      {!listLoading && tagItems.length > 0 && (
        <>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Выбранные:</p>
            {selectedTagIds.size === 0 ? (
              <p className="text-xs text-gray-400">Пока ни одного тега</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((rawId) => {
                  const id = normalizeId(rawId);
                  if (!id) return null;
                  const label = pillLabelForId(id, tagById);
                  return (
                    <span
                      key={id}
                      title={id}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
                    >
                      <span className="max-w-[200px] truncate">{label}</span>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-100 text-blue-700"
                        aria-label="Убрать тег"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              + Добавить тег
            </button>

            {menuOpen ? (
              <div className="absolute z-50 left-0 top-full mt-2 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-lg p-3 space-y-2">
                <label className="block text-xs font-medium text-gray-600">Поиск</label>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Название, папка…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />

                <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                  {folderSections.length === 0 ? (
                    <p className="text-xs text-gray-500 p-3">Ничего не найдено</p>
                  ) : (
                    folderSections.map(({ folder, fid, visibleTags }) => {
                      const folderTitle =
                        getMultilangDisplay(folder.title ?? folder.name) || fid;
                      const nSel = countSelectedTagsInFolder(folder, selectedTagIds);
                      return (
                        <div key={fid} className="border-b border-gray-100 last:border-b-0">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 sticky top-0">
                            {folderTitle}
                            {nSel > 0 ? (
                              <span className="ml-2 text-blue-600 font-normal">
                                ({nSel} выбрано)
                              </span>
                            ) : null}
                          </div>
                          <div className="divide-y divide-gray-50">
                            {visibleTags.map((node) => {
                              const id = normalizeId(node.id);
                              const checked = selectedTagIds.has(id);
                              const label = pillLabelForNode(node) || id;
                              return (
                                <label
                                  key={id}
                                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(id)}
                                  />
                                  <span className="truncate">{label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
