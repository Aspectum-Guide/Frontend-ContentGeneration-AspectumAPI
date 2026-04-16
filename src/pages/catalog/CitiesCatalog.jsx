import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/Modal';
import { Field, TextInput, Textarea, FormActions } from '../../components/ui/FormField';
import CommonsImagePicker from '../../components/generation/CommonsImagePicker';
import { useLayoutActions } from '../../context/LayoutActionsContext';
import { citiesAPI, cityFiltersAPI, imagesAPI } from '../../api/generation';
import { parseApiError } from '../../utils/apiError';
import 'leaflet/dist/leaflet.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMultiLang(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.ru || val.en || val.it || Object.values(val).find(Boolean) || '';
}

const LANGS = [
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
];

const CITY_EDIT_TABS = [
  { key: 'content', label: 'Контент' },
  { key: 'media', label: 'Обложка' },
  { key: 'geo', label: 'Карта и теги' },
];

// ─── LangTabs ────────────────────────────────────────────────────────────────
function LangTabs({ active, onSwitch, values = {} }) {
  const filled = new Set(Object.entries(values).filter(([, v]) => v?.trim()).map(([k]) => k));
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {LANGS.map(({ code, label, flag }) => (
        <button
          key={code}
          type="button"
          onClick={() => onSwitch(code)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            active === code
              ? 'bg-blue-600 text-white border-blue-600'
              : filled.has(code)
              ? 'bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-500'
              : 'bg-white text-gray-500 border-gray-300 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <span>{flag}</span>
          <span>{label}</span>
          {filled.has(code) && active !== code && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── LangBlock ─────────────────────────────────────────────────────────────
function LangBlock({ label, value = {}, onChange, activeLang, multiline = false, rows = 3, required }) {
  const lang = activeLang;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-gray-400 font-normal uppercase text-xs">{lang}</span>
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {multiline ? (
        <Textarea
          value={value?.[lang] || ''}
          onChange={e => onChange({ ...value, [lang]: e.target.value })}
          rows={rows}
          placeholder={`${label} (${lang})`}
        />
      ) : (
        <TextInput
          value={value?.[lang] || ''}
          onChange={e => onChange({ ...value, [lang]: e.target.value })}
          placeholder={`${label} (${lang})`}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CitiesCatalog() {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const [allCities, setAllCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Edit state
  const [editingCity, setEditingCity] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [activeLang, setActiveLang] = useState('ru');
  const [activeEditTab, setActiveEditTab] = useState('content');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Filters (city tags)
  const [allFilters, setAllFilters] = useState([]);

  // Image upload
  const imageInputRef = useRef(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [commonsModalOpen, setCommonsModalOpen] = useState(false);
  const cityMapElRef = useRef(null);
  const cityMapRef = useRef(null);
  const cityMarkerRef = useRef(null);
  const leafletRef = useRef(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load list ───────────────────────────────────────────────────────────
  const loadCities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await citiesAPI.list({});
      const data = response?.data;
      const list = Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      setAllCities(list);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки городов'));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load city filters (tags) ────────────────────────────────────────────
  const loadFilters = useCallback(async () => {
    try {
      const r = await cityFiltersAPI.list();
      const data = r?.data;
      const list = Array.isArray(data?.tags) ? data.tags
        : Array.isArray(data?.filters) ? data.filters
        : Array.isArray(data) ? data : [];
      setAllFilters(list);
    } catch {
      // ignore loading errors, UI will show empty state
    }
  }, []);

  useEffect(() => { loadCities(); loadFilters(); }, [loadCities, loadFilters]);
  useEffect(() => { setPage(1); }, [search]);

  // ── Filtered + paginated ────────────────────────────────────────────────
  const filtered = allCities.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      getMultiLang(c.name).toLowerCase().includes(q) ||
      getMultiLang(c.country).toLowerCase().includes(q) ||
      (c.display_country || '').toLowerCase().includes(q)
    );
  });
  const totalCount = filtered.length;
  const cities = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Open edit: load full city data ─────────────────────────────────────
  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    setActiveLang('ru');
    setActiveEditTab('content');
    setEditingCity({ ...row, city_filter_ids: row.city_filter_ids || [] });
    setEditLoading(true);
    try {
      const r = await citiesAPI.get(row.id);
      const d = r?.data?.city || r?.data;
      if (d) {
        setEditingCity(prev => ({
          ...prev,
          name: d.name || prev.name || {},
          description: d.description || prev.description || {},
          country: d.country || prev.country || {},
          lat: d.lat ?? prev.lat ?? '',
          lon: d.lon ?? prev.lon ?? '',
          image_id: d.image_id ?? prev.image_id ?? null,
          image_url: d.image_url ?? prev.image_url ?? null,
          image_copyright: d.image_copyright ?? prev.image_copyright ?? '',
          city_filter_ids: d.city_filter_ids || prev.city_filter_ids || [],
        }));
      }
    } catch {
      // ignore loading errors, edit dialog will use list row data
    }
    setEditLoading(false);
  }, []);

  // ── Toggle filter ───────────────────────────────────────────────────────
  const toggleFilter = useCallback((filterId) => {
    setEditingCity(prev => {
      if (!prev) return prev;
      const ids = prev.city_filter_ids || [];
      const sid = String(filterId);
      return {
        ...prev,
        city_filter_ids: ids.includes(sid)
          ? ids.filter(x => x !== sid)
          : [...ids, sid],
      };
    });
  }, []);

  // ── Image upload ────────────────────────────────────────────────────────
  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await imagesAPI.upload(fd);
      const { id, url } = r?.data || {};
      if (id) {
        setEditingCity(prev => ({ ...prev, image_id: id, image_url: url || prev.image_url }));
      }
    } catch (err) {
      setSaveError('Ошибка загрузки изображения: ' + parseApiError(err, 'Ошибка загрузки'));
    } finally {
      setImageUploading(false);
    }
  }, []);

  const handleCommonsImageSelect = useCallback(({ imageId, localUrl, copyright }) => {
    setEditingCity(prev => ({
      ...prev,
      image_id: imageId,
      image_url: localUrl,
      image_copyright: copyright || prev?.image_copyright || '',
    }));
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingCity?.id) return;
    try {
      setSaving(true);
      setSaveError(null);
      const payload = {
        name: editingCity.name || {},
        description: editingCity.description || {},
        country: editingCity.country || {},
        city_filter_ids: editingCity.city_filter_ids || [],
      };
      const latVal = editingCity.lat;
      const lonVal = editingCity.lon;
      if (latVal !== '' && latVal != null) payload.lat = parseFloat(latVal);
      if (lonVal !== '' && lonVal != null) payload.lon = parseFloat(lonVal);
      if (editingCity.image_id !== undefined) payload.image_id = editingCity.image_id;
      if (editingCity.image_copyright !== undefined) payload.image_copyright = editingCity.image_copyright;
      await citiesAPI.update(editingCity.id, payload);
      setEditingCity(null);
      await loadCities();
    } catch (err) {
      setSaveError(parseApiError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await citiesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadCities();
    } catch (err) {
      alert(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────
  const columns = [
    {
      key: 'name',
      label: 'Название',
      render: (name) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{getMultiLang(name) || '—'}</div>
          {name && typeof name === 'object' && (
            <div className="text-xs text-gray-400 mt-0.5">
              {Object.entries(name).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'country',
      label: 'Страна',
      render: (country, row) => (
        <span className="text-sm text-gray-600">{row.display_country || getMultiLang(country) || '—'}</span>
      ),
    },
    {
      key: 'lat',
      label: 'Коорд.',
      render: (lat, row) => (
        <span className="text-xs font-mono text-gray-400">
          {lat != null ? `${parseFloat(lat).toFixed(3)}, ${parseFloat(row.lon).toFixed(3)}` : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'ID',
      className: 'font-mono text-xs text-gray-400',
      render: (id) => String(id).slice(0, 12) + '…',
    },
  ];

  // ── Form state helpers ──────────────────────────────────────────────────
  const ec = editingCity;
  const nameVal = typeof ec?.name === 'object' ? ec.name : {};
  const descVal = typeof ec?.description === 'object' ? ec.description : {};
  const countryVal = typeof ec?.country === 'object' ? ec.country : {};

  useEffect(() => {
    const parseCoord = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const initMap = async () => {
      if (!editingCity || activeEditTab !== 'geo' || !cityMapElRef.current || cityMapRef.current) return;
      const { default: L } = await import('leaflet');
      leafletRef.current = L;

      if (L.Icon?.Default) {
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }

      const lat = parseCoord(editingCity?.lat);
      const lon = parseCoord(editingCity?.lon);
      const map = L.map(cityMapElRef.current).setView(
        lat != null && lon != null ? [lat, lon] : [48.8566, 2.3522],
        lat != null && lon != null ? 9 : 4
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      map.on('click', (e) => {
        const nextLat = Number(e.latlng.lat.toFixed(6));
        const nextLon = Number(e.latlng.lng.toFixed(6));
        setEditingCity((prev) => ({ ...prev, lat: nextLat, lon: nextLon }));
      });

      cityMapRef.current = map;

      if (lat != null && lon != null) {
        cityMarkerRef.current = L.marker([lat, lon]).addTo(map);
      }

      setTimeout(() => map.invalidateSize(), 50);
    };

    initMap();
  }, [editingCity, activeEditTab]);

  useEffect(() => {
    const map = cityMapRef.current;
    const L = leafletRef.current;
    if (!map || !L || activeEditTab !== 'geo') return;

    const lat = Number(ec?.lat);
    const lon = Number(ec?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (cityMarkerRef.current) {
        map.removeLayer(cityMarkerRef.current);
        cityMarkerRef.current = null;
      }
      return;
    }

    if (!cityMarkerRef.current) {
      cityMarkerRef.current = L.marker([lat, lon]).addTo(map);
    } else {
      cityMarkerRef.current.setLatLng([lat, lon]);
    }

    map.setView([lat, lon], Math.max(map.getZoom(), 9));
  }, [ec?.lat, ec?.lon, activeEditTab]);

  useEffect(() => {
    if (editingCity) return;
    if (cityMapRef.current) {
      cityMapRef.current.remove();
      cityMapRef.current = null;
      cityMarkerRef.current = null;
    }
  }, [editingCity]);

  useEffect(() => {
    if (!editingCity) {
      setMobileActions([
        {
          id: 'create-city-session',
          label: 'Создать город',
          onClick: () => navigate('/generation/new'),
          variant: 'primary',
        },
        {
          id: 'create-city-tag',
          label: 'Создать тег города',
          onClick: () => navigate('/catalog/tags?tab=city'),
          variant: 'secondary',
        },
        {
          id: 'open-sessions',
          label: 'Открыть сессии',
          onClick: () => navigate('/generation'),
        },
        {
          id: 'refresh-cities',
          label: 'Обновить справочник',
          onClick: () => loadCities(),
        },
      ]);
      return;
    }

    const actions = [
      {
        id: 'save-city',
        label: saving ? 'Сохранение...' : 'Сохранить город',
        onClick: () => {
          if (!saving) handleSave();
        },
        disabled: saving,
        variant: 'primary',
      },
      {
        id: 'close-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingCity(null),
      },
    ];

    if (!imageUploading) {
      actions.push({
        id: 'open-commons-picker',
        label: 'Открыть Wikimedia Commons',
        onClick: () => {
          setActiveEditTab('media');
          setCommonsModalOpen(true);
        },
      });
    }

    setMobileActions(actions);
    return () => setMobileActions([]);
  }, [editingCity, saving, imageUploading, setMobileActions, navigate, loadCities]);

  return (
    <Layout>
      <DataTable
        columns={columns}
        rows={cities}
        loading={loading}
        error={error}
        emptyIcon="🏙️"
        emptyText={search ? 'По запросу городов не найдено' : 'Городов нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию, стране..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        actions={(row) => (
          <>
            <button
              onClick={() => openEdit(row)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </>
        )}
      />

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!editingCity}
        onClose={() => setEditingCity(null)}
        title={`Редактировать город${ec ? ` — ${getMultiLang(ec.name) || ''}` : ''}`}
        size="xl"
      >
        {editingCity && (
          <form onSubmit={handleSave} className="space-y-5">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            {editLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
                Загрузка данных...
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
              {CITY_EDIT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveEditTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeEditTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeEditTab === 'content' && (
              <div className="space-y-5">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Активный язык</p>
                  <LangTabs
                    active={activeLang}
                    onSwitch={setActiveLang}
                    values={nameVal}
                  />
                </div>

                <LangBlock
                  label="Название"
                  value={nameVal}
                  onChange={v => setEditingCity(p => ({ ...p, name: v }))}
                  activeLang={activeLang}
                  required
                />

                <LangBlock
                  label="Описание"
                  value={descVal}
                  onChange={v => setEditingCity(p => ({ ...p, description: v }))}
                  activeLang={activeLang}
                  multiline
                  rows={4}
                />

                <LangBlock
                  label="Страна"
                  value={countryVal}
                  onChange={v => setEditingCity(p => ({ ...p, country: v }))}
                  activeLang={activeLang}
                />
              </div>
            )}

            {activeEditTab === 'media' && (
              <Field label="Обложка города">
                <div className="space-y-3 overflow-hidden">
                  {ec?.image_url ? (
                    <div className="relative w-full h-[240px] md:h-[300px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={ec.image_url} alt="Обложка города" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setEditingCity(p => ({ ...p, image_id: null, image_url: null }))}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm flex items-center justify-center hover:bg-black/80"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-[240px] md:h-[300px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                      Обложка не выбрана
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={imageUploading}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {imageUploading ? (
                        <span className="flex items-center gap-1.5">
                          <span className="animate-spin w-3 h-3 border border-gray-500 border-t-transparent rounded-full inline-block" />
                          Загрузка...
                        </span>
                      ) : '📷 Загрузить фото'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommonsModalOpen(true)}
                      disabled={imageUploading}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      🖼️ Выбрать из Wikimedia Commons
                    </button>
                    {ec?.image_id && (
                      <span className="px-2 py-2 text-xs text-gray-400 font-mono">
                        ID: {String(ec.image_id).slice(0, 8)}…
                      </span>
                    )}
                  </div>

                  {ec?.image_id && (
                    <TextInput
                      value={ec?.image_copyright || ''}
                      onChange={e => setEditingCity(p => ({ ...p, image_copyright: e.target.value }))}
                      placeholder="Авторские права (copyright)"
                    />
                  )}
                </div>
              </Field>
            )}

            {activeEditTab === 'geo' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Широта (lat)">
                    <TextInput
                      type="number"
                      step="any"
                      value={ec?.lat ?? ''}
                      onChange={e => setEditingCity(p => ({ ...p, lat: e.target.value }))}
                      placeholder="55.7558"
                    />
                  </Field>
                  <Field label="Долгота (lon)">
                    <TextInput
                      type="number"
                      step="any"
                      value={ec?.lon ?? ''}
                      onChange={e => setEditingCity(p => ({ ...p, lon: e.target.value }))}
                      placeholder="37.6173"
                    />
                  </Field>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">Карта города (кликните, чтобы выставить координаты)</div>
                  <div ref={cityMapElRef} className="w-full h-72 rounded-xl border border-gray-200 overflow-hidden" />
                </div>

                {allFilters.length > 0 && (
                  <Field label="Теги города">
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                      {allFilters.map((f) => {
                        const fid = String(f.id);
                        const selected = (ec?.city_filter_ids || []).includes(fid);
                        const label = getMultiLang(f.name) || f.display_name || fid;
                        return (
                          <button
                            key={fid}
                            type="button"
                            onClick={() => toggleFilter(fid)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              selected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            {f.emoji && <span>{f.emoji}</span>}
                            {label}
                            {selected && <span className="ml-0.5">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Выбрано: {(ec?.city_filter_ids || []).length} тегов
                    </p>
                  </Field>
                )}
              </div>
            )}

            {/* ── Действия ──────────────────────────────────────────── */}
            <div className="hidden md:block">
              <FormActions saving={saving} onCancel={() => setEditingCity(null)} />
            </div>
            <div className="md:hidden text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
              Кнопки формы перенесены в верхнее меню «Действия».
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete Modal ────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить город?"
        message={`Город «${getMultiLang(deleteTarget?.name) || deleteTarget?.id}» будет удалён безвозвратно.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />

      <CommonsImagePicker
        isOpen={commonsModalOpen}
        onClose={() => setCommonsModalOpen(false)}
        onImageSelected={handleCommonsImageSelect}
        getSessionUuid={() => ''}
        defaultQuery={getMultiLang(ec?.name || '')}
      />
    </Layout>
  );
}
