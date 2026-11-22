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
    <div className="space-y-3 pt-2 border-t border-aspectum-border-subtle">
      <SectionHeader level={3} size="sm" descriptionSize="xs" title="Теги достопримечательности" description="Только выбор из справочника. Управление — во вкладке «Теги»." />

      {listLoading && (
        <div className="text-sm text-aspectum-text-muted py-4 text-center border border-dashed border-aspectum-border rounded-aspectum-control">
          Загрузка тегов…
        </div>
      )}

      {eventFilterTreeError && tagItems.length === 0 && !listLoading && (
        <Alert tone="error" className="text-sm space-y-2">
          <p>{eventFilterTreeError}</p>
          <Button
            onClick={() => onReloadEventFilters?.()}
            variant="outlineDanger"
            size="sm"
          >
            Повторить
          </Button>
        </Alert>
      )}

      {!listLoading && tagItems.length === 0 && !eventFilterTreeError && (
        <EmptyState
          title="Теги событий пока не созданы"
          description="Создайте папки и теги во вкладке «Теги»."
          className="py-4"
        />
      )}

      {!listLoading && tagItems.length > 0 && (
        <>
          <div>
            <p className="text-xs font-medium text-aspectum-text-subtle mb-2">Выбранные:</p>
            {selectedTagIds.size === 0 ? (
              <p className="text-xs text-aspectum-text-disabled">Пока ни одного тега</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((rawId) => {
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
                <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название, папка…" autoFocus />

                <div className="max-h-64 overflow-y-auto border border-aspectum-border-subtle rounded-aspectum-control">
                  {folderSections.length === 0 ? (
                    <InlineState size="xs" className="p-3">Ничего не найдено</InlineState>
                  ) : (
                    folderSections.map(({ folder, fid, visibleTags }) => {
                      const folderTitle =
                        getMultilangDisplay(folder.title ?? folder.name) || fid;
                      const nSel = countSelectedTagsInFolder(folder, selectedTagIds);
                      return (
                        <div key={fid} className="border-b border-aspectum-border-subtle last:border-b-0">
                          <div className="px-3 py-2 text-xs font-semibold text-aspectum-text-subtle bg-aspectum-surface-muted sticky top-0">
                            {folderTitle}
                            {nSel > 0 ? (
                              <span className="ml-2 text-aspectum-primary font-normal">
                                ({nSel} выбрано)
                              </span>
                            ) : null}
                          </div>
                          <CheckboxTree
                            groups={[{ id: fid, items: visibleTags }]}
                            selected={[...selectedTagIds]}
                            onToggle={toggle}
                            showGroupHeaders={false}
                            getItemLabel={(node) => pillLabelForNode(node) || normalizeId(node.id)}
                          />
                        </div>
                      );
                    })
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
