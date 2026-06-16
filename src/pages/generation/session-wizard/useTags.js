import { useCallback, useRef, useState } from 'react';
import { cityFiltersAPI, eventFiltersAPI, imagesAPI } from '../../../api/generation';
import {
  parseApiError,
  isNotFoundError,
} from '../../../utils/apiError';
import {
  applyLocalFilterDeletion,
  mergeCityFilterTreeWithLocalOverlays,
  mergeCityTagCatalogWithLocalOverlays,
  mergeEventFilterTreeWithLocalOverlays,
  normalizeCreatedFilter,
  unwrapCreatedFilter,
  upsertFlatFilterRow,
} from '../../../features/catalog/shared/tagCatalog';
import {
  removeFilterIdsFromTree,
  upsertEventFilterInTree,
} from '../../../features/catalog/shared/normalize';
import { normalizeId } from './useSessionWizardHelpers';

export default function useTags({ showNote, confirm } = {}) {
  const [cityFilterTree, setCityFilterTree] = useState([]);
  const [cityFilterTreeLoading, setCityFilterTreeLoading] = useState(false);
  const [cityFilterTreeError, setCityFilterTreeError] = useState('');

  const [eventFilterTree, setEventFilterTree] = useState([]);
  const [eventFilterTreeLoading, setEventFilterTreeLoading] = useState(false);
  const [eventFilterTreeError, setEventFilterTreeError] = useState('');

  const [cityTagCatalog, setCityTagCatalog] = useState([]);
  const [cityTagCatalogLoading, setCityTagCatalogLoading] = useState(false);
  const [cityTagCatalogError, setCityTagCatalogError] = useState('');

  const locallyDeletedCityFilterIdsRef = useRef(new Set());
  const locallyDeletedEventFilterIdsRef = useRef(new Set());
  const locallyCreatedCityFiltersRef = useRef(new Map());
  const locallyCreatedEventFiltersRef = useRef(new Map());
  const deletingCityFilterPendingRef = useRef(new Set());
  const deletingEventFilterPendingRef = useRef(new Set());
  const [deletingCityFilterIds, setDeletingCityFilterIds] = useState(() => new Set());
  const [deletingEventFilterIds, setDeletingEventFilterIds] = useState(() => new Set());

  const loadCityFilterTree = useCallback(async () => {
    setCityFilterTreeLoading(true);
    setCityFilterTreeError('');

    try {
      const res = await cityFiltersAPI.getTree();
      const raw = res?.data?.data ?? res?.data?.results ?? res?.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.tree)
          ? raw.tree
          : [];

      const tree = Array.isArray(data) ? data : [];
      setCityFilterTree(
        mergeCityFilterTreeWithLocalOverlays(
          tree,
          locallyCreatedCityFiltersRef.current,
          locallyDeletedCityFilterIdsRef.current,
        ),
      );
    } catch (error) {
      setCityFilterTreeError(
        parseApiError(error, 'Ошибка загрузки тегов города')
      );
    } finally {
      setCityFilterTreeLoading(false);
    }
  }, []);

  const loadEventFilterTree = useCallback(async () => {
    setEventFilterTreeLoading(true);
    setEventFilterTreeError('');

    try {
      const res = await eventFiltersAPI.getTree();
      const data = res?.data?.data || res?.data?.results || res?.data || [];
      const tree = Array.isArray(data) ? data : [];
      setEventFilterTree(
        mergeEventFilterTreeWithLocalOverlays(
          tree,
          locallyCreatedEventFiltersRef.current,
          locallyDeletedEventFilterIdsRef.current,
        ),
      );
    } catch (error) {
      setEventFilterTreeError(
        parseApiError(error, 'Ошибка загрузки тегов достопримечательностей')
      );
    } finally {
      setEventFilterTreeLoading(false);
    }
  }, []);

  const loadCityTagCatalog = useCallback(async () => {
    setCityTagCatalogLoading(true);
    setCityTagCatalogError('');

    try {
      const res = await cityFiltersAPI.getTags();
      const raw = res?.data?.data ?? res?.data?.results ?? res?.data ?? [];
      const rows = Array.isArray(raw) ? raw : [];
      setCityTagCatalog(
        mergeCityTagCatalogWithLocalOverlays(
          rows,
          locallyCreatedCityFiltersRef.current,
          locallyDeletedCityFilterIdsRef.current,
        ),
      );
    } catch (error) {
      setCityTagCatalogError(
        parseApiError(error, 'Ошибка загрузки тегов города')
      );
    } finally {
      setCityTagCatalogLoading(false);
    }
  }, []);

  const createCityFilterFolder = useCallback(async (payload) => {
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'folder',
        parent_id: null,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedCityFilterIdsRef.current.delete(idStr);
        locallyCreatedCityFiltersRef.current.set(idStr, created);
        setCityFilterTree((prev) => upsertEventFilterInTree(prev, created));
      }
      showNote('Папка создана', 'success');
      void loadCityFilterTree().catch((err) => {
        console.error('City filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания папки'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, showNote]);

  const createCityFilterTag = useCallback(async (folderId, payload) => {
    const parentId = normalizeId(folderId);
    if (!parentId) {
      showNote('Не указана папка для тега', 'error');
      return;
    }
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: parentId,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedCityFilterIdsRef.current.delete(idStr);
        locallyCreatedCityFiltersRef.current.set(idStr, created);
        setCityFilterTree((prev) => upsertEventFilterInTree(prev, created));
      }
      showNote('Тег создан', 'success');
      void loadCityFilterTree().catch((err) => {
        console.error('City filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, showNote]);

  const createCityTag = useCallback(async (payload) => {
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: payload?.parent_id ?? null,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedCityFilterIdsRef.current.delete(idStr);
        locallyCreatedCityFiltersRef.current.set(idStr, created);
        setCityTagCatalog((prev) => upsertFlatFilterRow(prev, created));
      }
      showNote('Тег города создан', 'success');
      void loadCityTagCatalog().catch((err) => {
        console.error('City tag catalog reload failed', err);
      });
      void loadCityFilterTree().catch((err) => {
        console.error('City filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadCityTagCatalog, loadCityFilterTree, showNote]);

  const updateCityFilter = useCallback(async (filterId, payload) => {
    const id = normalizeId(filterId);
    if (!id) return;
    try {
      await cityFiltersAPI.update(id, payload);
      locallyDeletedCityFilterIdsRef.current.delete(String(id));
      showNote('Сохранено', 'success');
      await loadCityFilterTree();
      await loadCityTagCatalog();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка сохранения'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, loadCityTagCatalog, showNote]);

  const deleteCityFilter = useCallback(async (filterId, opts = {}) => {
    const id = normalizeId(filterId);
    if (!id) return;
    const message = opts.message || 'Удалить этот элемент?';
    if (!(await confirm({ message, danger: true }))) return;

    const idStr = String(id);
    if (deletingCityFilterPendingRef.current.has(idStr)) {
      return;
    }

    deletingCityFilterPendingRef.current.add(idStr);
    setDeletingCityFilterIds((prev) => {
      const next = new Set(prev);
      next.add(idStr);
      return next;
    });

    const applyLocalRemove = () => {
      applyLocalFilterDeletion(
        idStr,
        locallyDeletedCityFilterIdsRef.current,
        locallyCreatedCityFiltersRef.current,
      );
      setCityTagCatalog((prev) =>
        prev.filter((item) => String(item.id) !== idStr),
      );
      setCityFilterTree((prev) =>
        removeFilterIdsFromTree(prev, locallyDeletedCityFilterIdsRef.current),
      );
    };

    try {
      await cityFiltersAPI.delete(id);
      applyLocalRemove();
      showNote('Удалено', 'success');
    } catch (e) {
      if (isNotFoundError(e)) {
        applyLocalRemove();
        showNote('Элемент уже удалён', 'success');
      } else {
        showNote(parseApiError(e, 'Не удалось удалить'), 'error');
      }
    } finally {
      deletingCityFilterPendingRef.current.delete(idStr);
      setDeletingCityFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
      void loadCityFilterTree().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
      void loadCityTagCatalog().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
    }
  }, [confirm, loadCityFilterTree, loadCityTagCatalog, showNote]);

  const uploadCityFilterImage = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      showNote('Выберите файл изображения', 'error');
      return null;
    }
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('temp', '1');
      const res = await imagesAPI.upload(fd);
      const { id, url } = res?.data || {};
      if (id && url) {
        showNote('Изображение загружено', 'success');
        return { id, url };
      }
      showNote('Сервер не вернул данные изображения', 'error');
      return null;
    } catch (err) {
      showNote(
        'Ошибка загрузки изображения: ' + parseApiError(err, 'Ошибка загрузки'),
        'error'
      );
      return null;
    }
  }, [showNote]);

  const uploadEventFilterImage = uploadCityFilterImage;

  const createEventFilterFolder = useCallback(async (payload) => {
    try {
      const res = await eventFiltersAPI.create({
        ...payload,
        type: 'folder',
        parent_id: null,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedEventFilterIdsRef.current.delete(idStr);
        locallyCreatedEventFiltersRef.current.set(idStr, created);
        setEventFilterTree((prev) => upsertEventFilterInTree(prev, created));
      }
      showNote('Папка создана', 'success');
      void loadEventFilterTree().catch((err) => {
        console.error('Event filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания папки'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote]);

  const createEventFilterTag = useCallback(async (folderId, payload) => {
    const parentId = normalizeId(folderId);
    if (!parentId) {
      showNote('Не указана папка для тега', 'error');
      return;
    }
    try {
      const res = await eventFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: parentId,
      });
      const created = normalizeCreatedFilter(
        unwrapCreatedFilter(res) || { ...payload, parent_id: parentId },
      );
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedEventFilterIdsRef.current.delete(idStr);
        locallyCreatedEventFiltersRef.current.set(idStr, {
          ...created,
          parent_id: created.parent_id ?? parentId,
        });
        setEventFilterTree((prev) =>
          upsertEventFilterInTree(prev, {
            ...created,
            parent_id: created.parent_id ?? parentId,
          }),
        );
      }
      showNote('Тег создан', 'success');
      void loadEventFilterTree().catch((err) => {
        console.error('Event filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote]);

  const updateEventFilter = useCallback(async (filterId, payload) => {
    const id = normalizeId(filterId);
    if (!id) return;
    try {
      await eventFiltersAPI.update(id, payload);
      locallyDeletedEventFilterIdsRef.current.delete(String(id));
      showNote('Сохранено', 'success');
      await loadEventFilterTree();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка сохранения'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote]);

  const deleteEventFilter = useCallback(async (filterId, opts = {}) => {
    const id = normalizeId(filterId);
    if (!id) return;
    const message = opts.message || 'Удалить этот элемент?';
    if (!(await confirm({ message, danger: true }))) return;

    const idStr = String(id);
    if (deletingEventFilterPendingRef.current.has(idStr)) {
      return;
    }

    deletingEventFilterPendingRef.current.add(idStr);
    setDeletingEventFilterIds((prev) => {
      const next = new Set(prev);
      next.add(idStr);
      return next;
    });

    const applyLocalRemove = () => {
      applyLocalFilterDeletion(
        idStr,
        locallyDeletedEventFilterIdsRef.current,
        locallyCreatedEventFiltersRef.current,
      );
      setEventFilterTree((prev) =>
        removeFilterIdsFromTree(prev, locallyDeletedEventFilterIdsRef.current),
      );
    };

    try {
      await eventFiltersAPI.delete(id);
      applyLocalRemove();
      showNote('Удалено', 'success');
    } catch (e) {
      if (isNotFoundError(e)) {
        applyLocalRemove();
        showNote('Элемент уже удалён', 'success');
      } else {
        showNote(parseApiError(e, 'Не удалось удалить'), 'error');
      }
    } finally {
      deletingEventFilterPendingRef.current.delete(idStr);
      setDeletingEventFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
      void loadEventFilterTree().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
    }
  }, [confirm, loadEventFilterTree, showNote]);

  return {
    cityFilterTree,
    cityFilterTreeLoading,
    cityFilterTreeError,
    eventFilterTree,
    eventFilterTreeLoading,
    eventFilterTreeError,
    cityTagCatalog,
    cityTagCatalogLoading,
    cityTagCatalogError,
    locallyDeletedCityFilterIdsRef,
    locallyDeletedEventFilterIdsRef,
    locallyCreatedCityFiltersRef,
    locallyCreatedEventFiltersRef,
    deletingCityFilterPendingRef,
    deletingEventFilterPendingRef,
    deletingCityFilterIds,
    deletingEventFilterIds,
    loadCityFilterTree,
    loadEventFilterTree,
    loadCityTagCatalog,
    createCityFilterFolder,
    createCityFilterTag,
    createCityTag,
    updateCityFilter,
    deleteCityFilter,
    createEventFilterFolder,
    createEventFilterTag,
    updateEventFilter,
    deleteEventFilter,
    uploadCityFilterImage,
    uploadEventFilterImage,
  };
}
