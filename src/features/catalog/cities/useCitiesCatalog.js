import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { normalizeListResponse } from '../shared/normalize';
import { buildLangOptions, getMultiLangValue, pickPrimaryLangCode } from '../shared/i18n';
import { parseApiError } from '../../../utils/apiError';
import { citiesCatalogAPI } from './api';
import { fromApiCity, mergeCityRowWithApiDetail, toApiCityUpdatePayload } from './adapters';

const PAGE_SIZE = 20;

export function useCitiesCatalog() {
  const navigate = useNavigate();
  const { search, setSearch, page, setPage, debouncedSearch } = useCatalogFilters({ debounceMs: 250 });

  const [allCities, setAllCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [allFilters, setAllFilters] = useState([]);

  // editor state
  const [editingCity, setEditingCity] = useState(null);
  const [preparingEdit, setPreparingEdit] = useState(false);
  const [activeLang, setActiveLang] = useState('');
  const [activeEditTab, setActiveEditTab] = useState('content');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // image upload
  const imageInputRef = useRef(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [commonsModalOpen, setCommonsModalOpen] = useState(false);

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const loadCities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await citiesCatalogAPI.list({});
      const data = response?.data;
      const list = normalizeListResponse(data, ['data', 'results']);
      setAllCities(list.map(fromApiCity).filter(Boolean));
    } catch (err) {
      setAllCities([]);
      setError(parseApiError(err, 'Ошибка загрузки городов'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      const r = await citiesCatalogAPI.listFilters();
      const data = r?.data;
      const list = normalizeListResponse(data, ['tags', 'filters', 'results']);
      setAllFilters(list);
    } catch {
      setAllFilters([]);
    }
  }, []);

  useEffect(() => {
    loadCities();
    loadFilters();
  }, [loadCities, loadFilters]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, setPage]);

  const filtered = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => {
      return (
        getMultiLangValue(c.name).toLowerCase().includes(q) ||
        getMultiLangValue(c.country).toLowerCase().includes(q) ||
        (c.display_country || '').toLowerCase().includes(q)
      );
    });
  }, [allCities, debouncedSearch]);

  const totalCount = filtered.length;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openEdit = useCallback(async (row) => {
    if (preparingEdit) return;
    setSaveError(null);
    setDeleteError(null);
    setActiveLang(pickPrimaryLangCode([row?.name, row?.description, row?.country]));
    setActiveEditTab('content');
    setPreparingEdit(true);

    let nextCity = fromApiCity(row);
    try {
      const r = await citiesCatalogAPI.get(row.id);
      const d = r?.data?.city || r?.data;
      nextCity = mergeCityRowWithApiDetail(nextCity, d);
    } catch {
      // ignore: fallback to row data
    } finally {
      setPreparingEdit(false);
    }

    setEditingCity(nextCity);
  }, [preparingEdit]);

  const toggleFilter = useCallback((filterId) => {
    setEditingCity((prev) => {
      if (!prev) return prev;
      const ids = prev.city_filter_ids || [];
      const sid = String(filterId);
      return {
        ...prev,
        city_filter_ids: ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid],
      };
    });
  }, []);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await citiesCatalogAPI.uploadImage(fd);
      const { id, url } = r?.data || {};
      if (id) {
        setEditingCity((prev) => ({ ...prev, image_id: id, image_url: url || prev?.image_url || null }));
      }
    } catch (err) {
      setSaveError('Ошибка загрузки изображения: ' + parseApiError(err, 'Ошибка загрузки'));
    } finally {
      setImageUploading(false);
    }
  }, []);

  const handleCommonsImageSelect = useCallback(({ imageId, localUrl, copyright }) => {
    setEditingCity((prev) => ({
      ...prev,
      image_id: imageId,
      image_url: localUrl,
      image_copyright: copyright || prev?.image_copyright || '',
    }));
  }, []);

  const handleSave = useCallback(async (e) => {
    e?.preventDefault();
    if (!editingCity?.id) return;

    try {
      setSaving(true);
      setSaveError(null);
      const payload = toApiCityUpdatePayload(editingCity);
      await citiesCatalogAPI.update(editingCity.id, payload);
      setEditingCity(null);
      await loadCities();
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  }, [editingCity, loadCities]);

  const requestDelete = useCallback((row) => {
    setDeleteError(null);
    setDeleteTarget(row);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await citiesCatalogAPI.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadCities();
    } catch (err) {
      setDeleteError(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadCities]);

  const ec = editingCity;
  const nameVal = typeof ec?.name === 'object' ? ec.name : {};
  const descVal = typeof ec?.description === 'object' ? ec.description : {};
  const countryVal = typeof ec?.country === 'object' ? ec.country : {};
  const langOptions = buildLangOptions([nameVal, descVal, countryVal]);

  useEffect(() => {
    if (!editingCity || langOptions.length === 0) return;
    const hasActive = langOptions.some((lang) => lang.code === activeLang);
    if (!hasActive) setActiveLang(langOptions[0].code);
  }, [editingCity, langOptions, activeLang]);

  const openNewSession = useCallback(() => navigate('/generation/new'), [navigate]);
  const openTags = useCallback(() => navigate('/catalog/tags?tab=city'), [navigate]);
  const openSessions = useCallback(() => navigate('/generation'), [navigate]);

  return {
    // list
    loading,
    error,
    rows,
    totalCount,
    page,
    setPage,
    search,
    setSearch,
    pageSize: PAGE_SIZE,
    reload: loadCities,

    // actions shortcuts
    openNewSession,
    openTags,
    openSessions,

    // editor
    editingCity,
    setEditingCity,
    preparingEdit,
    openEdit,
    activeLang,
    setActiveLang,
    activeEditTab,
    setActiveEditTab,
    saving,
    saveError,
    handleSave,
    langOptions,
    nameVal,
    descVal,
    countryVal,

    // filters/tags
    allFilters,
    toggleFilter,

    // media
    imageInputRef,
    imageUploading,
    commonsModalOpen,
    setCommonsModalOpen,
    handleImageUpload,
    handleCommonsImageSelect,

    // delete
    deleteTarget,
    deleteError,
    deleting,
    requestDelete,
    setDeleteTarget,
    confirmDelete,
  };
}

