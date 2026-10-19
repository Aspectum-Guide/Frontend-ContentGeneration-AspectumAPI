import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormLabel, Alert, Button, Checkbox, ConfirmModal as DefaultConfirmModal, EmptyState, Field, FileButton, Heading, InlineState, Modal, MultiField, Panel, SectionHeader, Select, Tabs, TextInput, useConfirmModal } from '@aspectum/ui';
import {
  DEFAULT_APP_LANGUAGES,
  ensureAppLanguages,
  mapAppLanguagesForFields,
} from '../../../features/catalog/shared/normalize';
import { getMultiLangValue } from '../../../features/catalog/shared/i18n';
import { normalizeId } from './sessionWizardShared.jsx';
import { useAppLanguages } from '../../../hooks/useAppLanguages';

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
  const title =
    node.title && typeof node.title === 'object' && !Array.isArray(node.title)
      ? { ...node.title }
      : typeof node.title === 'string'
        ? { ru: node.title }
        : {};
  const desc =
    node.description && typeof node.description === 'object' && !Array.isArray(node.description)
      ? { ...node.description }
      : {};
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
    title,
    description: desc,
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
  pendingScope = 'filter-form',
  appLanguages = DEFAULT_APP_LANGUAGES,
  multiLangLanguages = [],
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
    title: {},
    description: {},
    index: 0,
    isShow: true,
    picId: null,
    imagePreview: '',
    parentId: '',
    filterType: 'folder',
  };

  const [quickTitle, setQuickTitle] = useState(() => {
    if (initialValue) {
      return getMultiLangValue(initialValue.title) || '';
    }
    return '';
  });

  const [advancedOpen, setAdvancedOpen] = useState(isEdit);

  const [form, setForm] = useState(() => {
    if (initialValue) {
      const i = initialValue;
      return {
        name: i.name ?? '',
        title: i.title && typeof i.title === 'object' ? { ...i.title } : {},
        description:
          i.description && typeof i.description === 'object' ? { ...i.description } : {},
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
  const submittingRef = useRef(false);
  const quickCreatePendingRef = useRef(new Set());

  const openAdvanced = () => {
    const prefix = mode === 'create-folder' ? 'folder' : 'tag';
    setAdvancedOpen(true);
    setForm((prev) => ({
      ...prev,
      title: {
        ...(prev.title || {}),
        ru: getMultiLangValue(prev.title) || quickTitle.trim(),
      },
      name:
        prev.name.trim() ||
        makeUniqueName(quickTitle.trim(), prefix),
    }));
  };

  const buildDescriptionPayload = useCallback((descriptionValue) => {
    const raw = descriptionValue && typeof descriptionValue === 'object' ? { ...descriptionValue } : {};
    const emoji = raw.emoji;
    delete raw.emoji;
    const text = appLanguages?.length
      ? ensureAppLanguages(raw, appLanguages)
      : raw;
    if (emoji) {
      text.emoji = emoji;
    }
    return text;
  }, [appLanguages]);

  const buildFullPayload = useCallback(() => {
    const fType = form.filterType;
    const prefix = fType === 'folder' ? 'folder' : 'tag';
    const titleSource = {
      ...(form.title || {}),
    };
    if (quickTitle.trim() && !getMultiLangValue(titleSource)) {
      titleSource.ru = quickTitle.trim();
    }
    const title = appLanguages?.length
      ? ensureAppLanguages(titleSource, appLanguages)
      : titleSource;
    const description = buildDescriptionPayload(form.description);
    const ruTitle = getMultiLangValue(title) || quickTitle.trim();

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
  }, [
    form,
    quickTitle,
    isEdit,
    folderId,
    initialValue?.parentId,
    flatCatalog,
    appLanguages,
    buildDescriptionPayload,
  ]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (submittingRef.current || submitting) {
      return;
    }
    setError('');

    if (isCreate && !advancedOpen) {
      const title = quickTitle.trim();
      if (!title) {
        setError('Введите название.');
        return;
      }
      if (mode === 'create-tag' && !flatCatalog && !normalizeId(folderId)) {
        setError('Тег можно создать только внутри папки.');
        return;
      }

      const scopeKey = pendingScope;
      if (quickCreatePendingRef.current.has(scopeKey)) {
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
        name: makeUniqueName(title, flatCatalog && mode === 'create-tag' ? 'city-tag' : prefix),
        title: { ru: title },
        description: {},
        index: 0,
        is_show: true,
      };

      quickCreatePendingRef.current.add(scopeKey);
      submittingRef.current = true;
      setSubmitting(true);
      try {
        if (mode === 'create-folder') {
          await doCreateFolder?.(payload);
        } else if (flatCatalog) {
          await doCreateFlatTag?.(payload);
        } else {
          await doCreateTagInFolder?.(folderId, payload);
        }
        setQuickTitle('');
        onCancel?.();
      } catch {
        /* toast в контроллере */
      } finally {
        quickCreatePendingRef.current.delete(scopeKey);
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    const fType = form.filterType;
    const titleText = getMultiLangValue(form.title) || quickTitle.trim();

    if (fType === 'folder' && !titleText) {
      setError('Для папки укажите название хотя бы на одном языке.');
      return;
    }

    if (fType === 'tag' && !titleText) {
      setError('Укажите название хотя бы на одном языке.');
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

    const scopeKey = `${pendingScope}:advanced`;
    if (quickCreatePendingRef.current.has(scopeKey)) {
      return;
    }

    quickCreatePendingRef.current.add(scopeKey);
    submittingRef.current = true;
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
      quickCreatePendingRef.current.delete(scopeKey);
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleQuickKeyDown = (event) => {
    if (event.key !== 'Enter' || !isCreate || advancedOpen) {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    handleSubmit(event);
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
    <form onSubmit={handleSubmit} className="space-y-3 max-h-[85vh] overflow-y-auto overflow-x-hidden min-w-0">
      <Heading level={3} size="sm">
        {mode === 'create-folder' && 'Новая папка'}
        {mode === 'create-tag' && (flatCatalog ? 'Новый тег города' : 'Новый тег')}
        {mode === 'edit' && 'Редактирование'}
      </Heading>

      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : null}

      {isCreate && !advancedOpen ? (
        <>
          <div>
            <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xxs">
              {primaryLabel}
            </FormLabel>
            <TextInput className="disabled:opacity-50" type="text" value={quickTitle} onChange={(ev) => setQuickTitle(ev.target.value)} onKeyDown={handleQuickKeyDown} disabled={submitting} autoFocus placeholder={ mode === 'create-folder' ? 'Например: Атмосфера' : 'Например: Романтичный' } />
          </div>

          {mode === 'create-tag' && folderDisplayName && !flatCatalog ? (
            <p className="text-xs text-aspectum-text-muted">
              Создаст тег внутри папки:{' '}
              <span className="font-medium text-aspectum-text-strong">{folderDisplayName}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || !quickTitle.trim()}
            >
              {submitting ? 'Добавление...' : submitLabel}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              variant="outline"
              size="md"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={openAdvanced}
              disabled={submitting}
              variant="soft"
              size="md"
            >
              Дополнительно
            </Button>
          </div>
        </>
      ) : null}

      {(isEdit || (isCreate && advancedOpen)) ? (
        <div className="space-y-3 pt-1 border-t border-aspectum-border-subtle">
          {isCreate && advancedOpen ? (
            <p className="text-xs font-medium text-aspectum-text-subtle">Дополнительные настройки</p>
          ) : null}

          <div>
            <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xxs">
              Техническое имя (name)
            </FormLabel>
            <TextInput type="text" value={form.name} onChange={(ev) => setForm((p) => ({ ...p, name: ev.target.value }))} />
          </div>

          <Field label="Название" required>
            <MultiField
              items={multiLangLanguages.map((lang) => ({ id: lang.code, label: lang.name }))}
              value={form.title || {}}
              onChange={(title) => setForm((prev) => ({ ...prev, title }))}
              placeholder="Введите название"
            />
          </Field>

          <Field label="Описание">
            <MultiField
              items={multiLangLanguages.map((lang) => ({ id: lang.code, label: lang.name }))}
              value={Object.fromEntries(
                Object.entries(form.description || {}).filter(([key]) => key !== 'emoji'),
              )}
              onChange={(description) =>
                setForm((prev) => ({
                  ...prev,
                  description: {
                    ...description,
                    ...(prev.description?.emoji ? { emoji: prev.description.emoji } : {}),
                  },
                }))
              }
              placeholder="Введите описание"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xxs">
                Индекс
              </FormLabel>
              <TextInput type="number" value={form.index} onChange={(ev) => setForm((p) => ({ ...p, index: ev.target.value })) } />
            </div>
            <FormLabel  layout="row" size="sm" tone="strong" interactive>
              <Checkbox
                checked={form.isShow}
                onChange={(ev) =>
                  setForm((p) => ({ ...p, isShow: ev.target.checked }))
                }
                className="rounded border-aspectum-border-strong text-aspectum-primary"
              />
              Показывать (is_show)
            </FormLabel>
          </div>

          {form.filterType === 'tag' && isEdit && !flatCatalog ? (
            <div>
              <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xxs">
                Папка
              </FormLabel>
              <Select className="bg-aspectum-surface" value={form.parentId} onChange={(ev) => setForm((p) => ({ ...p, parentId: ev.target.value })) }>
                <option value="">Выберите папку</option>
                {folderOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label || opt.id}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <Panel tone="muted" className="p-3 space-y-2">
            <p className="text-xs font-medium text-aspectum-text-subtle">Изображение (pic_id)</p>
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                className="w-20 h-20 rounded-aspectum-control object-cover border border-aspectum-border"
              />
            ) : (
              <span className="text-xs text-aspectum-text-disabled">Нет изображения</span>
            )}
            <div className="flex flex-wrap gap-2">
              <FileButton
                inputRef={fileRef}
                accept="image/*"
                size="sm"
                variant="softStrong"
                disabled={uploading}
                onChange={handleFile}
              >
                {uploading ? 'Загрузка…' : '+ Загрузить изображение'}
              </FileButton>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((p) => ({ ...p, picId: null, imagePreview: '' }))
                }
              >
                Убрать изображение
              </Button>
            </div>
          </Panel>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-aspectum-border">
            <Button
              type="submit"
              disabled={submitting}
              variant="primary"
              size="md"
            >
              {submitLabel}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              variant="outline"
              size="md"
            >
              Отмена
            </Button>
            {isCreate ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setQuickTitle(getMultiLangValue(form.title) || quickTitle.trim());
                  setAdvancedOpen(false);
                }}
                disabled={submitting}
              >
                Простой ввод
              </Button>
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
  onBulkDeleteCityTags,
  onBulkDeleteEventTags,
  onTranslateSelectedTags,
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
  const { confirm, confirmModal } = useConfirmModal(DefaultConfirmModal);
  const [catalogTab, setCatalogTab] = useState('city');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickName, setQuickName] = useState('');
  const [modal, setModal] = useState(null);
  const [creatingCityTagQuick, setCreatingCityTagQuick] = useState(false);
  const [creatingEventFolderQuick, setCreatingEventFolderQuick] = useState(false);
  const [creatingTagByFolderId, setCreatingTagByFolderId] = useState(() => new Set());
  const quickCreatePendingRef = useRef(new Set());

  const [selectedCityTagIds, setSelectedCityTagIds] = useState(() => new Set());
  const [selectedEventTagIds, setSelectedEventTagIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkTranslating, setBulkTranslating] = useState(false);

  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventQuickFolder, setEventQuickFolder] = useState('');
  const [eventQuickTagByFolder, setEventQuickTagByFolder] = useState({});
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [eventModal, setEventModal] = useState(null);

  const { languages: appLanguages } = useAppLanguages();
  const multiLangLanguages = useMemo(
    () => mapAppLanguagesForFields(appLanguages),
    [appLanguages],
  );

  useEffect(() => {
    setSelectedCityTagIds(new Set());
    setSelectedEventTagIds(new Set());
  }, [catalogTab]);

  const targetLanguageCodes = useMemo(
    () => multiLangLanguages.map((lang) => lang.code).filter(Boolean),
    [multiLangLanguages],
  );

  const toggleCityTagSelected = useCallback((tagId) => {
    const id = normalizeId(tagId);
    if (!id) return;
    setSelectedCityTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleEventTagSelected = useCallback((tagId) => {
    const id = normalizeId(tagId);
    if (!id) return;
    setSelectedEventTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDeleteCityTags = async () => {
    const ids = [...selectedCityTagIds];
    if (!ids.length || bulkDeleting) return;

    if (!(await confirm({
      title: 'Удаление',
      message: `Удалить выбранные теги: ${ids.length}?`,
      danger: true,
      confirmLabel: 'Удалить',
    }))) {
      return;
    }

    setBulkDeleting(true);
    try {
      const result = await onBulkDeleteCityTags?.(ids);
      const failed = Number(result?.failed ?? 0);
      if (failed > 0) {
        await onReloadCityTagCatalog?.();
      }
      setSelectedCityTagIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDeleteEventTags = async () => {
    const ids = [...selectedEventTagIds];
    if (!ids.length || bulkDeleting) return;

    if (!(await confirm({
      title: 'Удаление',
      message: `Удалить выбранные теги: ${ids.length}?`,
      danger: true,
      confirmLabel: 'Удалить',
    }))) {
      return;
    }

    setBulkDeleting(true);
    try {
      const result = await onBulkDeleteEventTags?.(ids);
      const failed = Number(result?.failed ?? 0);
      if (failed > 0) {
        await onReloadEventFilters?.();
      }
      setSelectedEventTagIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkTranslateCityTags = async () => {
    const ids = [...selectedCityTagIds];
    if (!ids.length || bulkTranslating) return;

    setBulkTranslating(true);
    try {
      await onTranslateSelectedTags?.({
        filterType: 'city',
        ids,
        sourceLanguage: 'ru',
        targetLanguages: targetLanguageCodes,
      });
      setSelectedCityTagIds(new Set());
    } catch {
      /* toast в контроллере */
    } finally {
      setBulkTranslating(false);
    }
  };

  const handleBulkTranslateEventTags = async () => {
    const ids = [...selectedEventTagIds];
    if (!ids.length || bulkTranslating) return;

    setBulkTranslating(true);
    try {
      await onTranslateSelectedTags?.({
        filterType: 'event',
        ids,
        sourceLanguage: 'ru',
        targetLanguages: targetLanguageCodes,
      });
      setSelectedEventTagIds(new Set());
    } catch {
      /* toast в контроллере */
    } finally {
      setBulkTranslating(false);
    }
  };

  const activeSelectedCount =
    catalogTab === 'city' ? selectedCityTagIds.size : selectedEventTagIds.size;

  const handleTranslateActiveTags =
    catalogTab === 'city'
      ? handleBulkTranslateCityTags
      : handleBulkTranslateEventTags;

  const bulkActionsToolbar = (selectedCount, { onDelete }) => (
    <div className="flex items-center justify-end gap-2 mb-2">
      <span className="text-xs font-medium text-aspectum-text-subtle">Выбрано: {selectedCount}</span>
      <Button
        type="button"
        onClick={onDelete}
        disabled={selectedCount === 0 || bulkDeleting || bulkTranslating}
        variant="softDanger"
        size="sm"
      >
        {bulkDeleting ? '...' : 'Удалить'}
      </Button>
    </div>
  );

  const isCreatingInFolder = (folderId) =>
    creatingTagByFolderId.has(String(folderId));

  const markCreatingInFolder = (folderId) => {
    setCreatingTagByFolderId((prev) => {
      const next = new Set(prev);
      next.add(String(folderId));
      return next;
    });
  };

  const unmarkCreatingInFolder = (folderId) => {
    setCreatingTagByFolderId((prev) => {
      const next = new Set(prev);
      next.delete(String(folderId));
      return next;
    });
  };

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
    if (!title || creatingEventFolderQuick) {
      return;
    }

    const scopeKey = 'event-folder';
    if (quickCreatePendingRef.current.has(scopeKey)) {
      return;
    }

    quickCreatePendingRef.current.add(scopeKey);
    setCreatingEventFolderQuick(true);
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
    } finally {
      quickCreatePendingRef.current.delete(scopeKey);
      setCreatingEventFolderQuick(false);
    }
  };

  const handleEventQuickFolderKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    handleEventQuickFolderSubmit(event);
  };

  const handleEventQuickTagSubmit = async (folderId) => {
    const fid = normalizeId(folderId);
    const title = (eventQuickTagByFolder[fid] || '').trim();
    if (!fid || !title || isCreatingInFolder(fid)) {
      return;
    }

    const scopeKey = `event-tag:${fid}`;
    if (quickCreatePendingRef.current.has(scopeKey)) {
      return;
    }

    quickCreatePendingRef.current.add(scopeKey);
    markCreatingInFolder(fid);
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
    } finally {
      quickCreatePendingRef.current.delete(scopeKey);
      unmarkCreatingInFolder(fid);
    }
  };

  const handleEventQuickTagKeyDown = (event, folderId) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    handleEventQuickTagSubmit(folderId);
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
    if (!title || creatingCityTagQuick) {
      return;
    }

    const scopeKey = 'city-tag';
    if (quickCreatePendingRef.current.has(scopeKey)) {
      return;
    }

    quickCreatePendingRef.current.add(scopeKey);
    setCreatingCityTagQuick(true);
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
    } finally {
      quickCreatePendingRef.current.delete(scopeKey);
      setCreatingCityTagQuick(false);
    }
  };

  const handleQuickKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    handleQuickSubmit(event);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Справочник тегов" description="Создавайте и редактируйте теги. На странице города теги только выбираются." />

      <div className="border-b border-aspectum-border">
        <Tabs
          items={[
            { id: 'city', label: 'Теги городов' },
            { id: 'attraction', label: 'Теги достопримечательностей' },
          ]}
          value={catalogTab}
          onChange={setCatalogTab}
        />
      </div>

      {catalogTab === 'city' ? (
        <div className="space-y-4 pt-2">
          <div>
            <Heading level={3} size="sm" weight="medium" className="mb-1">Теги городов</Heading>
            <p className="text-xs text-aspectum-text-muted mb-3">
              Плоский список без папок. Быстрое создание по названию.
            </p>

            <form onSubmit={handleQuickSubmit} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xxs">
                  Название тега
                </FormLabel>
                <TextInput className="disabled:opacity-50" type="text" value={quickName} onChange={(ev) => setQuickName(ev.target.value)} onKeyDown={handleQuickKeyDown} disabled={creatingCityTagQuick} placeholder="Введите название тега…" />
              </div>
              <Button
                type="submit"
                disabled={cityTagCatalogLoading || creatingCityTagQuick || !quickName.trim()}
                variant="primary"
                size="md"
              >
                {creatingCityTagQuick ? 'Добавление...' : 'Добавить'}
              </Button>
              <Button
                type="button"
                onClick={openCreateFlat}
                variant="soft"
                size="md"
              >
                Форма…
              </Button>
            </form>
          </div>

          <div>
            <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xs">Поиск</FormLabel>
            <TextInput className="max-w-md" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Название, описание…" />
          </div>

          {cityTagCatalogLoading && (
            <Panel tone="muted" className="py-8">
              <InlineState loading align="center">Загрузка тегов…</InlineState>
            </Panel>
          )}

          {!cityTagCatalogLoading && cityTagCatalogError && (
            <Alert tone="error" className="space-y-2">
              <p>{cityTagCatalogError}</p>
              <Button
                type="button"
                onClick={() => onReloadCityTagCatalog?.()}
                variant="outline"
                size="sm"
              >
                Повторить
              </Button>
            </Alert>
          )}

          {!cityTagCatalogLoading && !cityTagCatalogError && filteredCityTags.length === 0 && (
            <EmptyState icon="🏷️" title="Тегов пока нет" description="Добавьте первый тег выше." />
          )}

          {!cityTagCatalogLoading && !cityTagCatalogError && filteredCityTags.length > 0 && (
            <>
              {bulkActionsToolbar(selectedCityTagIds.size, {
                onDelete: handleBulkDeleteCityTags,
              })}
            <ul className="divide-y divide-aspectum-border border border-aspectum-border rounded-aspectum-card overflow-hidden bg-aspectum-surface">
              {filteredCityTags.map((tag) => {
                const id = normalizeId(tag.id);
                const title = getMultilangDisplay(tag.title ?? tag.name) || id;
                const imageUrl = tag.image_url || tag.imageUrl || '';
                return (
                  <li
                    key={id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-aspectum-surface-muted"
                  >
                    <Checkbox
                      checked={selectedCityTagIds.has(id)}
                      onChange={() => toggleCityTagSelected(id)}
                      onClick={(event) => event.stopPropagation()}
                      className="w-4 h-4 rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus shrink-0"
                      aria-label={`Выбрать тег ${title}`}
                    />
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-9 h-9 rounded object-cover border border-aspectum-border shrink-0"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded bg-aspectum-surface-subtle border border-aspectum-border shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 text-sm font-medium text-aspectum-text truncate">
                      {title}
                    </span>
                    <Button
                      type="button"
                      onClick={() => openEditFlat(tag)}
                      variant="link"
                      size="sm"
                      className="shrink-0"
                    >
                      Ред.
                    </Button>
                    <Button
                      type="button"
                      disabled={deletingCityFilterIds.has(id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteTag(tag);
                      }}
                      variant="softDanger"
                      size="sm"
                      className="shrink-0"
                    >
                      Удалить
                    </Button>
                  </li>
                );
              })}
            </ul>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div>
            <Heading level={3} size="sm" weight="medium" className="mb-1">
              Теги достопримечательностей
            </Heading>
            <p className="text-xs text-aspectum-text-muted mb-3">
              Папки и теги для событий. На странице достопримечательности — только выбор.
            </p>

            <form
              onSubmit={handleEventQuickFolderSubmit}
              className="flex flex-wrap gap-2 items-end mb-3"
            >
              <div className="flex-1 min-w-[200px]">
                <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xxs">
                  + Новая папка
                </FormLabel>
                <TextInput className="disabled:opacity-50" type="text" value={eventQuickFolder} onChange={(ev) => setEventQuickFolder(ev.target.value)} onKeyDown={handleEventQuickFolderKeyDown} disabled={creatingEventFolderQuick} placeholder="Название папки…" />
              </div>
              <Button
                type="submit"
                disabled={
                  eventFilterTreeLoading || creatingEventFolderQuick || !eventQuickFolder.trim()
                }
                variant="primary"
                size="md"
              >
                {creatingEventFolderQuick ? 'Добавление...' : 'Создать'}
              </Button>
              <Button
                type="button"
                onClick={openCreateEventFolderModal}
                variant="soft"
                size="md"
              >
                Форма…
              </Button>
            </form>
          </div>

          <div>
            <FormLabel  layout="block" size="xs" weight="medium" tone="subtle" spacing="xs">Поиск</FormLabel>
            <TextInput className="max-w-md" type="search" value={eventSearchQuery} onChange={(e) => setEventSearchQuery(e.target.value)} placeholder="Папка или тег…" />
          </div>

          {eventFilterTreeLoading && (
            <Panel tone="muted" className="py-8">
              <InlineState loading align="center">Загрузка…</InlineState>
            </Panel>
          )}

          {!eventFilterTreeLoading && eventFilterTreeError && (
            <Alert tone="error" className="space-y-2">
              <p>{eventFilterTreeError}</p>
              <Button
                type="button"
                onClick={() => onReloadEventFilters?.()}
                variant="outline"
                size="sm"
              >
                Повторить
              </Button>
            </Alert>
          )}

          {!eventFilterTreeLoading &&
            !eventFilterTreeError &&
            filteredEventFolders.length === 0 && (
              <EmptyState icon="📁" title="Папок пока нет" description="Создайте первую папку выше." />
            )}

          {!eventFilterTreeLoading &&
            !eventFilterTreeError &&
            filteredEventFolders.length > 0 && (
              <>
              {bulkActionsToolbar(selectedEventTagIds.size, {
                onDelete: handleBulkDeleteEventTags,
              })}
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
                      className="border border-aspectum-border rounded-aspectum-card bg-aspectum-surface overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-aspectum-surface-muted border-b border-aspectum-border-subtle">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => toggleFolderCollapsed(fid)}
                          className="w-6"
                          aria-label={folded ? 'Развернуть' : 'Свернуть'}
                        >
                          {folded ? '▸' : '▾'}
                        </Button>
                        <span className="flex-1 font-medium text-sm text-aspectum-text">
                          {folderTitle}
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => openEditEventFilter(folder, null)}
                        >
                          Ред.
                        </Button>
                        <Button
                          type="button"
                          variant="linkDanger"
                          size="sm"
                          disabled={deletingEventFilterIds.has(fid)}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteEventFolder(folder);
                          }}
                        >
                          Удалить
                        </Button>
                      </div>

                      {!folded && (
                        <div className="p-3 space-y-2">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[160px]">
                              <FormLabel  layout="block" size="xs" tone="muted" spacing="xxs">
                                + Тег
                              </FormLabel>
                              <TextInput className="disabled:opacity-50" type="text" value={eventQuickTagByFolder[fid] || ''} onChange={(ev) => setEventQuickTagByFolder((p) => ({ ...p, [fid]: ev.target.value, })) } onKeyDown={(ev) => handleEventQuickTagKeyDown(ev, fid)} disabled={isCreatingInFolder(fid)} placeholder="Название тега…" />
                            </div>
                            <Button
                              type="button"
                              onClick={() => handleEventQuickTagSubmit(fid)}
                              disabled={
                                isCreatingInFolder(fid)
                                || !((eventQuickTagByFolder[fid] || '').trim())
                              }
                              variant="primary"
                              size="sm"
                            >
                              {isCreatingInFolder(fid) ? 'Добавление...' : 'Добавить'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => openCreateEventTagModal(folder)}
                              variant="soft"
                              size="sm"
                            >
                              Форма…
                            </Button>
                          </div>

                          {visibleTags.length === 0 ? (
                            <p className="text-xs text-aspectum-text-disabled py-2">
                              В этой папке пока нет тегов.
                            </p>
                          ) : (
                            <ul className="divide-y divide-aspectum-border border border-aspectum-border rounded-aspectum-control bg-aspectum-surface">
                              {visibleTags.map((tag) => {
                                const tid = normalizeId(tag.id);
                                const ttitle =
                                  getMultilangDisplay(tag.title ?? tag.name) || tid;
                                const imageUrl = tag.image_url || tag.imageUrl || '';
                                return (
                                  <li
                                    key={tid}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-aspectum-surface-muted"
                                  >
                                    <Checkbox
                                      checked={selectedEventTagIds.has(tid)}
                                      onChange={() => toggleEventTagSelected(tid)}
                                      onClick={(event) => event.stopPropagation()}
                                      className="w-4 h-4 rounded border-aspectum-border-strong text-aspectum-primary focus:ring-aspectum-focus shrink-0"
                                      aria-label={`Выбрать тег ${ttitle}`}
                                    />
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt=""
                                        className="w-8 h-8 rounded object-cover border border-aspectum-border shrink-0"
                                      />
                                    ) : (
                                      <span className="w-8 h-8 rounded bg-aspectum-surface-subtle border border-aspectum-border shrink-0" />
                                    )}
                                    <span className="flex-1 min-w-0 text-sm truncate">
                                      {ttitle}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="link"
                                      size="sm"
                                      onClick={() => openEditEventFilter(tag, folder)}
                                      className="shrink-0"
                                    >
                                      Ред.
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="linkDanger"
                                      size="sm"
                                      disabled={deletingEventFilterIds.has(tid)}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteEventTag(tag);
                                      }}
                                      className="shrink-0"
                                    >
                                      Удалить
                                    </Button>
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
              </>
            )}
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          onClick={() => onGoToStep?.(1)}
          variant="outline"
          size="md"
        >
          ← Назад: Город
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleTranslateActiveTags}
            disabled={activeSelectedCount === 0 || bulkDeleting || bulkTranslating}
            variant="soft"
            size="md"
          >
            {bulkTranslating ? 'Перевод...' : 'Перевести'}
          </Button>

          <Button
            type="button"
            onClick={() => onGoToStep?.(3)}
            disabled={saving}
            variant="primary"
            size="md"
          >
            {saving ? 'Сохранение...' : 'Далее: Достопримечательности →'}
          </Button>
        </div>
      </div>

      <Modal open={Boolean(modal)} onClose={closeModal} size="lg" title={modal?.mode === 'create-folder' ? 'Новая папка тегов' : 'Редактор тега'}>
        {modal ? (
            <CityFilterForm
              key={`${modal.mode}-${modal.filterId}-${modal.flatCatalog ? 'flat' : 'tree'}-${modal.initial?.parentId ?? ''}`}
              mode={modal.mode}
              folderId={modal.folderId}
              filterId={modal.filterId}
              folderDisplayName={modal.folderDisplayName || ''}
              initialValue={modal.initial}
              folderOptions={[]}
              flatCatalog={Boolean(modal.flatCatalog)}
              pendingScope="city-modal"
              appLanguages={appLanguages}
              multiLangLanguages={multiLangLanguages}
              onCreateCityTag={onCreateCityTag}
              onUpdateCityFilter={onUpdateCityFilter}
              onCancel={closeModal}
              onUploadCityFilterImage={onUploadCityFilterImage}
            />
        ) : null}
      </Modal>

      <Modal open={Boolean(eventModal)} onClose={closeEventModal} size="lg" title={eventModal?.mode === 'create-folder' ? 'Новая папка событий' : 'Редактор фильтра событий'}>
        {eventModal ? (
            <CityFilterForm
              key={`event-${eventModal.mode}-${eventModal.filterId}-${eventModal.initial?.parentId ?? ''}`}
              mode={eventModal.mode}
              folderId={eventModal.folderId}
              filterId={eventModal.filterId}
              folderDisplayName={eventModal.folderDisplayName || ''}
              initialValue={eventModal.initial}
              folderOptions={eventFolderOptions}
              flatCatalog={false}
              appLanguages={appLanguages}
              multiLangLanguages={multiLangLanguages}
              pendingScope={
                eventModal.mode === 'create-folder'
                  ? 'event-modal-folder'
                  : `event-modal-tag:${eventModal.folderId || 'none'}`
              }
              onCancel={closeEventModal}
              onCreateFilterFolder={onCreateEventFilterFolder}
              onCreateFilterTagInFolder={onCreateEventFilterTag}
              onUpdateFilter={onUpdateEventFilter}
              onUploadFilterImage={onUploadEventFilterImage}
            />
        ) : null}
      </Modal>
      {confirmModal}
    </div>
  );
}
