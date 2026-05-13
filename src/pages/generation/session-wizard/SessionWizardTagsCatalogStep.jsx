import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

function getFilterType(node) {
  const t = (node.type || node.filter_type || '').toLowerCase();
  if (t === 'tag') return 'tag';
  if (t === 'folder') return 'folder';
  return getTreeChildNodes(node).length > 0 ? 'folder' : 'tag';
}

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
  flatCatalog = false,
  onCreateCityFilterFolder,
  onCreateCityFilterTag,
  onCreateCityTag,
  onUpdateCityFilter,
  onCancel,
  onUploadCityFilterImage,
  onCreateFilterFolder,
  onCreateFilterTagInFolder,
  onCreateFlatFilterTag,
  onUpdateFilter,
  onUploadFilterImage,
}) {
  const isCreate = mode === 'create-folder' || mode === 'create-tag';
  const isEdit = mode === 'edit';

  const doCreateFolder = onCreateFilterFolder ?? onCreateCityFilterFolder;
  const doCreateTagInFolder = onCreateFilterTagInFolder ?? onCreateCityFilterTag;
  const doCreateFlatTag = onCreateFlatFilterTag ?? onCreateCityTag;
  const doUpdateFilter = onUpdateFilter ?? onUpdateCityFilter;
  const doUploadImage = onUploadFilterImage ?? onUploadCityFilterImage;

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
      flatCatalog && fType === 'tag'
        ? null
        : fType === 'tag'
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
  }, [form, quickTitle, isEdit, folderId, initialValue?.parentId, flatCatalog]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');

    if (isCreate && !advancedOpen) {
      if (!quickTitle.trim()) {
        setError('Введите название.');
        return;
      }
      if (mode === 'create-tag' && !flatCatalog && !normalizeId(folderId)) {
        setError('Тег можно создать только внутри папки.');
        return;
      }

      const prefix = mode === 'create-folder' ? 'folder' : 'tag';
      const payload = {
        type: mode === 'create-folder' ? 'folder' : 'tag',
        parent_id:
          mode === 'create-tag'
            ? flatCatalog
              ? null
              : normalizeId(folderId)
            : null,
        name: makeUniqueName(quickTitle.trim(), flatCatalog && mode === 'create-tag' ? 'city-tag' : prefix),
        title: { ru: quickTitle.trim() },
        description: {},
        index: 0,
        is_show: true,
      };

      setSubmitting(true);
      try {
        if (mode === 'create-folder') {
          await doCreateFolder?.(payload);
        } else if (flatCatalog) {
          await doCreateFlatTag?.(payload);
        } else {
          await doCreateTagInFolder?.(folderId, payload);
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

    if (mode === 'create-tag' && !flatCatalog && !normalizeId(folderId) && !normalizeId(form.parentId)) {
      setError('Тег можно создать только внутри папки.');
      return;
    }

    if (fType === 'tag' && isEdit && !flatCatalog) {
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
        await doCreateFolder?.(body);
      } else if (mode === 'create-tag') {
        if (flatCatalog) {
          await doCreateFlatTag?.(body);
        } else {
          await doCreateTagInFolder?.(folderId, body);
        }
      } else if (isEdit) {
        await doUpdateFilter?.(filterId, body);
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
    if (!file || !doUploadImage) return;
    setUploading(true);
    try {
      const res = await doUploadImage(file);
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
        {mode === 'create-tag' && (flatCatalog ? 'Новый тег города' : 'Новый тег')}
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

          {mode === 'create-tag' && folderDisplayName && !flatCatalog ? (
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

          {form.filterType === 'tag' && isEdit && !flatCatalog ? (
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

export default function SessionWizardTagsCatalogStep({
  cityTagCatalog = [],
  cityTagCatalogLoading = false,
  cityTagCatalogError = '',
  onReloadCityTagCatalog,
  saving = false,
  onCreateCityTag,
  onUpdateCityFilter,
  onDeleteCityFilter,
  onUploadCityFilterImage,
  deletingCityFilterIds = new Set(),
  eventFilterTree = [],
  eventFilterTreeLoading = false,
  eventFilterTreeError = '',
  onReloadEventFilters,
  onCreateEventFilterFolder,
  onCreateEventFilterTag,
  onUpdateEventFilter,
  onDeleteEventFilter,
  onUploadEventFilterImage,
  deletingEventFilterIds = new Set(),
  onGoToStep,
} = {}) {
  const [catalogTab, setCatalogTab] = useState('city');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickName, setQuickName] = useState('');
  const [modal, setModal] = useState(null);

  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventQuickFolder, setEventQuickFolder] = useState('');
  const [eventQuickTagByFolder, setEventQuickTagByFolder] = useState({});
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [eventModal, setEventModal] = useState(null);

  useEffect(() => {
    if (catalogTab !== 'attraction') return;
    setCollapsedFolders({});
  }, [catalogTab, eventFilterTree]);

  const filteredCityTags = useMemo(() => {
    const list = Array.isArray(cityTagCatalog)
      ? cityTagCatalog.filter(
        (t) => String(t.type || '').toLowerCase() !== 'folder',
      )
      : [];
    const q = String(searchQuery || '').trim().toLowerCase();
    const sorted = [...list].sort((a, b) => {
      const ia = Number(a.index ?? 0);
      const ib = Number(b.index ?? 0);
      if (ia !== ib) return ia - ib;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    if (!q) return sorted;
    return sorted.filter((t) => getSearchText(t).includes(q));
  }, [cityTagCatalog, searchQuery]);

  const eventFolderOptions = useMemo(
    () =>
      (Array.isArray(eventFilterTree) ? eventFilterTree : [])
        .filter(
          (f) =>
            getFilterType(f) === 'folder' ||
            String(f.type || '').toLowerCase() === 'folder',
        )
        .map((f) => ({
          id: normalizeId(f.id),
          label: getMultilangDisplay(f.title ?? f.name) || normalizeId(f.id),
        }))
        .filter((o) => o.id),
    [eventFilterTree],
  );

  const filteredEventFolders = useMemo(() => {
    const tree = Array.isArray(eventFilterTree) ? eventFilterTree : [];
    const q = String(eventSearchQuery || '').trim().toLowerCase();
    if (!q) return tree;
    return tree.filter((folder) => {
      if (getSearchText(folder).includes(q)) return true;
      const kids = getTreeChildNodes(folder);
      return kids.some((ch) => getSearchText(ch).includes(q));
    });
  }, [eventFilterTree, eventSearchQuery]);

  const toggleFolderCollapsed = (folderId) => {
    const id = normalizeId(folderId);
    setCollapsedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEventQuickFolderSubmit = async (e) => {
    e?.preventDefault?.();
    const title = eventQuickFolder.trim();
    if (!title) return;
    try {
      await onCreateEventFilterFolder?.({
        type: 'folder',
        parent_id: null,
        name: makeUniqueName(title, 'event-folder'),
        title: { ru: title },
        description: {},
        index: 0,
        is_show: true,
      });
      setEventQuickFolder('');
    } catch {
      /* уведомление в контроллере */
    }
  };

  const handleEventQuickTagSubmit = async (folderId) => {
    const fid = normalizeId(folderId);
    const title = (eventQuickTagByFolder[fid] || '').trim();
    if (!fid || !title) return;
    try {
      await onCreateEventFilterTag?.(fid, {
        type: 'tag',
        name: makeUniqueName(title, 'event-tag'),
        title: { ru: title },
        description: {},
        index: 0,
        is_show: true,
      });
      setEventQuickTagByFolder((p) => ({ ...p, [fid]: '' }));
    } catch {
      /* уведомление в контроллере */
    }
  };

  const openCreateEventFolderModal = () =>
    setEventModal({
      mode: 'create-folder',
      folderId: '',
      filterId: '',
      folderDisplayName: '',
      initial: null,
    });

  const openCreateEventTagModal = (folder) => {
    const fid = normalizeId(folder.id);
    setEventModal({
      mode: 'create-tag',
      folderId: fid,
      filterId: '',
      folderDisplayName:
        getMultilangDisplay(folder.title ?? folder.name) || fid,
      initial: null,
    });
  };

  const openEditEventFilter = (node, containingFolder = null) => {
    setEventModal({
      mode: 'edit',
      folderId: containingFolder ? normalizeId(containingFolder.id) : '',
      filterId: normalizeId(node.id),
      folderDisplayName: containingFolder
        ? getMultilangDisplay(containingFolder.title ?? containingFolder.name)
        : '',
      initial: nodeToFormInitial(node, containingFolder),
    });
  };

  const closeEventModal = () => setEventModal(null);

  const handleDeleteEventTag = (tag) => {
    const id = normalizeId(tag.id);
    const label = getMultilangDisplay(tag.title ?? tag.name) || id;
    onDeleteEventFilter?.(id, {
      message: `Удалить тег «${label}»?`,
    });
  };

  const handleDeleteEventFolder = (folder) => {
    const id = normalizeId(folder.id);
    const label = getMultilangDisplay(folder.title ?? folder.name) || id;
    onDeleteEventFilter?.(id, {
      message: `Удалить папку «${label}»? (Только если в ней нет тегов.)`,
    });
  };

  const openCreateFlat = () =>
    setModal({
      mode: 'create-tag',
      folderId: '',
      filterId: '',
      folderDisplayName: '',
      initial: null,
      flatCatalog: true,
    });

  const openEditFlat = (node) => {
    setModal({
      mode: 'edit',
      folderId: '',
      filterId: normalizeId(node.id),
      folderDisplayName: '',
      initial: nodeToFormInitial(node, null),
      flatCatalog: true,
    });
  };

  const closeModal = () => setModal(null);

  const handleDeleteTag = (tag) => {
    const id = normalizeId(tag.id);
    const label = getMultilangDisplay(tag.title ?? tag.name) || id;
    onDeleteCityFilter?.(id, {
      message: `Удалить тег «${label}»?`,
    });
  };

  const handleQuickSubmit = async (e) => {
    e?.preventDefault?.();
    const title = quickName.trim();
    if (!title) return;
    try {
      await onCreateCityTag?.({
        type: 'tag',
        parent_id: null,
        name: makeUniqueName(title, 'city-tag'),
        title: { ru: title },
        description: {},
        index: 0,
        is_show: true,
      });
      setQuickName('');
    } catch {
      /* уведомление в контроллере */
    }
  };

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setCatalogTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
        catalogTab === id
          ? 'border-blue-600 text-blue-700 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Справочник тегов</h2>
        <p className="text-sm text-gray-500">
          Создавайте и редактируйте теги. На странице города теги только выбираются.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabBtn('city', 'Теги городов')}
        {tabBtn('attraction', 'Теги достопримечательностей')}
      </div>

      {catalogTab === 'city' ? (
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-1">Теги городов</h3>
            <p className="text-xs text-gray-500 mb-3">
              Плоский список без папок. Быстрое создание по названию.
            </p>

            <form onSubmit={handleQuickSubmit} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-0.5">
                  Название тега
                </label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(ev) => setQuickName(ev.target.value)}
                  placeholder="Введите название тега…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={cityTagCatalogLoading || !quickName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Добавить
              </button>
              <button
                type="button"
                onClick={openCreateFlat}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                Форма…
              </button>
            </form>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Поиск</label>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Название, описание…"
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {cityTagCatalogLoading && (
            <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl">
              Загрузка тегов…
            </div>
          )}

          {!cityTagCatalogLoading && cityTagCatalogError && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800 space-y-2">
              <p>{cityTagCatalogError}</p>
              <button
                type="button"
                onClick={() => onReloadCityTagCatalog?.()}
                className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 rounded-lg hover:bg-red-100"
              >
                Повторить
              </button>
            </div>
          )}

          {!cityTagCatalogLoading && !cityTagCatalogError && filteredCityTags.length === 0 && (
            <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
              Пока нет тегов. Добавьте первый выше.
            </div>
          )}

          {!cityTagCatalogLoading && !cityTagCatalogError && filteredCityTags.length > 0 && (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
              {filteredCityTags.map((tag) => {
                const id = normalizeId(tag.id);
                const title = getMultilangDisplay(tag.title ?? tag.name) || id;
                const imageUrl = tag.image_url || tag.imageUrl || '';
                return (
                  <li
                    key={id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-9 h-9 rounded object-cover border border-gray-200 shrink-0"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded bg-gray-100 border border-gray-200 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                      {title}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditFlat(tag)}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Ред.
                    </button>
                    <button
                      type="button"
                      disabled={deletingCityFilterIds.has(id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteTag(tag);
                      }}
                      className="text-xs text-red-600 hover:underline shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Удалить
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-1">
              Теги достопримечательностей
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Папки и теги для событий. На странице достопримечательности — только выбор.
            </p>

            <form
              onSubmit={handleEventQuickFolderSubmit}
              className="flex flex-wrap gap-2 items-end mb-3"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-0.5">
                  + Новая папка
                </label>
                <input
                  type="text"
                  value={eventQuickFolder}
                  onChange={(ev) => setEventQuickFolder(ev.target.value)}
                  placeholder="Название папки…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={eventFilterTreeLoading || !eventQuickFolder.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={openCreateEventFolderModal}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                Форма…
              </button>
            </form>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Поиск</label>
            <input
              type="search"
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              placeholder="Папка или тег…"
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {eventFilterTreeLoading && (
            <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl">
              Загрузка…
            </div>
          )}

          {!eventFilterTreeLoading && eventFilterTreeError && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800 space-y-2">
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

          {!eventFilterTreeLoading &&
            !eventFilterTreeError &&
            filteredEventFolders.length === 0 && (
              <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
                Пока нет папок. Создайте первую выше.
              </div>
            )}

          {!eventFilterTreeLoading &&
            !eventFilterTreeError &&
            filteredEventFolders.length > 0 && (
              <ul className="space-y-3">
                {filteredEventFolders.map((folder) => {
                  const fid = normalizeId(folder.id);
                  const folded = Boolean(collapsedFolders[fid]);
                  const children = getTreeChildNodes(folder).filter(
                    (ch) => String(ch.type || '').toLowerCase() === 'tag',
                  );
                  const q = String(eventSearchQuery || '').trim().toLowerCase();
                  const visibleTags = !q
                    ? children
                    : children.filter((ch) => getSearchText(ch).includes(q));
                  const folderTitle =
                    getMultilangDisplay(folder.title ?? folder.name) || fid;

                  return (
                    <li
                      key={fid}
                      className="border border-gray-200 rounded-xl bg-white overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <button
                          type="button"
                          onClick={() => toggleFolderCollapsed(fid)}
                          className="text-gray-500 hover:text-gray-800 w-6"
                          aria-label={folded ? 'Развернуть' : 'Свернуть'}
                        >
                          {folded ? '▸' : '▾'}
                        </button>
                        <span className="flex-1 font-medium text-sm text-gray-900">
                          {folderTitle}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditEventFilter(folder, null)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ред.
                        </button>
                        <button
                          type="button"
                          disabled={deletingEventFilterIds.has(fid)}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteEventFolder(folder);
                          }}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Удалить
                        </button>
                      </div>

                      {!folded && (
                        <div className="p-3 space-y-2">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-xs text-gray-500 mb-0.5">
                                + Тег
                              </label>
                              <input
                                type="text"
                                value={eventQuickTagByFolder[fid] || ''}
                                onChange={(ev) =>
                                  setEventQuickTagByFolder((p) => ({
                                    ...p,
                                    [fid]: ev.target.value,
                                  }))
                                }
                                onKeyDown={(ev) => {
                                  if (ev.key === 'Enter') {
                                    ev.preventDefault();
                                    handleEventQuickTagSubmit(fid);
                                  }
                                }}
                                placeholder="Название тега…"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEventQuickTagSubmit(fid)}
                              disabled={!((eventQuickTagByFolder[fid] || '').trim())}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              Добавить
                            </button>
                            <button
                              type="button"
                              onClick={() => openCreateEventTagModal(folder)}
                              className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              Форма…
                            </button>
                          </div>

                          {visibleTags.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">
                              В этой папке пока нет тегов.
                            </p>
                          ) : (
                            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                              {visibleTags.map((tag) => {
                                const tid = normalizeId(tag.id);
                                const ttitle =
                                  getMultilangDisplay(tag.title ?? tag.name) || tid;
                                const imageUrl = tag.image_url || tag.imageUrl || '';
                                return (
                                  <li
                                    key={tid}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
                                  >
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt=""
                                        className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0"
                                      />
                                    ) : (
                                      <span className="w-8 h-8 rounded bg-gray-100 border border-gray-200 shrink-0" />
                                    )}
                                    <span className="flex-1 min-w-0 text-sm truncate">
                                      {ttitle}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openEditEventFilter(tag, folder)}
                                      className="text-xs text-blue-600 hover:underline shrink-0"
                                    >
                                      Ред.
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingEventFilterIds.has(tid)}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteEventTag(tag);
                                      }}
                                      className="text-xs text-red-600 hover:underline shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      Удалить
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => onGoToStep?.(1)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Назад: Город
        </button>

        <button
          type="button"
          onClick={() => onGoToStep?.(3)}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Сохранение...' : 'Далее: Достопримечательности →'}
        </button>
      </div>

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
              key={`${modal.mode}-${modal.filterId}-${modal.flatCatalog ? 'flat' : 'tree'}-${modal.initial?.parentId ?? ''}`}
              mode={modal.mode}
              folderId={modal.folderId}
              filterId={modal.filterId}
              folderDisplayName={modal.folderDisplayName || ''}
              initialValue={modal.initial}
              folderOptions={[]}
              flatCatalog={Boolean(modal.flatCatalog)}
              onCreateCityTag={onCreateCityTag}
              onUpdateCityFilter={onUpdateCityFilter}
              onCancel={closeModal}
              onUploadCityFilterImage={onUploadCityFilterImage}
            />
          </div>
        </div>
      ) : null}

      {eventModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть"
            onClick={closeEventModal}
          />

          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg p-5 max-h-[90vh] overflow-hidden">
            <CityFilterForm
              key={`event-${eventModal.mode}-${eventModal.filterId}-${eventModal.initial?.parentId ?? ''}`}
              mode={eventModal.mode}
              folderId={eventModal.folderId}
              filterId={eventModal.filterId}
              folderDisplayName={eventModal.folderDisplayName || ''}
              initialValue={eventModal.initial}
              folderOptions={eventFolderOptions}
              flatCatalog={false}
              onCancel={closeEventModal}
              onCreateFilterFolder={onCreateEventFilterFolder}
              onCreateFilterTagInFolder={onCreateEventFilterTag}
              onUpdateFilter={onUpdateEventFilter}
              onUploadFilterImage={onUploadEventFilterImage}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
