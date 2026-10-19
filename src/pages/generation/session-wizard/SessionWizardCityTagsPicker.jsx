import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeId } from './sessionWizardShared.jsx';
import { FormLabel, Alert, Button, CheckboxTree, Chip, DropdownPanel, EmptyState, InlineState, SectionHeader, TextInput } from '@aspectum/admin-ui-web';

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

export default function SessionWizardCityTagsPicker({
  cityTags = [],

  cityTagCatalog = [],
  cityTagCatalogLoading = false,
  cityTagCatalogError = '',
  onReloadCityTagCatalog,

  cityFilterTree = [],
  cityFilterTreeLoading = false,
  cityFilterTreeError = '',
  onReloadCityFilters,

  onToggleCityTag,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  const catalogTagsOnly = useMemo(() => {
    if (!Array.isArray(cityTagCatalog)) return [];
    return cityTagCatalog.filter(
      (t) => String(t.type || '').toLowerCase() !== 'folder',
    );
  }, [cityTagCatalog]);

  const tagItems = useMemo(() => {
    if (catalogTagsOnly.length > 0) {
      return catalogTagsOnly;
    }
    if (cityTagCatalogError) {
      return collectTagItems(cityFilterTree);
    }
    if (!cityTagCatalogLoading) {
      const fromTree = collectTagItems(cityFilterTree);
      if (fromTree.length > 0) return fromTree;
    }
    return catalogTagsOnly;
  }, [
    catalogTagsOnly,
    cityTagCatalogLoading,
    cityTagCatalogError,
    cityFilterTree,
  ]);

  const listLoading =
    cityTagCatalogLoading ||
    (tagItems.length === 0 &&
      !cityTagCatalogError &&
      !cityTagCatalogLoading &&
      cityFilterTreeLoading);

  const listError = cityTagCatalogError && tagItems.length === 0;

  const tagById = useMemo(() => {
    const m = new Map();
    tagItems.forEach((node) => {
      const id = normalizeId(node.id);
      if (id) m.set(id, node);
    });
    return m;
  }, [tagItems]);

  const selectedTagIds = useMemo(
    () => new Set(cityTags.map(normalizeId).filter(Boolean)),
    [cityTags]
  );

  const filteredTags = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return tagItems;
    return tagItems.filter((node) => getSearchBlob(node).includes(q));
  }, [tagItems, search]);

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
      onToggleCityTag?.(id);
    },
    [onToggleCityTag]
  );

  return (
    <div className="space-y-3 pt-2 border-t border-aspectum-border-subtle">
      <SectionHeader level={3} size="sm" descriptionSize="xs" title="Теги города" description="Только выбор из справочника. Управление — во вкладке «Теги»." />

      {listLoading && (
        <div className="text-sm text-aspectum-text-muted py-4 text-center border border-dashed border-aspectum-border rounded-aspectum-control">
          Загрузка тегов…
        </div>
      )}

      {listError && (
        <Alert tone="error" className="text-sm space-y-2">
          <p>{cityTagCatalogError}</p>
          <Button
            onClick={() => onReloadCityTagCatalog?.()}
            variant="outlineDanger"
            size="sm"
          >
            Повторить
          </Button>
        </Alert>
      )}

      {!listLoading && !listError && cityFilterTreeError && tagItems.length === 0 && (
        <Alert tone="error" className="text-sm space-y-2">
          <p>{cityFilterTreeError}</p>
          <Button
            onClick={() => onReloadCityFilters?.()}
            variant="outlineDanger"
            size="sm"
          >
            Повторить
          </Button>
        </Alert>
      )}

      {!listLoading && !listError && tagItems.length === 0 && (
        <EmptyState
          title="Теги пока не созданы"
          description="Создайте их во вкладке «Теги»."
          className="py-4"
        />
      )}

      {!listLoading && !listError && tagItems.length > 0 && (
        <>
          <div>
            <p className="text-xs font-medium text-aspectum-text-subtle mb-2">Выбранные:</p>
            {selectedTagIds.size === 0 ? (
              <p className="text-xs text-aspectum-text-disabled">Пока ни одного тега</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cityTags.map((rawId) => {
                  const id = normalizeId(rawId);
                  if (!id) return null;
                  const label = pillLabelForId(id, tagById);
                  return (
                    <Chip
                      key={id}
                      title={id}
                      variant="primary"
                      removable
                      onRemove={() => toggle(id)}
                    >
                      <span className="max-w-[200px] truncate">{label}</span>
                    </Chip>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative" ref={wrapRef}>
            <Button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              variant="softStrong"
              size="sm"
            >
              + Добавить тег
            </Button>

            {menuOpen ? (
              <DropdownPanel className="absolute z-50 left-0 top-full mt-2 w-full max-w-md p-3 space-y-2">
                <FormLabel  layout="block" size="xs" weight="medium" tone="subtle">Поиск</FormLabel>
                <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название, описание…" autoFocus />

                <div className="max-h-56 overflow-y-auto rounded-aspectum-control border border-aspectum-border-subtle">
                  {filteredTags.length === 0 ? (
                    <InlineState size="xs" className="p-3">Ничего не найдено</InlineState>
                  ) : (
                    <CheckboxTree
                      groups={[{ id: 'search-results', label: 'Результаты', items: filteredTags }]}
                      selected={[...selectedTagIds]}
                      onToggle={toggle}
                      getItemLabel={(node) => pillLabelForNode(node) || normalizeId(node.id)}
                    />
                  )}
                </div>
              </DropdownPanel>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
