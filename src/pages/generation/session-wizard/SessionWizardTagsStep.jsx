import { useCallback, useMemo, useRef, useState } from 'react';

const transliterateRu = (value) => {
  const map = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  return String(value || '')
    .split('')
    .map((char) => map[char.toLowerCase()] ?? char)
    .join('');
};

const makeSlug = (value) => {
  return transliterateRu(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const makeUniqueName = (title, prefix = 'tag') => {
  const base = makeSlug(title) || prefix;
  return `${base}-${Date.now().toString(36)}`;
};

const getMultilangDisplay = (value, fallback = '') => {
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
};

const normalizeId = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '');
  }

  return String(value);
};

const TREE_CHILD_KEYS = [
  'children',
  'subfilters',
  'tags',
  'items',
  'child_filters',
  'filters',
];

const getTreeChildNodes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const raw =
    node.children ??
    node.subfilters ??
    node.tags ??
    node.items ??
    node.child_filters ??
    node.filters;
  return Array.isArray(raw) ? raw : [];
};

function setTreeChildren(node, newChildren) {
  const next = { ...node };
  let set = false;
  for (const k of TREE_CHILD_KEYS) {
    if (Array.isArray(node[k])) {
      next[k] = newChildren;
      set = true;
    }
  }
  if (!set) {
    next.children = newChildren;
  }
  return next;
}

function getFilterType(node) {
  const t = (node.type || node.filter_type || '').toLowerCase();
  if (t === 'tag') return 'tag';
  if (t === 'folder') return 'folder';
  return getTreeChildNodes(node).length > 0 ? 'folder' : 'tag';
}

const collectFolders = (nodes = []) => {
  const folders = [];

  const walk = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (getFilterType(item) === 'folder') {
        folders.push(item);
      }
      const children = getTreeChildNodes(item);
      if (children.length > 0) {
        walk(children);
      }
    });
  };

  walk(nodes);
  return folders;
};

const getSearchText = (item) => {
  const namePart =
    typeof item?.name === 'string'
      ? item.name
      : item?.name && typeof item.name === 'object'
        ? Object.values(item.name)
            .filter((v) => typeof v === 'string')
            .join(' ')
        : '';

  const parts = [
    namePart,
    getMultilangDisplay(item?.title),
    getMultilangDisplay(item?.description),
    ...(typeof item?.title === 'object' && item.title
      ? Object.values(item.title).filter((v) => typeof v === 'string')
      : []),
    ...(typeof item?.description === 'object' && item.description
      ? Object.values(item.description).filter((v) => typeof v === 'string')
      : []),
  ];

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

function filterTreeBySearch(nodes, query) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery) return nodes;

  return nodes
    .map((node) => {
      const children = getTreeChildNodes(node);
      const filteredChildren = filterTreeBySearch(children, cleanQuery);
      const selfMatches = getSearchText(node).includes(cleanQuery);

      if (selfMatches) {
        return node;
      }

      if (filteredChildren.length > 0) {
        return setTreeChildren(node, filteredChildren);
      }

      return null;
    })
    .filter(Boolean);
}

const countSelectedTagsInNode = (node, selectedTagIds) => {
  const children = getTreeChildNodes(node);
  let count = 0;

  for (const child of children) {
    const type = getFilterType(child);

    if (type === 'tag' && selectedTagIds.has(normalizeId(child.id))) {
      count += 1;
    }

    if (type === 'folder') {
      count += countSelectedTagsInNode(child, selectedTagIds);
    }
  }

  return count;
};

function resolveParentIdFromNode(node) {
  if (node?.parent_id != null && node.parent_id !== '') {
    return normalizeId(node.parent_id);
  }
  const p = node?.parent;
  if (p && typeof p === 'object') {
    return normalizeId(p.id ?? p.uuid ?? p.pk ?? p);
  }
  if (typeof p === 'string' && p.trim()) {
    return normalizeId(p);
  }
  return '';
}

/**
 * containingFolder — папка, внутри которой в UI отрисован тег (tree часто не отдаёт parent_id на теге).
 */
function nodeToFormInitial(node, containingFolder = null) {
  const title = node.title || {};
  const desc = node.description || {};
  const nameVal = node.name;
  const name =
    typeof nameVal === 'string'
      ? nameVal
      : nameVal && typeof nameVal === 'object'
        ? nameVal.ru || nameVal.en || ''
        : '';

  let parentId = resolveParentIdFromNode(node);
  if (!parentId && containingFolder) {
    parentId = normalizeId(containingFolder.id);
  }

  return {
    name: name || node.slug || '',
    titleRu: typeof title === 'object' ? title.ru || '' : '',
    titleEn: typeof title === 'object' ? title.en || '' : '',
    descriptionRu: typeof desc === 'object' ? desc.ru || '' : '',
    descriptionEn: typeof desc === 'object' ? desc.en || '' : '',
    index: node.index ?? 0,
    isShow: node.is_show !== false,
    picId: node.pic_id ?? node.picId ?? null,
    imageUrl: node.image_url || node.imageUrl || '',
    type: getFilterType(node),
    parentId,
  };
}

function CityFilterForm({
  mode,
  folderId = '',
  filterId = '',
  folderDisplayName = '',
  initialValue = null,
  folderOptions = [],
  onCreateCityFilterFolder,
  onCreateCityFilterTag,
  onUpdateCityFilter,
  onCancel,
  onUploadCityFilterImage,
}) {
  const isCreate = mode === 'create-folder' || mode === 'create-tag';
  const isEdit = mode === 'edit';

  const emptyForm = {
    name: '',
    titleRu: '',
    titleEn: '',
    descriptionRu: '',
    descriptionEn: '',
    index: 0,
    isShow: true,
    picId: null,
    imagePreview: '',
    parentId: '',
    filterType: 'folder',
  };

  const [quickTitle, setQuickTitle] = useState(() => {
    if (initialValue) {
      return initialValue.titleRu || '';
    }
    return '';
  });

  const [advancedOpen, setAdvancedOpen] = useState(isEdit);

  const [form, setForm] = useState(() => {
    if (initialValue) {
      const i = initialValue;
      return {
        name: i.name ?? '',
        titleRu: i.titleRu ?? '',
        titleEn: i.titleEn ?? '',
        descriptionRu: i.descriptionRu ?? '',
        descriptionEn: i.descriptionEn ?? '',
        index: i.index ?? 0,
        isShow: i.isShow !== false,
        picId: i.picId ?? null,
        imagePreview: i.imageUrl || '',
        parentId: i.parentId ?? '',
        filterType: i.type ?? 'folder',
      };
    }
    return {
      ...emptyForm,
      filterType: mode === 'create-tag' ? 'tag' : 'folder',
    };
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const openAdvanced = () => {
    const prefix = mode === 'create-folder' ? 'folder' : 'tag';
    setAdvancedOpen(true);
    setForm((prev) => ({
      ...prev,
      titleRu: prev.titleRu.trim() || quickTitle.trim(),
      name:
        prev.name.trim() ||
        makeUniqueName(quickTitle.trim(), prefix),
    }));
  };

  const buildFullPayload = useCallback(() => {
    const fType = form.filterType;
    const prefix = fType === 'folder' ? 'folder' : 'tag';
    const ruTitle = form.titleRu.trim() || quickTitle.trim();
    const enTitle = form.titleEn.trim();

    const title = {};
    if (ruTitle) title.ru = ruTitle;
    if (enTitle) title.en = enTitle;

    const description = {};
    if (form.descriptionRu.trim()) description.ru = form.descriptionRu.trim();
    if (form.descriptionEn.trim()) description.en = form.descriptionEn.trim();

    const name =
      form.name.trim() ||
      makeUniqueName(ruTitle || quickTitle.trim(), prefix);

    const resolvedTagParent =
      fType === 'tag'
        ? normalizeId(
          isEdit
            ? form.parentId || initialValue?.parentId
            : folderId
        )
        : null;

    return {
      type: fType,
      parent_id: fType === 'tag' ? resolvedTagParent : null,
      name,
      title,
      description,
      index: Number(form.index || 0),
      is_show: Boolean(form.isShow),
      pic_id: form.picId || null,
    };
  }, [form, quickTitle, isEdit, folderId, initialValue?.parentId]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');

    if (isCreate && !advancedOpen) {
      if (!quickTitle.trim()) {
        setError('Введите название.');
        return;
      }
      if (mode === 'create-tag' && !normalizeId(folderId)) {
        setError('Тег можно создать только внутри папки.');
        return;
      }

      const prefix = mode === 'create-folder' ? 'folder' : 'tag';
      const payload = {
        type: mode === 'create-folder' ? 'folder' : 'tag',
        parent_id: mode === 'create-tag' ? normalizeId(folderId) : null,
        name: makeUniqueName(quickTitle.trim(), prefix),
        title: { ru: quickTitle.trim() },
        description: {},
        index: 0,
        is_show: true,
      };

      setSubmitting(true);
      try {
        if (mode === 'create-folder') {
          await onCreateCityFilterFolder?.(payload);
        } else {
          await onCreateCityFilterTag?.(folderId, payload);
        }
        onCancel?.();
      } catch {
        /* toast в контроллере */
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const fType = form.filterType;
    const ruTitle = form.titleRu.trim() || quickTitle.trim();
    const enTitle = form.titleEn.trim();

    if (fType === 'folder' && !ruTitle && !enTitle) {
      setError('Для папки укажите название хотя бы на RU или EN.');
      return;
    }

    if (fType === 'tag' && !ruTitle && !enTitle) {
      setError('Укажите название хотя бы на RU или EN.');
      return;
    }

    if (mode === 'create-tag' && !normalizeId(folderId) && !normalizeId(form.parentId)) {
      setError('Тег можно создать только внутри папки.');
      return;
    }

    if (fType === 'tag' && isEdit) {
      const tagParent =
        normalizeId(form.parentId) || normalizeId(initialValue?.parentId);
      if (!tagParent) {
        setError('Выберите папку для тега');
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = buildFullPayload();
      if (mode === 'create-folder') {
        await onCreateCityFilterFolder?.(body);
      } else if (mode === 'create-tag') {
        await onCreateCityFilterTag?.(folderId, body);
      } else if (isEdit) {
        await onUpdateCityFilter?.(filterId, body);
      }
      onCancel?.();
    } catch {
      /* toast в контроллере */
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickKeyDown = (event) => {
    if (event.key === 'Enter' && isCreate && !advancedOpen) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUploadCityFilterImage) return;
    setUploading(true);
    try {
      const res = await onUploadCityFilterImage(file);
      if (res?.id) {
        setForm((prev) => ({
          ...prev,
          picId: res.id,
          imagePreview: res.url || prev.imagePreview,
        }));
      }
    } finally {
      setUploading(false);
    }
  };

  const previewSrc = form.imagePreview || '';

  const primaryLabel =
    mode === 'create-folder'
      ? 'Название папки'
      : mode === 'create-tag'
        ? 'Название тега'
        : 'Название';

  const submitLabel =
    submitting ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-h-[85vh] overflow-y-auto">
      <h3 className="text-base font-semibold text-gray-900">
        {mode === 'create-folder' && 'Новая папка'}
        {mode === 'create-tag' && 'Новый тег'}
        {mode === 'edit' && 'Редактирование'}
      </h3>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {isCreate && !advancedOpen ? (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {primaryLabel}
            </label>
            <input
              type="text"
              value={quickTitle}
              onChange={(ev) => setQuickTitle(ev.target.value)}
              onKeyDown={handleQuickKeyDown}
              autoFocus
              placeholder={
                mode === 'create-folder' ? 'Например: Атмосфера' : 'Например: Романтичный'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {mode === 'create-tag' && folderDisplayName ? (
            <p className="text-xs text-gray-500">
              Создаст тег внутри папки:{' '}
              <span className="font-medium text-gray-700">{folderDisplayName}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={openAdvanced}
              disabled={submitting}
              className="px-4 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              Дополнительно
            </button>
          </div>
        </>
      ) : null}

      {(isEdit || (isCreate && advancedOpen)) ? (
        <div className="space-y-3 pt-1 border-t border-gray-100">
          {isCreate && advancedOpen ? (
            <p className="text-xs font-medium text-gray-600">Дополнительные настройки</p>
          ) : null}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              Техническое имя (name)
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(ev) => setForm((p) => ({ ...p, name: ev.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Название RU (title.ru)
              </label>
              <input
                type="text"
                value={form.titleRu}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, titleRu: ev.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Название EN (title.en)
              </label>
              <input
                type="text"
                value={form.titleEn}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, titleEn: ev.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Описание RU
              </label>
              <textarea
                value={form.descriptionRu}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, descriptionRu: ev.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Описание EN
              </label>
              <textarea
                value={form.descriptionEn}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, descriptionEn: ev.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Индекс
              </label>
              <input
                type="number"
                value={form.index}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, index: ev.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isShow}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, isShow: ev.target.checked }))
                }
                className="rounded border-gray-300 text-blue-600"
              />
              Показывать (is_show)
            </label>
          </div>

          {form.filterType === 'tag' && isEdit ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Папка
              </label>
              <select
                value={form.parentId}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, parentId: ev.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Выберите папку</option>
                {folderOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label || opt.id}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <p className="text-xs font-medium text-gray-600">Изображение (pic_id)</p>
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                className="w-20 h-20 rounded-lg object-cover border border-gray-200"
              />
            ) : (
              <span className="text-xs text-gray-400">Нет изображения</span>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg cursor-pointer hover:bg-blue-200">
                {uploading ? 'Загрузка…' : '+ Загрузить изображение'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleFile}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, picId: null, imagePreview: '' }))
                }
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Убрать изображение
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            {isCreate ? (
              <button
                type="button"
                onClick={() => {
                  setQuickTitle(form.titleRu.trim() || quickTitle.trim());
                  setAdvancedOpen(false);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Простой ввод
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  );
}

function TagCheckboxRow({
  tag,
  parentFolder,
  selectedTagIds,
  onToggleCityTag,
  onEdit,
  onDelete,
}) {
  const id = normalizeId(tag.id ?? tag.uuid ?? tag.pk);
  const title = getMultilangDisplay(tag.title ?? tag.name);
  const description = tag.description
    ? getMultilangDisplay(tag.description)
    : '';
  const imageUrl = tag.image_url || tag.imageUrl || '';

  if (!id) return null;

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50">
      <label className="flex flex-1 min-w-0 items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
          checked={selectedTagIds.has(id)}
          onChange={() => onToggleCityTag?.(id)}
        />

        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-10 h-10 rounded object-cover shrink-0 border border-gray-200"
          />
        ) : (
          <span className="w-10 h-10 rounded bg-gray-100 shrink-0 border border-gray-200" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900">
            {title || '—'}
          </span>
          {description ? (
            <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
          ) : null}
        </span>
      </label>

      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit?.(tag, parentFolder)}
          className="text-xs text-blue-600 hover:underline px-1"
        >
          Редактировать
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(tag)}
          className="text-xs text-red-600 hover:underline px-1"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

function FolderSection({
  folder,
  depth = 0,
  selectedTagIds,
  searchActive,
  collapsedFolderIds,
  onToggleFolderCollapse,
  onToggleCityTag,
  onEditFilter,
  onDeleteFilter,
  onAddTagInFolder,
}) {
  const folderIdNorm = normalizeId(folder.id);
  const children = getTreeChildNodes(folder);
  const fType = getFilterType(folder);
  const title = getMultilangDisplay(folder.title ?? folder.name);
  const description = folder.description
    ? getMultilangDisplay(folder.description)
    : '';
  const imageUrl = folder.image_url || folder.imageUrl || '';
  const hasChildren = children.length > 0;

  const selectedInSubtree = countSelectedTagsInNode(folder, selectedTagIds);
  const isCollapsed =
    !searchActive && folderIdNorm && collapsedFolderIds.has(folderIdNorm);

  if (fType === 'tag' && !hasChildren) {
    return (
      <TagCheckboxRow
        tag={folder}
        parentFolder={null}
        selectedTagIds={selectedTagIds}
        onToggleCityTag={onToggleCityTag}
        onEdit={onEditFilter}
        onDelete={onDeleteFilter}
      />
    );
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden ${depth > 0 ? 'ml-3 mt-3' : ''}`}
    >
      <div className="p-3 border-b border-gray-200 bg-white/80 flex gap-2 justify-between items-start">
        <div className="flex gap-2 min-w-0 flex-1 items-start">
          <button
            type="button"
            onClick={() => onToggleFolderCollapse?.(folderIdNorm)}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200"
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Развернуть' : 'Свернуть'}
          >
            <span className="text-sm leading-none">{isCollapsed ? '▸' : '▾'}</span>
          </button>

          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-200"
            />
          ) : null}

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 flex flex-wrap items-baseline gap-x-1 gap-y-0">
              <span>{title || '—'}</span>
              {selectedInSubtree > 0 ? (
                <span className="text-xs font-normal text-gray-500 tabular-nums">
                  · выбрано {selectedInSubtree}
                </span>
              ) : null}
            </h3>
            {description ? (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0 items-end">
          <button
            type="button"
            onClick={() => onEditFilter?.(folder)}
            className="text-xs text-blue-600 hover:underline"
          >
            Редактировать
          </button>
          <button
            type="button"
            disabled={hasChildren}
            title={
              hasChildren
                ? 'Сначала удалите теги внутри папки.'
                : 'Удалить папку'
            }
            onClick={() => {
              if (hasChildren) return;
              onDeleteFilter?.(folder);
            }}
            className={`text-xs px-1 ${
              hasChildren
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:underline'
            }`}
          >
            Удалить
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <div className="p-3 space-y-2">
          {children.map((child, index) => {
            const childChildren = getTreeChildNodes(child);
            const key = normalizeId(child.id) || index;
            const childType = getFilterType(child);

            if (childChildren.length > 0 || childType === 'folder') {
              return (
                <FolderSection
                  key={key}
                  folder={child}
                  depth={depth + 1}
                  selectedTagIds={selectedTagIds}
                  searchActive={searchActive}
                  collapsedFolderIds={collapsedFolderIds}
                  onToggleFolderCollapse={onToggleFolderCollapse}
                  onToggleCityTag={onToggleCityTag}
                  onEditFilter={onEditFilter}
                  onDeleteFilter={onDeleteFilter}
                  onAddTagInFolder={onAddTagInFolder}
                />
              );
            }

            return (
              <TagCheckboxRow
                key={key}
                tag={child}
                parentFolder={folder}
                selectedTagIds={selectedTagIds}
                onToggleCityTag={onToggleCityTag}
                onEdit={onEditFilter}
                onDelete={onDeleteFilter}
              />
            );
          })}

          <button
            type="button"
            onClick={() => onAddTagInFolder?.(folder)}
            className="w-full py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-dashed border-blue-200 rounded-lg hover:bg-blue-100"
          >
            + Тег
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SessionWizardTagsStep({
  embedded = false,

  cityTags = [],

  cityFilterTree = [],
  cityFilterTreeLoading = false,
  cityFilterTreeError = '',

  saving = false,

  onToggleCityTag,
  onReloadCityFilters,
  onCreateCityFilterFolder,
  onCreateCityFilterTag,
  onUpdateCityFilter,
  onDeleteCityFilter,
  onUploadCityFilterImage,
  onGoToStep,
} = {}) {
  const selectedTagIds = new Set(
    cityTags.map((t) => normalizeId(t)).filter(Boolean)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolderIds, setCollapsedFolderIds] = useState(() => new Set());

  const [modal, setModal] = useState(null);

  const filteredTree = useMemo(
    () => filterTreeBySearch(cityFilterTree, searchQuery),
    [cityFilterTree, searchQuery]
  );

  const searchActive = Boolean(String(searchQuery || '').trim());

  const folderOptionsBase = useMemo(
    () =>
      collectFolders(cityFilterTree)
        .map((f) => ({
          id: normalizeId(f.id),
          label: getMultilangDisplay(f.title ?? f.name) || normalizeId(f.id),
        }))
        .filter((o) => o.id),
    [cityFilterTree]
  );

  const folderOptionsForForm = useMemo(() => {
    if (modal?.mode !== 'edit' || modal?.initial?.type !== 'tag') {
      return folderOptionsBase;
    }
    const pid = normalizeId(modal.initial.parentId);
    if (!pid || folderOptionsBase.some((o) => o.id === pid)) {
      return folderOptionsBase;
    }
    return [
      ...folderOptionsBase,
      { id: pid, label: `Папка (${pid.slice(0, 8)}…)` },
    ];
  }, [modal, folderOptionsBase]);

  const toggleFolderCollapsed = useCallback((folderId) => {
    const id = normalizeId(folderId);
    if (!id) return;

    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openCreateFolder = () =>
    setModal({
      mode: 'create-folder',
      folderId: '',
      filterId: '',
      folderDisplayName: '',
      initial: null,
    });

  const openCreateTag = (folder) =>
    setModal({
      mode: 'create-tag',
      folderId: normalizeId(folder?.id),
      folderDisplayName: getMultilangDisplay(folder?.title ?? folder?.name),
      filterId: '',
      initial: null,
    });

  const openEdit = (node, containingFolder = null) => {
    const nodeType = getFilterType(node);
    const initial =
      nodeType === 'tag'
        ? nodeToFormInitial(node, containingFolder)
        : nodeToFormInitial(node, null);

    setModal({
      mode: 'edit',
      folderId:
        nodeType === 'tag'
          ? normalizeId(containingFolder?.id) || initial.parentId || ''
          : '',
      filterId: normalizeId(node.id),
      initial,
    });
  };

  const closeModal = () => setModal(null);

  const handleDelete = (node) => {
    const id = normalizeId(node.id);
    const label = getMultilangDisplay(node.title ?? node.name) || id;
    const t = getFilterType(node);
    if (t === 'folder' && getTreeChildNodes(node).length > 0) {
      return;
    }
    onDeleteCityFilter?.(id, {
      message:
        t === 'tag'
          ? `Удалить тег «${label}»?`
          : `Удалить папку «${label}»?`,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Теги</h2>

        <p className="text-sm text-gray-500">
          Выберите теги города из справочника. Папки и теги можно создавать и
          редактировать здесь.
        </p>
      </div>

      <button
        type="button"
        onClick={openCreateFolder}
        disabled={cityFilterTreeLoading}
        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        + Новая папка
      </button>

      <p className="text-sm text-gray-700">
        Выбрано тегов:{' '}
        <span className="font-semibold tabular-nums">{selectedTagIds.size}</span>
      </p>

      {!cityFilterTreeLoading && !cityFilterTreeError && cityFilterTree.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Поиск тегов…
          </label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Название, описание, имя…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {cityFilterTreeLoading && (
        <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl">
          Загрузка справочника тегов…
        </div>
      )}

      {!cityFilterTreeLoading && cityFilterTreeError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800 space-y-3">
          <p>{cityFilterTreeError}</p>

          <button
            type="button"
            onClick={() => onReloadCityFilters?.()}
            className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 rounded-lg hover:bg-red-100"
          >
            Повторить
          </button>
        </div>
      )}

      {!cityFilterTreeLoading && !cityFilterTreeError && cityFilterTree.length === 0 && (
        <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
          В справочнике пока нет папок. Создайте папку кнопкой выше.
        </div>
      )}

      {!cityFilterTreeLoading &&
        !cityFilterTreeError &&
        cityFilterTree.length > 0 &&
        filteredTree.length === 0 &&
        searchActive && (
          <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
            Ничего не найдено. Очистите поиск или измените запрос.
          </div>
        )}

      {!cityFilterTreeLoading && !cityFilterTreeError && cityFilterTree.length > 0 && filteredTree.length > 0 && (
        <div className="space-y-3">
          {filteredTree.map((folder, index) => (
            <FolderSection
              key={normalizeId(folder.id) || index}
              folder={folder}
              selectedTagIds={selectedTagIds}
              searchActive={searchActive}
              collapsedFolderIds={collapsedFolderIds}
              onToggleFolderCollapse={toggleFolderCollapsed}
              onToggleCityTag={onToggleCityTag}
              onEditFilter={openEdit}
              onDeleteFilter={handleDelete}
              onAddTagInFolder={openCreateTag}
            />
          ))}
        </div>
      )}

      {!embedded && (
        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={() => onGoToStep?.(1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Назад
          </button>

          <button
            type="button"
            onClick={() => onGoToStep?.(2)}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Далее: Достопримечательности →'}
          </button>
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть"
            onClick={closeModal}
          />

          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg p-5 max-h-[90vh] overflow-hidden">
            <CityFilterForm
              key={`${modal.mode}-${modal.filterId}-${modal.initial?.parentId ?? ''}`}
              mode={modal.mode}
              folderId={modal.folderId}
              filterId={modal.filterId}
              folderDisplayName={modal.folderDisplayName || ''}
              initialValue={modal.initial}
              folderOptions={folderOptionsForForm}
              onCreateCityFilterFolder={onCreateCityFilterFolder}
              onCreateCityFilterTag={onCreateCityFilterTag}
              onUpdateCityFilter={onUpdateCityFilter}
              onCancel={closeModal}
              onUploadCityFilterImage={onUploadCityFilterImage}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
