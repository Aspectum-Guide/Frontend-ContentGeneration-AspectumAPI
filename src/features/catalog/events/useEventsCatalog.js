import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { normalizeListResponse } from '../shared/normalize';
import { buildLangOptions, pickPrimaryLangCode } from '../shared/i18n';
import { parseApiError } from '../../../utils/apiError';
import { eventsCatalogAPI } from './api';
import { createEmptyEvent, fromApiEventRow, mergeEventWithDetail, toApiEventPayload } from './adapters';

const PAGE_SIZE = 20;

export function useEventsCatalog() {
  const navigate = useNavigate();
  const { page, setPage, search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 400 });

  const [cityFilter, setCityFilter] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [allEventFilters, setAllEventFilters] = useState([]);

  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // edit state
  const [editingEvent, setEditingEvent] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [activeLang, setActiveLang] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const loadEvents = useCallback(async (pageNum = 1, q = '', city = '') => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: pageNum,
        page_size: PAGE_SIZE,
        ...(q ? { search: q } : {}),
        ...(city ? { city_id: city } : {}),
      };
      const response = await eventsCatalogAPI.list(params);
      const data = response?.data;
      const list = normalizeListResponse(data, ['events', 'results']).map(fromApiEventRow).filter(Boolean);
      const count = data?.total ?? data?.count ?? list.length;
      setEvents(list);
      setTotalCount(count);
    } catch (err) {
      setEvents([]);
      setTotalCount(0);
      setError(parseApiError(err, 'Ошибка загрузки событий'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    eventsCatalogAPI
      .listCities({ page_size: 300 })
      .then((r) => {
        const data = r?.data;
        const list = normalizeListResponse(data, ['data', 'results']);
        setCityOptions(list);
      })
      .catch(() => {});

    eventsCatalogAPI
      .listFilters()
      .then((r) => {
        const data = r?.data;
        const list = normalizeListResponse(data, ['filters', 'tags', 'results']);
        setAllEventFilters(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadEvents(page, debouncedSearch, cityFilter);
  }, [page, debouncedSearch, cityFilter, loadEvents]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, cityFilter, setPage]);

  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    setDeleteError(null);
    setActiveLang(pickPrimaryLangCode([row?.title, row?.description]));
    setEditingEvent(fromApiEventRow(row));
    setEditLoading(true);
    try {
      const r = await eventsCatalogAPI.get(row.id);
      const d = r?.data;
      setEditingEvent((prev) => mergeEventWithDetail(prev, d));
    } catch {
      // ignore
    }
    setEditLoading(false);
  }, []);

  const openCreate = useCallback(() => {
    setSaveError(null);
    setEditLoading(false);
    setActiveLang('');
    setEditingEvent(createEmptyEvent());
  }, []);

  const toggleTag = useCallback((filterId) => {
    setEditingEvent((prev) => {
      if (!prev) return prev;
      const ids = prev.tag_ids || [];
      const sid = String(filterId);
      return { ...prev, tag_ids: ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid] };
    });
  }, []);

  const handleSave = useCallback(async (e) => {
    e?.preventDefault();
    if (!editingEvent) return;
    try {
      setSaving(true);
      setSaveError(null);
      const payload = toApiEventPayload(editingEvent);
      if (editingEvent.id) {
        await eventsCatalogAPI.update(editingEvent.id, payload);
      } else {
        await eventsCatalogAPI.create(payload);
      }
      setEditingEvent(null);
      await loadEvents(page, debouncedSearch, cityFilter);
    } catch (err) {
      setSaveError(parseApiError(err, editingEvent?.id ? 'Ошибка сохранения' : 'Ошибка создания'));
    } finally {
      setSaving(false);
    }
  }, [editingEvent, loadEvents, page, debouncedSearch, cityFilter]);

  const requestDelete = useCallback((row) => {
    setDeleteError(null);
    setDeleteTarget(row);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await eventsCatalogAPI.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadEvents(page, debouncedSearch, cityFilter);
    } catch (err) {
      setDeleteError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadEvents, page, debouncedSearch, cityFilter]);

  const ee = editingEvent;
  const titleVal = typeof ee?.title === 'object' ? ee.title : {};
  const descVal = typeof ee?.description === 'object' ? ee.description : {};
  const langOptions = useMemo(() => buildLangOptions([titleVal, descVal]), [titleVal, descVal]);

  useEffect(() => {
    if (!editingEvent || langOptions.length === 0) return;
    const hasActive = langOptions.some((lang) => lang.code === activeLang);
    if (!hasActive) setActiveLang(langOptions[0].code);
  }, [editingEvent, langOptions, activeLang]);

  const openTags = useCallback(() => navigate('/catalog/tags?tab=event'), [navigate]);

  return {
    // list
    events,
    totalCount,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    pageSize: PAGE_SIZE,
    cityFilter,
    setCityFilter,
    cityOptions,

    // editor
    editingEvent,
    setEditingEvent,
    editLoading,
    openEdit,
    openCreate,
    activeLang,
    setActiveLang,
    saving,
    saveError,
    handleSave,
    langOptions,
    titleVal,
    descVal,
    allEventFilters,
    toggleTag,

    // delete
    deleteTarget,
    setDeleteTarget,
    deleting,
    deleteError,
    requestDelete,
    confirmDelete,

    // shortcuts
    openTags,
  };
}

